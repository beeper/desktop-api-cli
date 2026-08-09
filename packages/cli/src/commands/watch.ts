import { createHmac } from 'node:crypto'
import { Flags } from '@oclif/core'
import WebSocket from 'ws'
import { BeeperCommand, writeEvent } from '../lib/command.js'
import { requireToken } from '../lib/client.js'
import { getBaseURL } from '../lib/targets.js'
import { startStream } from '../lib/output.js'

type WebhookConfig = { url: string; secret?: string; queue: Array<{ body: string; signature?: string }>; inflight: number; max: number }
export type EventFilter = { include?: Set<string>; exclude?: Set<string> }

export default class Watch extends BeeperCommand {
  static override summary = 'Stream Desktop API WebSocket events'
  static override flags = {
    chat: Flags.string({ char: 'c', multiple: true, description: 'Chat ID to subscribe to. Defaults to all chats.' }),
    json: Flags.boolean({ default: false, description: 'Print raw JSON, one event per line' }),
    'include-type': Flags.string({ multiple: true, options: ['chat.upserted', 'chat.deleted', 'message.upserted', 'message.deleted'], description: 'Only forward events of these types. Repeat for multiple.' }),
    'exclude-type': Flags.string({ multiple: true, options: ['chat.upserted', 'chat.deleted', 'message.upserted', 'message.deleted'], description: 'Drop events of these types. Repeat for multiple.' }),
    webhook: Flags.string({ description: 'Forward each event to this URL as a POST request (best-effort, fire-and-forget)' }),
    'webhook-secret': Flags.string({ description: 'HMAC-SHA256 secret. Signs payloads with X-Beeper-Signature: sha256=<hex>' }),
    'webhook-queue': Flags.integer({ default: 64, description: 'Maximum pending webhook deliveries before dropping events' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Watch)
    if (flags['webhook-secret'] && !flags.webhook) throw new Error('--webhook-secret requires --webhook URL')
    if (flags['include-type']?.length && flags['exclude-type']?.length) throw new Error('Use either --include-type or --exclude-type, not both.')
    const filter: EventFilter = {
      include: flags['include-type']?.length ? new Set(flags['include-type']) : undefined,
      exclude: flags['exclude-type']?.length ? new Set(flags['exclude-type']) : undefined,
    }
    const token = await requireToken({ target: flags.target, baseURL: flags['base-url'] })
    const baseURL = await getBaseURL(flags['base-url'], flags.target)
    const info = await fetch(new URL('/v1/info', baseURL))
    if (!info.ok) throw new Error(`Failed to fetch /v1/info: HTTP ${info.status}`)
    const metadata = await info.json() as { endpoints?: { ws_events?: string } }
    const endpoint = metadata.endpoints?.ws_events || '/v1/ws'
    const url = new URL(endpoint, baseURL)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

    const subscribed = flags.chat?.length ? flags.chat : ['*']
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })
    const webhook: WebhookConfig | undefined = flags.webhook
      ? { url: flags.webhook, secret: flags['webhook-secret'], queue: [], inflight: 0, max: flags['webhook-queue'] }
      : undefined

    if (flags.json) {
      await this.runJSON(ws, subscribed, flags.events, webhook, filter)
      return
    }
    await this.runHuman(ws, subscribed, baseURL, flags.events, webhook, filter)
  }

  private async runJSON(ws: WebSocket, subscribed: string[], events: boolean, webhook?: WebhookConfig, filter?: EventFilter): Promise<void> {
    ws.addEventListener('open', () => {
      if (events) writeEvent('watch.open', { subscribed })
      ws.send(JSON.stringify({ type: 'subscriptions.set', chatIDs: subscribed }))
    })
    ws.addEventListener('message', event => {
      const data = typeof event.data === 'string' ? event.data : event.data.toString()
      if (!passesFilter(data, filter)) return
      if (events) writeEvent('watch.message')
      process.stdout.write(`${data}\n`)
      if (webhook) forwardWebhook(webhook, data, events)
    })
    ws.addEventListener('error', () => {
      if (events) writeEvent('watch.error', { message: 'WebSocket connection failed' })
      this.error('WebSocket connection failed', { exit: 1 })
    })
    ws.addEventListener('close', event => {
      if (events) writeEvent('watch.close', { code: event.code, reason: event.reason })
      if (event.code !== 1000) this.error(`WebSocket closed: ${event.code} ${event.reason}`, { exit: 1 })
    })
    await new Promise<void>(resolve => {
      process.once('SIGINT', () => { ws.close(1000); resolve() })
      ws.addEventListener('close', () => resolve())
    })
  }

  private async runHuman(ws: WebSocket, subscribed: string[], baseURL: string, events: boolean, webhook?: WebhookConfig, filter?: EventFilter): Promise<void> {
    const stream = await startStream({ baseURL, subscribed })
    let closed = false

    const finish = async (): Promise<void> => {
      if (closed) return
      closed = true
      try { ws.close(1000) } catch { /* ignore */ }
      await stream.close()
    }

    ws.addEventListener('open', () => {
      if (events) writeEvent('watch.open', { subscribed })
      stream.setConnected(true)
      ws.send(JSON.stringify({ type: 'subscriptions.set', chatIDs: subscribed }))
    })
    ws.addEventListener('message', event => {
      const data = typeof event.data === 'string' ? event.data : event.data.toString()
      if (!passesFilter(data, filter)) return
      if (events) writeEvent('watch.message')
      if (webhook) forwardWebhook(webhook, data, events)
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        stream.push({
          type: typeof parsed.type === 'string' ? parsed.type : 'event',
          chatID: typeof parsed.chatID === 'string' ? parsed.chatID : undefined,
          messageID: typeof parsed.messageID === 'string' ? parsed.messageID : undefined,
          ts: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
        })
      } catch {
        stream.push({ type: 'raw', ts: new Date().toISOString() })
      }
    })
    ws.addEventListener('error', () => {
      if (events) writeEvent('watch.error', { message: 'WebSocket connection failed' })
      stream.setConnected(false)
      stream.setStatus('connection error')
    })
    ws.addEventListener('close', event => {
      if (events) writeEvent('watch.close', { code: event.code, reason: event.reason })
      stream.setConnected(false)
      if (event.code !== 1000) stream.setStatus(`closed ${event.code}${event.reason ? ` ${event.reason}` : ''}`)
      void finish()
    })
    process.once('SIGINT', () => { void finish() })

    await stream.done
  }
}

export function passesFilter(body: string, filter?: EventFilter): boolean {
  if (!filter || (!filter.include && !filter.exclude)) return true
  let type: string | undefined
  try {
    const parsed = JSON.parse(body) as { type?: unknown }
    if (typeof parsed.type === 'string') type = parsed.type
  } catch {
    return true
  }
  if (!type) return true
  if (filter.include && !filter.include.has(type)) return false
  if (filter.exclude && filter.exclude.has(type)) return false
  return true
}

function forwardWebhook(webhook: WebhookConfig, body: string, events: boolean): void {
  if (webhook.inflight + webhook.queue.length >= webhook.max) {
    if (events) writeEvent('watch.webhook_drop', { reason: 'queue_full', size: webhook.queue.length })
    process.stderr.write(`warning: webhook queue full (${webhook.max}); dropped event\n`)
    return
  }
  const signature = webhook.secret
    ? `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}`
    : undefined
  webhook.queue.push({ body, signature })
  void drainWebhook(webhook, events)
}

async function drainWebhook(webhook: WebhookConfig, events: boolean): Promise<void> {
  while (webhook.queue.length > 0) {
    const item = webhook.queue.shift()!
    webhook.inflight++
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (item.signature) headers['x-beeper-signature'] = item.signature
      const response = await fetch(webhook.url, { method: 'POST', headers, body: item.body, signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        if (events) writeEvent('watch.webhook_error', { status: response.status })
        process.stderr.write(`warning: webhook POST ${webhook.url} returned ${response.status}\n`)
      }
    } catch (error) {
      if (events) writeEvent('watch.webhook_error', { message: (error as Error).message })
      process.stderr.write(`warning: webhook POST failed: ${(error as Error).message}\n`)
    } finally {
      webhook.inflight--
    }
  }
}

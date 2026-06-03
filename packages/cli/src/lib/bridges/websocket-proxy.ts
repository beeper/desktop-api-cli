import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import WebSocket from 'ws'
import { parseRegistration, type AppserviceRegistration } from './manager.js'

type WebsocketMessage = {
  command?: string
  data?: unknown
  id?: number
  status?: string
  txn_id?: string
  [key: string]: unknown
}

const defaultReconnectBackoff = 2_000
const maxReconnectBackoff = 120_000
const reconnectBackoffReset = 300_000

export async function proxyAppserviceWebsocket(options: { homeserverURL: string; registrationPath: string }): Promise<void> {
  const registration = parseRegistration(await readFile(options.registrationPath, 'utf8'))
  if (!registration.url || registration.url === 'websocket') {
    throw new Error('You must change the `url` field in the registration file to point at the local appservice HTTP server (e.g. `http://localhost:8080`)')
  }
  if (!registration.url.startsWith('http://') && !registration.url.startsWith('https://')) {
    throw new Error('`url` field in registration must start with http:// or https://')
  }
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  process.once('SIGTERM', () => controller.abort())
  await runProxyLoop(controller.signal, options.homeserverURL, registration)
}

export async function runProxyLoop(signal: AbortSignal, homeserverURL: string, registration: AppserviceRegistration): Promise<void> {
  let reconnectBackoff = defaultReconnectBackoff
  let lastDisconnect = Date.now()
  while (!signal.aborted) {
    try {
      await runSingleProxy(signal, homeserverURL, registration)
      return
    } catch (error) {
      if (signal.aborted) return
      if (String((error as Error).message).includes('conn_replaced')) return
      process.stderr.write(`Error in appservice websocket: ${(error as Error).message}\n`)
    }
    const now = Date.now()
    reconnectBackoff = lastDisconnect + reconnectBackoffReset < now ? defaultReconnectBackoff : Math.min(maxReconnectBackoff, reconnectBackoff * 2)
    lastDisconnect = now
    process.stderr.write(`Websocket disconnected, reconnecting in ${Math.round(reconnectBackoff / 1000)}s\n`)
    await delay(reconnectBackoff, undefined, { signal }).catch(() => undefined)
  }
}

async function runSingleProxy(signal: AbortSignal, homeserverURL: string, registration: AppserviceRegistration): Promise<void> {
  const wsURL = new URL('/_matrix/client/unstable/fi.mau.as_sync', homeserverURL)
  wsURL.protocol = wsURL.protocol === 'http:' ? 'ws:' : 'wss:'
  const ws = new WebSocket(wsURL, {
    headers: {
      Authorization: `Bearer ${registration.as_token}`,
      'User-Agent': 'beeper-cli bridge-manager-ts',
      'X-Mautrix-Process-ID': String(process.pid),
      'X-Mautrix-Websocket-Version': '3',
    },
  })
  signal.addEventListener('abort', () => ws.close())
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      send(ws, { command: 'bridge_status', data: { stateEvent: 'UNCONFIGURED' } })
      keepalive(signal, ws).catch(error => process.stderr.write(`Websocket ping returned error: ${(error as Error).message}\n`))
      resolve()
    })
    ws.once('error', reject)
  })
  await new Promise<void>((resolve, reject) => {
    ws.on('message', data => {
      handleMessage(ws, registration, JSON.parse(String(data))).catch(error => {
        process.stderr.write(`Failed to handle websocket message: ${(error as Error).message}\n`)
      })
    })
    ws.once('close', (code, reason) => {
      if (code === 4001 || String(reason).includes('conn_replaced')) reject(new Error('conn_replaced'))
      else resolve()
    })
    ws.once('error', reject)
  })
}

async function handleMessage(ws: WebSocket, registration: AppserviceRegistration, msg: WebsocketMessage): Promise<void> {
  if (!msg.command || msg.command === 'transaction') {
    const txnID = String(msg.txn_id ?? '')
    const url = new URL(`/_matrix/app/v1/transactions/${encodeURIComponent(txnID)}`, registration.url)
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${registration.hs_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    })
    if (!response.ok) throw new Error(`transaction proxy returned HTTP ${response.status}: ${await response.text()}`)
    sendResponse(ws, msg, true, { txn_id: txnID })
  } else if (msg.command === 'http_proxy') {
    const req = msg.data as { body?: unknown; headers?: Record<string, string | string[]>; path?: string; query?: string }
    const url = new URL(req.path || '/', registration.url)
    url.search = req.query || ''
    const response = await fetch(url, {
      method: 'PUT',
      headers: req.headers as HeadersInit,
      body: bodyFromProxyRequest(req.body),
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    const text = bytes.toString('utf8')
    const body = isJSON(text) ? JSON.parse(text) : bytes.toString('base64url')
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    sendResponse(ws, msg, true, { status: response.status, headers, body })
  } else if (msg.command === 'connect' || msg.command === 'response' || msg.command === 'error') {
    return
  } else {
    sendResponse(ws, msg, false, { message: 'unknown request type' })
  }
}

async function keepalive(signal: AbortSignal, ws: WebSocket): Promise<void> {
  while (!signal.aborted && ws.readyState === WebSocket.OPEN) {
    await delay(180_000, undefined, { signal }).catch(() => undefined)
    if (signal.aborted || ws.readyState !== WebSocket.OPEN) return
    send(ws, { command: 'ping', data: { timestamp: Date.now() } })
  }
}

function sendResponse(ws: WebSocket, msg: WebsocketMessage, ok: boolean, data: unknown): void {
  if (!msg.id || msg.command === 'response' || msg.command === 'error') return
  send(ws, { id: msg.id, command: ok ? 'response' : 'error', data })
}

function send(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function bodyFromProxyRequest(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === 'string') return body
  return JSON.stringify(body)
}

function isJSON(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

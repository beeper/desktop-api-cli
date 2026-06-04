import { createWriteStream } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chat } from '@beeper/desktop-api/resources/chats/chats'
import type { Attachment, Message } from '@beeper/desktop-api/resources/shared'
import { apiItems } from './api-values.js'

type ExportOptions = {
  accountIDs?: string[]
  chatIDs?: string[]
  downloadAttachments: boolean
  force: boolean
  limitChats?: number
  limitMessages?: number
  maxParticipants?: number
  onProgress?: (message: string) => void
  outDir: string
}

type ExportState = {
  completedChatIDs: string[]
  createdAt: string
  exportVersion: 1
  chats: Record<string, ChatState>
}

type ChatState = {
  attachmentCount: number
  complete: boolean
  cursor: string | null
  error?: string
  messageCount: number
  startedAt: string
  updatedAt: string
}

type ExportManifest = {
  accounts: unknown[]
  attachmentCount: number
  chatCount: number
  completedAt: string
  createdAt: string
  messageCount: number
  version: 1
}

type AttachmentExport = {
  attachment: Attachment
  index: number
  kind: 'attachment' | 'poster'
  messageID: string
  path: string
  sourceURL: string
}

export async function exportBeeperData(client: any, options: ExportOptions): Promise<ExportManifest> {
  await mkdir(options.outDir, { recursive: true })
  await mkdir(join(options.outDir, 'chats'), { recursive: true })

  const statePath = join(options.outDir, '.beeper-export-state.json')
  const state = options.force ? createState() : await readState(statePath)
  const startedAt = state.createdAt

  progress(options, `Export directory: ${options.outDir}`)
  const accounts = apiItems(await client.accounts.list())
  await writeJSONAtomic(join(options.outDir, 'accounts.json'), accounts)
  progress(options, `Accounts: ${accounts.length}`)

  const chats = await collectChats(client, options)
  await writeJSONAtomic(join(options.outDir, 'chats.json'), chats)
  progress(options, `Chats queued: ${chats.length}`)

  let totalMessages = 0
  let totalAttachments = 0

  for (const [index, listedChat] of chats.entries()) {
    const chatID = String(listedChat.id)
    const chatDir = join(options.outDir, 'chats', safeSegment(chatID))
    const chatState = state.chats[chatID]
    if (!options.force && chatState?.complete && state.completedChatIDs.includes(chatID)) {
      totalMessages += chatState.messageCount
      totalAttachments += chatState.attachmentCount
      progress(options, `[${index + 1}/${chats.length}] ${chatTitle(listedChat)} already complete`)
      continue
    }

    progress(options, `[${index + 1}/${chats.length}] ${chatTitle(listedChat)} starting`)
    if (options.force) await rm(chatDir, { recursive: true, force: true })
    await mkdir(chatDir, { recursive: true })
    await mkdir(join(chatDir, 'attachments'), { recursive: true })

    const chat = await client.chats.retrieve(chatID, {
      maxParticipantCount: options.maxParticipants,
    })
    await writeJSONAtomic(join(chatDir, 'chat.json'), chat)

    state.chats[chatID] ??= {
      attachmentCount: 0,
      complete: false,
      cursor: null,
      messageCount: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    state.chats[chatID]!.complete = false
    delete state.chats[chatID]!.error
    await writeJSONAtomic(statePath, state)

    try {
      const result = await exportChatMessages(client, chat, chatDir, state, statePath, options)
      state.chats[chatID] = {
        ...state.chats[chatID]!,
        attachmentCount: result.attachmentCount,
        complete: true,
        cursor: null,
        messageCount: result.messages.length,
        updatedAt: new Date().toISOString(),
      }
      state.completedChatIDs = Array.from(new Set([...state.completedChatIDs, chatID]))
      await writeJSONAtomic(join(chatDir, 'messages.json'), result.messages)
      await writeFileAtomic(join(chatDir, 'messages.markdown'), renderMarkdown(chat, result.messages, result.attachments))
      await writeFileAtomic(join(chatDir, 'messages.html'), renderHTML(chat, result.messages, result.attachments))
      await rm(join(chatDir, 'messages.partial.jsonl'), { force: true })
      await writeJSONAtomic(statePath, state)
      totalMessages += result.messages.length
      totalAttachments += result.attachmentCount
      progress(options, `[${index + 1}/${chats.length}] ${chatTitle(chat)} complete: ${result.messages.length} messages, ${result.attachmentCount} attachments`)
    } catch (error) {
      state.chats[chatID] = {
        ...state.chats[chatID]!,
        complete: false,
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
      }
      await writeJSONAtomic(statePath, state)
      throw error
    }
  }

  const manifest: ExportManifest = {
    accounts,
    attachmentCount: totalAttachments,
    chatCount: chats.length,
    completedAt: new Date().toISOString(),
    createdAt: startedAt,
    messageCount: totalMessages,
    version: 1,
  }
  await writeJSONAtomic(join(options.outDir, 'manifest.json'), manifest)
  progress(options, `Done: ${manifest.chatCount} chats, ${manifest.messageCount} messages, ${manifest.attachmentCount} attachments`)
  return manifest
}

async function collectChats(client: any, options: ExportOptions): Promise<Chat[]> {
  if (options.chatIDs?.length) {
    return Promise.all(options.chatIDs.map(chatID =>
      client.chats.retrieve(chatID, { maxParticipantCount: 0 }) as Promise<Chat>,
    ))
  }

  const chats: Chat[] = []
  for await (const chat of client.chats.list({ accountIDs: options.accountIDs })) {
    chats.push(chat)
    if (options.limitChats && chats.length >= options.limitChats) break
  }
  return chats
}

async function exportChatMessages(
  client: any,
  chat: Chat,
  chatDir: string,
  state: ExportState,
  statePath: string,
  options: ExportOptions,
): Promise<{ attachmentCount: number; attachments: AttachmentExport[]; messages: Message[] }> {
  const chatID = chat.id
  const partialPath = join(chatDir, 'messages.partial.jsonl')
  const existing = await readJSONL<Message>(partialPath)
  const seen = new Set(existing.map(message => message.id))
  const chatState = state.chats[chatID]!
  let cursor = chatState.cursor
  let messagesWritten = existing.length
  let attachmentCount = chatState.attachmentCount

  await mkdir(dirname(partialPath), { recursive: true })
  const partialHandle = await open(partialPath, 'a')
  let attachmentManifestHandle: FileHandle | undefined
  const writeAttachmentEntry = async (entry: AttachmentExport): Promise<void> => {
    if (!attachmentManifestHandle) {
      const manifestPath = join(chatDir, 'attachments', 'attachments.jsonl')
      await mkdir(dirname(manifestPath), { recursive: true })
      attachmentManifestHandle = await open(manifestPath, 'a')
    }
    await attachmentManifestHandle.appendFile(`${JSON.stringify(entry)}\n`)
  }

  try {
    while (true) {
      const page = await client.messages.list(chatID, cursor ? { cursor } : undefined)
      const items = page.items as Message[]
      if (!items.length) break

      for (const message of items) {
        if (seen.has(message.id)) continue

        if (options.downloadAttachments) {
          const downloaded = await downloadMessageAttachments(client, chatDir, message, writeAttachmentEntry)
          attachmentCount += downloaded
        }

        await partialHandle.appendFile(`${JSON.stringify(message)}\n`)
        seen.add(message.id)
        existing.push(message)
        messagesWritten += 1
        chatState.attachmentCount = attachmentCount
        await writeJSONAtomic(statePath, state)

        if (options.limitMessages && messagesWritten >= options.limitMessages) break
      }

      cursor = page.oldestCursor ?? null
      chatState.cursor = cursor
      chatState.messageCount = messagesWritten
      chatState.attachmentCount = attachmentCount
      chatState.updatedAt = new Date().toISOString()
      await writeJSONAtomic(statePath, state)
      progress(options, `  ${chatTitle(chat)}: ${messagesWritten} messages${options.downloadAttachments ? `, ${attachmentCount} attachments` : ''}`)

      if (options.limitMessages && messagesWritten >= options.limitMessages) break
      if (!page.hasMore || !cursor) break
    }
  } finally {
    await partialHandle.close()
    if (attachmentManifestHandle) await attachmentManifestHandle.close()
  }

  existing.sort((a, b) => String(a.sortKey || a.timestamp).localeCompare(String(b.sortKey || b.timestamp)))
  const allAttachments = await readJSONL<AttachmentExport>(join(chatDir, 'attachments', 'attachments.jsonl'))
  return { attachmentCount, attachments: allAttachments, messages: existing }
}

async function downloadMessageAttachments(
  client: any,
  chatDir: string,
  message: Message,
  writeEntry: (entry: AttachmentExport) => Promise<void>,
): Promise<number> {
  const attachments = message.attachments ?? []
  let count = 0
  for (const [index, attachment] of attachments.entries()) {
    const sourceURL = attachment.id || attachment.srcURL
    if (sourceURL) {
      const path = await downloadURL(client, sourceURL, chatDir, message.id, index, attachment.fileName, attachment.mimeType)
      if (path) {
        await writeEntry({ attachment, index, kind: 'attachment', messageID: message.id, path, sourceURL })
        count += 1
      }
    }

    if (attachment.posterImg) {
      const path = await downloadURL(client, attachment.posterImg, chatDir, message.id, index, `poster-${attachment.fileName ?? index}`, undefined)
      if (path) {
        await writeEntry({ attachment, index, kind: 'poster', messageID: message.id, path, sourceURL: attachment.posterImg })
        count += 1
      }
    }
  }

  return count
}

async function downloadURL(
  client: any,
  sourceURL: string,
  chatDir: string,
  messageID: string,
  index: number,
  fileName?: string,
  mimeType?: string,
): Promise<string | undefined> {
  const target = join('attachments', safeSegment(messageID), `${String(index + 1).padStart(2, '0')}-${safeFileName(fileName || fileNameFromURL(sourceURL, mimeType))}`)
  const absoluteTarget = join(chatDir, target)
  if (await exists(absoluteTarget)) return target

  await mkdir(join(chatDir, 'attachments', safeSegment(messageID)), { recursive: true })
  if (sourceURL.startsWith('file://')) {
    await copyFile(fileURLToPath(sourceURL), absoluteTarget)
    return target
  }
  if (sourceURL.startsWith('/')) {
    await copyFile(sourceURL, absoluteTarget)
    return target
  }

  const response = sourceURL.startsWith('mxc://') || sourceURL.startsWith('localmxc://')
    ? await client.assets.serve({ url: sourceURL })
    : await fetch(sourceURL)
  if (!response.ok) throw new Error(`Failed to download ${sourceURL}: HTTP ${response.status}`)
  await writeResponseBody(response, absoluteTarget)
  return target
}

async function writeResponseBody(response: Response, path: string): Promise<void> {
  if (!response.body) {
    await writeFile(path, Buffer.from(await response.arrayBuffer()))
    return
  }

  const stream = createWriteStream(path)
  await new Promise<void>((resolve, reject) => {
    stream.on('error', reject)
    stream.on('finish', resolve)
    const reader = response.body!.getReader()
    const pump = (): void => {
      reader.read().then(({ done, value }) => {
        if (done) {
          stream.end()
          return
        }
        stream.write(Buffer.from(value), error => {
          if (error) reject(error)
          else pump()
        })
      }, reject)
    }
    pump()
  })
}

function renderMarkdown(chat: Chat, messages: Message[], attachments: AttachmentExport[]): string {
  const byMessage = attachmentsByMessage(attachments)

  const lines = [
    `# ${escapeMarkdown(chat.title || chat.id)}`,
    '',
    `- Chat ID: \`${chat.id}\``,
    `- Account ID: \`${chat.accountID}\``,
    `- Network: ${escapeMarkdown(chat.network ?? '')}`,
    `- Type: ${chat.type}`,
    `- Messages: ${messages.length}`,
    '',
    '## Messages',
    '',
  ]

  for (const message of messages) {
    const sender = message.senderName || message.senderID || 'Unknown sender'
    lines.push(`### ${escapeMarkdown(sender)} - ${message.timestamp}`)
    if (message.text) lines.push('', message.text)
    const messageAttachments = byMessage.get(message.id) ?? []
    for (const item of messageAttachments) {
      lines.push('', `- [${escapeMarkdown(item.attachment.fileName || item.kind)}](${encodeURI(item.path)})`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function renderHTML(chat: Chat, messages: Message[], attachments: AttachmentExport[]): string {
  const byMessage = attachmentsByMessage(attachments)

  const rows = messages.map(message => {
    const sender = message.senderName || message.senderID || 'Unknown sender'
    const messageAttachments = byMessage.get(message.id) ?? []
    const attachmentsHTML = messageAttachments.length
      ? `<ul class="attachments">${messageAttachments.map(item => `<li><a href="${escapeAttribute(item.path)}">${escapeHTML(item.attachment.fileName || item.kind)}</a></li>`).join('')}</ul>`
      : ''
    return [
      '<article class="message">',
      `  <header><strong>${escapeHTML(sender)}</strong><time datetime="${escapeAttribute(message.timestamp)}">${escapeHTML(message.timestamp)}</time></header>`,
      message.text ? `  <div class="body">${formatMessageHTML(message.text)}</div>` : '',
      attachmentsHTML,
      '</article>',
    ].filter(Boolean).join('\n')
  }).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(chat.title || chat.id)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; margin: 0; color: CanvasText; background: Canvas; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .meta { color: color-mix(in srgb, CanvasText 70%, Canvas); display: grid; gap: 4px; margin: 0 0 28px; }
    .message { border-top: 1px solid color-mix(in srgb, CanvasText 18%, Canvas); padding: 16px 0; }
    header { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; margin-bottom: 8px; }
    time { color: color-mix(in srgb, CanvasText 62%, Canvas); font-size: 13px; }
    .body { overflow-wrap: anywhere; }
    .attachments { margin: 10px 0 0; padding-left: 22px; }
    a { color: LinkText; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHTML(chat.title || chat.id)}</h1>
    <section class="meta" aria-label="Chat metadata">
      <span>Chat ID: <code>${escapeHTML(chat.id)}</code></span>
      <span>Account ID: <code>${escapeHTML(chat.accountID)}</code></span>
      <span>Network: ${escapeHTML(chat.network ?? '')}</span>
      <span>Type: ${escapeHTML(chat.type)}</span>
      <span>Messages: ${messages.length}</span>
    </section>
    <section class="messages">
${indent(rows, 6)}
    </section>
  </main>
</body>
</html>
`
}

function attachmentsByMessage(attachments: AttachmentExport[]): Map<string, AttachmentExport[]> {
  const byMessage = new Map<string, AttachmentExport[]>()
  for (const attachment of attachments) {
    const list = byMessage.get(attachment.messageID) ?? []
    list.push(attachment)
    byMessage.set(attachment.messageID, list)
  }
  return byMessage
}

async function readJSONL<T>(path: string): Promise<T[]> {
  try {
    const content = await readFile(path, 'utf8')
    return content.split('\n').filter(Boolean).map(line => JSON.parse(line) as T)
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

async function readState(path: string): Promise<ExportState> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as ExportState
  } catch (error: any) {
    if (error?.code === 'ENOENT') return createState()
    throw error
  }
}

function createState(): ExportState {
  return {
    chats: {},
    completedChatIDs: [],
    createdAt: new Date().toISOString(),
    exportVersion: 1,
  }
}

async function writeJSONAtomic(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  await writeFile(tmp, content)
  await rename(tmp, path)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function safeSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return normalized.slice(0, 120) || 'item'
}

function safeFileName(value: string): string {
  const normalized = basename(value).replace(/[/\\?%*:|"<>]+/g, '_').trim()
  return normalized.slice(0, 160) || 'attachment'
}

function fileNameFromURL(url: string, mimeType?: string): string {
  try {
    const parsed = new URL(url)
    const name = basename(parsed.pathname)
    if (name) return name
  } catch { /* fall through */ }
  return `attachment${extensionForMimeType(mimeType)}`
}

const mimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
}

function extensionForMimeType(mimeType?: string): string {
  if (!mimeType) return ''
  if (mimeExtensions[mimeType]) return mimeExtensions[mimeType]!
  const subtype = mimeType.split('/')[1]
  return subtype && !subtype.includes('+') ? `.${subtype}` : ''
}

function chatTitle(chat: Pick<Chat, 'id' | 'network' | 'title'>): string {
  return `${chat.title || chat.id}${chat.network ? ` (${chat.network})` : ''}`
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+.!|-])/g, '\\$1')
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHTML(encodeURI(value))
}

function formatMessageHTML(value: string): string {
  return escapeHTML(value).replaceAll('\n', '<br>')
}

function indent(value: string, spaces: number): string {
  const padding = ' '.repeat(spaces)
  return value.split('\n').map(line => line ? `${padding}${line}` : line).join('\n')
}

function progress(options: ExportOptions, message: string): void {
  options.onProgress?.(message)
}

import { AbortError, CLIError, ExitCodes } from '../lib/errors.js'
import type { CommandSpec, GlobalFlags } from './types.js'

type ErrorShape = {
  code: string
  exitCode: number
  hint?: string
  kind: 'abort' | 'bug'
  message: string
}

export function writeResult(value: unknown, flags: GlobalFlags, command?: CommandSpec): void {
  if (value === undefined) return
  if (flags.json) {
    const source = command?.path.join(' ') === 'docs' ? { success: true, data: value, error: null } : value
    const transformed = command?.rawJson
      ? source
      : flags.resultsOnly
        ? primaryResult(flags.select ? selectFields(source, flags.select) : source, command)
        : flags.select
          ? selectFields(source, flags.select)
          : source
    const data = flags.wrapUntrusted && !command?.rawJson ? wrapUntrusted(transformed) : transformed
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
  } else writeText(value, flags.plain, command, flags.full)
}

export function writeEvent(event: string, data: Record<string, unknown> = {}): void {
  process.stderr.write(`${JSON.stringify({ event, data, ts: Date.now() })}\n`)
}

function formatError(error: unknown): ErrorShape {
  const err = normalizeError(error)
  const isBug = !(err instanceof CLIError)
  const exitCode = err instanceof CLIError ? err.exitCode : ExitCodes.Generic
  return {
    code: err instanceof CLIError && err.code ? err.code : errorCode(exitCode, isBug),
    exitCode,
    hint: err instanceof CLIError ? err.tryMessage : undefined,
    kind: isBug ? 'bug' : 'abort',
    message: err.message,
  }
}

export function writeError(error: unknown, flags: Pick<GlobalFlags, 'events' | 'json'>): number {
  const formatted = formatError(error)
  if (flags.events) {
    writeEvent('error', formatted)
    return formatted.exitCode
  }
  if (flags.json) {
    process.stderr.write(`${JSON.stringify({ error: formatted })}\n`)
    return formatted.exitCode
  }
  process.stderr.write(`${sanitizeHuman(formatted.message)}\n`)
  if (formatted.hint) process.stderr.write(`${sanitizeHuman(formatted.hint)}\n`)
  return formatted.exitCode
}

export function usage(message: string, hint?: string): AbortError {
  return new AbortError(message, ExitCodes.Usage, hint, 'usage_error')
}

function sanitizeHuman(value: string): string {
  let out = ''
  let inEscape = false
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (inEscape) {
      if (code >= 0x40 && code <= 0x7e) inEscape = false
      continue
    }
    if (char === '\x1b') {
      inEscape = true
      if (!out.endsWith(' ')) out += ' '
      continue
    }
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      if (!out.endsWith(' ')) out += ' '
      continue
    }
    out += char
  }
  return out.trim()
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error))
}

function errorCode(code: number, isBug: boolean): string {
  if (isBug) return 'internal_error'
  if (code === ExitCodes.EmptyResults) return 'empty_results'
  if (code === ExitCodes.AuthRequired) return 'auth_required'
  if (code === ExitCodes.CommandNotFound) return 'command_not_found'
  if (code === ExitCodes.NotFound) return 'not_found'
  if (code === ExitCodes.NotReady) return 'not_ready'
  if (code === ExitCodes.Usage) return 'usage_error'
  return 'runtime_error'
}

function writeText(value: unknown, plain = false, command?: CommandSpec, full = false): void {
  if (value === undefined) return
  if (command) {
    const handled = writeCommandText(value, plain, command, full)
    if (handled) return
  }
  if (Array.isArray(value)) {
    if (value.every(isRecord)) {
      writeTable(value, Object.keys(value[0] ?? {}).slice(0, 8), plain, full)
      return
    }
    for (const item of value) writeText(item, plain, undefined, full)
    return
  }
  if (!value || typeof value !== 'object') {
    process.stdout.write(`${String(value ?? '')}\n`)
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue
    const cell = humanCell(item)
    process.stdout.write(plain ? `${key}\t${cell.replaceAll('\n', '\\n').replaceAll('\t', '\\t')}\n` : `${key}: ${cell}\n`)
  }
}

function writeCommandText(value: unknown, plain: boolean, command: CommandSpec, full: boolean): boolean {
  if (command.path.join(' ') === 'version' && isRecord(value) && value.version !== undefined) {
    process.stdout.write(`${escapePlain(humanCell(value.version))}\n`)
    return true
  }
  if (plain && command.path.join(' ') === 'config get' && isRecord(value) && 'value' in value) {
    process.stdout.write(`${escapePlain(humanCell(value.value))}\n`)
    return true
  }
  if (plain && command.path.join(' ') === 'config path' && isRecord(value) && 'path' in value) {
    process.stdout.write(`${escapePlain(humanCell(value.path))}\n`)
    return true
  }
  if (plain && command.path.join(' ') === 'config keys' && isRecord(value) && Array.isArray(value.keys)) {
    for (const key of value.keys) process.stdout.write(`${escapePlain(humanCell(key))}\n`)
    return true
  }
  if (plain && command.path.join(' ') === 'config set' && isRecord(value) && value.key !== undefined) {
    process.stdout.write(`Set ${escapePlain(humanCell(value.key))} = ${escapePlain(humanCell(value.value))}\n`)
    return true
  }
  if (plain && command.path.join(' ') === 'config unset' && isRecord(value) && value.key !== undefined) {
    process.stdout.write(`Unset ${escapePlain(humanCell(value.key))}\n`)
    return true
  }
  if (command.path.join(' ') === 'exit-codes' && isRecord(value) && isRecord(value.exit_codes)) {
    writeKeyValueMap(value.exit_codes, plain)
    return true
  }
  const kind = command.output
  if (kind === 'targets') {
    const targetRows = Array.isArray(value)
      ? value
      : isRecord(value) && Array.isArray(value.targets)
        ? value.targets
        : undefined
    if (!targetRows) return false
    writeTable(targetRows.filter(isRecord), ['id', 'default', 'type', 'reachable', 'name', 'baseURL', 'version', 'error'], plain, full, {
      baseURL: 'URL',
      id: 'ID',
    })
    return true
  }
  if (kind === 'auth') {
    const authRows = Array.isArray(value)
      ? value
      : isRecord(value) && Array.isArray(value.accounts)
        ? value.accounts
        : undefined
    if (!authRows) return false
    writeTable(authRows.filter(isRecord), ['target', 'default', 'authenticated', 'source', 'expiresAt', 'clientID', 'scope', 'baseURL'], plain, full, {
      baseURL: 'URL',
      clientID: 'CLIENT',
    })
    return true
  }
  if ((kind === 'accounts' || kind === 'chats' || kind === 'contacts' || kind === 'messages') && Array.isArray(value)) {
    const rows = value.filter(isRecord)
    const keys = preferredColumns(kind, rows)
    writeTable(rows, keys, plain, full)
    return true
  }
  if (kind === 'status' && isRecord(value)) {
    writeStatus(value, plain)
    return true
  }
  if (kind === 'diagnostic' && isRecord(value)) {
    writeDiagnostic(value, plain)
    return true
  }
  return false
}

function preferredColumns(kind: NonNullable<CommandSpec['output']>, rows: Record<string, unknown>[]): string[] {
  if (kind === 'accounts') return firstPresent(rows, ['accountID', 'id', 'default', 'displayName', 'network', 'status'])
  if (kind === 'chats') return firstPresent(rows, ['localChatID', 'chatID', 'title', 'accountID', 'type', 'unreadCount', 'isMuted', 'isArchived', 'isPinned'])
  if (kind === 'contacts') return firstPresent(rows, ['userID', 'id', 'displayName', 'name', 'accountID', 'phoneNumber', 'email'])
  if (kind === 'messages') return firstPresent(rows, ['timestamp', 'date', 'chatID', 'senderID', 'messageID', 'text', 'body'])
  return Object.keys(rows[0] ?? {}).slice(0, 8)
}

function firstPresent(rows: Record<string, unknown>[], preferred: string[]): string[] {
  const available = new Set(rows.flatMap(row => Object.keys(row)))
  const selected = preferred.filter(key => available.has(key))
  return selected.length ? selected : Object.keys(rows[0] ?? {}).slice(0, 8)
}

function writeStatus(value: Record<string, unknown>, plain: boolean): void {
  const target = isRecord(value.target) ? value.target : {}
  const auth = isRecord(value.auth) ? value.auth : {}
  const config = isRecord(value.config) ? value.config : {}
  const live = isRecord(value.live) ? value.live : {}
  const readiness = isRecord(value.readiness) ? value.readiness : {}
  writeDiagnostic({
    target: target.id,
    name: target.name,
    type: target.type,
    url: target.baseURL,
    reachable: live.reachable,
    version: live.version,
    authenticated: auth.authenticated,
    auth_source: auth.source,
    config: config.path,
    default_account: config.defaultAccount,
    readiness: readiness.state,
    next: readiness.message,
  }, plain)
}

function writeDiagnostic(value: Record<string, unknown>, plain: boolean): void {
  if (plain) {
    const flattened = flatPlainMap(value)
    if (Object.keys(flattened).length) {
      writeKeyValueMap(flattened, true)
      return
    }
  }
  const rows = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => ({ key, label: key.replaceAll('_', ' ').toUpperCase(), value: humanCell(item) }))
  if (plain) {
    for (const row of rows) process.stdout.write(`${row.key}\t${escapePlain(row.value)}\n`)
    return
  }
  const width = Math.max(4, ...rows.map(row => row.label.length)) + 2
  for (const row of rows) process.stdout.write(`${row.label.padEnd(width)}${row.value}\n`)
}

function writeKeyValueMap(value: Record<string, unknown>, plain: boolean): void {
  for (const [key, item] of Object.entries(value).filter(([, item]) => item !== undefined)) {
    const cell = escapePlain(humanCell(item))
    process.stdout.write(plain ? `${key}\t${cell}\n` : `${key}: ${cell}\n`)
  }
}

function flatPlainMap(value: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (isRecord(item)) Object.assign(out, flatPlainMap(item, path))
    else out[path] = item
  }
  return out
}

function writeTable(rows: Record<string, unknown>[], columns: string[], plain: boolean, full: boolean, labels: Record<string, string> = {}): void {
  const cleanRows = rows.map(row => Object.fromEntries(columns.map(key => [key, tableCell(row[key], plain || full)])))
  const headings = columns.map(key => labels[key] ?? key.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toUpperCase())
  if (plain) {
    process.stdout.write(`${columns.join('\t')}\n`)
    for (const row of cleanRows) process.stdout.write(`${columns.map(key => escapePlain(String(row[key] ?? ''))).join('\t')}\n`)
    return
  }
  const widths = columns.map((key, index) => Math.max(headings[index]!.length, ...cleanRows.map(row => String(row[key] ?? '').length)))
  process.stdout.write(`${headings.map((heading, index) => heading.padEnd(widths[index]!)).join('  ')}\n`)
  for (const row of cleanRows) {
    process.stdout.write(`${columns.map((key, index) => String(row[key] ?? '').padEnd(widths[index]!)).join('  ')}\n`)
  }
}

function tableCell(value: unknown, full: boolean): string {
  const cell = humanCell(value).replaceAll(/\s+/g, ' ').trim()
  return full || cell.length <= 80 ? cell : `${cell.slice(0, 77)}...`
}

function escapePlain(value: string): string {
  return value.replaceAll('\n', '\\n').replaceAll('\t', '\\t')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function humanCell(value: unknown): string {
  if (Array.isArray(value)) return value.map(humanCell).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value ?? '')
}

function primaryResult(value: unknown, command?: CommandSpec): unknown {
  if (!isRecord(value)) return value
  const commandPath = command?.path.join(' ')
  if (commandPath === 'status' || commandPath === 'auth status') return value
  if (commandPath === 'config path' && value.path !== undefined) return value.path
  if (commandPath === 'config keys' && value.keys !== undefined) return value.keys
  for (const key of ['data', 'items', 'messages', 'chats', 'accounts', 'contacts', 'services', 'targets', 'target', 'result']) {
    if (value[key] !== undefined) return value[key]
  }
  return value
}

function selectFields(value: unknown, fields: string): unknown {
  const paths = fields.split(',').map(field => field.trim()).filter(Boolean)
  if (!paths.length) return value
  if (Array.isArray(value)) return value.map(item => selectFields(item, fields))
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const path of paths) {
    const selected = getPath(value, path)
    if (selected !== undefined) setPath(out, path, selected)
  }
  return out
}

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => isRecord(current) ? current[part] : undefined, value)
}

function setPath(out: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = out
  for (const part of parts.slice(0, -1)) {
    current = current[part] && typeof current[part] === 'object' && !Array.isArray(current[part])
      ? current[part] as Record<string, unknown>
      : current[part] = {}
  }
  current[parts.at(-1)!] = value
}

export function wrapUntrusted(value: unknown): unknown {
  return wrapValue(value, [])
}

function wrapValue(value: unknown, path: string[]): unknown {
  if (Array.isArray(value)) return value.map(item => wrapValue(item, path))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    let wrapped = false
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = wrapValueForKey(item, [...path, key], key)
      if (next !== item) wrapped = true
      out[key] = next
    }
    if (path.length === 0 && wrapped) out.externalContent = { source: 'beeper_api', untrusted: true, wrapped: true }
    return out
  }
  return value
}

function wrapValueForKey(value: unknown, path: string[], key: string): unknown {
  if (typeof value === 'string' && shouldWrapString(path, key, value)) {
    return wrapText(value)
  }
  return wrapValue(value, path)
}

function shouldWrapString(path: string[], key: string, value: string): boolean {
  if (!value) return false
  const normalized = key.replaceAll(/[-_]/g, '').toLowerCase()
  if (['id', 'chatid', 'messageid', 'roomid', 'url', 'uri', 'createdat', 'updatedat', 'status'].includes(normalized)) return false
  if (['about', 'body', 'caption', 'description', 'displayname', 'message', 'name', 'subject', 'text', 'title', 'topic', 'value'].includes(normalized)) return true
  return path.some(part => ['messages', 'rows', 'values'].includes(part.replaceAll(/[-_]/g, '').toLowerCase()))
}

function wrapText(value: string): string {
  const sanitized = value
    .replaceAll(/<<<\s*(?:END[\s_]+)?EXTERNAL[\s_]+UNTRUSTED[\s_]+CONTENT[^>]*>>>/gi, '[[UNTRUSTED_MARKER_SANITIZED]]')
    .replaceAll(/<\|[^>]+?\|>/g, '[REMOVED_SPECIAL_TOKEN]')
  return `<<<EXTERNAL_UNTRUSTED_CONTENT source="beeper_api">>>\n${sanitized}\n<<<END_EXTERNAL_UNTRUSTED_CONTENT source="beeper_api">>>`
}

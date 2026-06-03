import { AbortError, CLIError, ExitCodes } from '../lib/errors.js'
import type { GlobalFlags } from './types.js'

type ErrorShape = {
  code: string
  exitCode: number
  hint?: string
  kind: 'abort' | 'bug'
  message: string
}

export function writeResult(value: unknown, flags: GlobalFlags): void {
  if (value === undefined) return
  if (flags.json) process.stdout.write(`${JSON.stringify(flags.wrapUntrusted ? wrapUntrusted(value) : value, null, 2)}\n`)
  else writeText(value, flags.plain)
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
  if (formatted.hint) process.stderr.write(`hint: ${sanitizeHuman(formatted.hint)}\n`)
  return formatted.exitCode
}

export function usage(message: string): AbortError {
  return new AbortError(message, ExitCodes.Usage, undefined, 'usage_error')
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
  if (code === ExitCodes.AuthRequired) return 'auth_required'
  if (code === ExitCodes.CommandNotFound) return 'command_not_found'
  if (code === ExitCodes.NotFound) return 'not_found'
  if (code === ExitCodes.NotReady) return 'not_ready'
  if (code === ExitCodes.Usage) return 'usage_error'
  return 'runtime_error'
}

function writeText(value: unknown, plain = false): void {
  if (value === undefined) return
  if (Array.isArray(value)) {
    for (const item of value) writeText(item, plain)
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

function humanCell(value: unknown): string {
  if (Array.isArray(value)) return value.map(humanCell).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value ?? '')
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

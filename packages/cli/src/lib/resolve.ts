import { apiItems, apiRecord, type APIRecord } from './api-values.js'
import { readConfig } from './targets.js'
import { AbortError, CLIError, ExitCodes } from './errors.js'
import { collectPage } from './paging.js'
import { promptConfirm } from './prompts.js'

type AccountResolutionOptions = {
  allowMultiplePerInput?: boolean
  applyDefault?: boolean
}

type ChatResolutionOptions = {
  accountIDs?: string[]
  noInput?: boolean
  pick?: number
}

export async function resolveAccountIDs(
  client: any,
  inputs?: string[],
  options: AccountResolutionOptions = {},
): Promise<string[] | undefined> {
  let effectiveInputs = inputs
  if (!effectiveInputs?.length && options.applyDefault !== false) {
    const config = await readConfig()
    if (config.defaultAccount) effectiveInputs = [config.defaultAccount]
  }
  if (!effectiveInputs?.length) return undefined

  const accounts = apiItems(await client.accounts.list())
  const resolved: string[] = []
  for (const input of effectiveInputs) {
    const matches = matchAccounts(accounts, input)
    if (matches.length === 0) {
      throw new AbortError(`No account matches "${input}"`, ExitCodes.NotFound, undefined, 'not_found')
    }
    if (matches.length > 1 && !options.allowMultiplePerInput) {
      throw new AbortError(formatAmbiguous(`account "${input}"`, matches.map(formatAccount)), ExitCodes.Ambiguous, 'Pass an exact ID or --pick N.', 'ambiguous_selector')
    }
    resolved.push(...matches.map(accountIDOf).filter(Boolean))
  }

  return Array.from(new Set(resolved))
}

export async function resolveAccountID(client: any, input: string): Promise<string> {
  const [accountID] = await resolveAccountIDs(client, [input]) ?? []
  if (!accountID) {
    throw new AbortError(`No account matches "${input}"`, ExitCodes.NotFound, undefined, 'not_found')
  }
  return accountID
}

export async function listAccountIDs(client: any): Promise<string[]> {
  const accounts = apiItems(await client.accounts.list())
  return accounts.map(accountIDOf).filter(Boolean)
}

export async function resolveChatID(client: any, input: string, options: ChatResolutionOptions = {}): Promise<string> {
  if (input.startsWith('!')) return input
  const exact = await retrieveChat(client, input)
  if (exact) return chatInputID(exact)

  const candidates = await collectPage<APIRecord>(client.chats.search({
    accountIDs: options.accountIDs,
    query: input,
    scope: 'titles',
  }), 10)

  const normalizedInput = normalizeSelector(input)
  const exactMatches = candidates.filter(chat =>
    normalizeSelector(chat.id) === normalizedInput ||
    normalizeSelector(chat.localChatID) === normalizedInput ||
    normalizeSelector(chat.title) === normalizedInput
  )
  const matches = exactMatches.length ? exactMatches : candidates
  if (matches.length === 0) {
    const suggestion = await suggestChat(client, input, options)
    if (suggestion) return suggestion
    throw new AbortError(`No chat matches "${input}"`, ExitCodes.NotFound, undefined, 'not_found')
  }
  if (matches.length === 1) return chatInputID(matches[0]!)

  if (options.pick) {
    const selected = matches[options.pick - 1]
    if (!selected) {
      throw new AbortError(`--pick ${options.pick} is outside the ${matches.length} matching chats`, ExitCodes.NotFound, undefined, 'not_found')
    }
    return chatInputID(selected)
  }

  throw new AbortError(formatAmbiguous(`chat "${input}"`, matches.map(formatChat)), ExitCodes.Ambiguous, 'Pass an exact ID or --pick N.', 'ambiguous_selector')
}

async function suggestChat(client: any, input: string, options: ChatResolutionOptions): Promise<string | undefined> {
  if (options.noInput) return undefined
  let pool: APIRecord[]
  try {
    pool = await collectPage<APIRecord>(client.chats.list({ accountIDs: options.accountIDs, limit: 100 }), 100)
  } catch {
    return undefined
  }
  const ranked = rankSuggestions(input, pool, chat => typeof chat.title === 'string' ? chat.title : undefined)
  const top = ranked[0]
  if (!top) return undefined
  const detail = top.value.network ? ` (${top.value.network})` : ''
  const prompt = `No chat matches "${input}". Did you mean "${top.label}"${detail}?`
  process.stderr.write(`${prompt}\n`)
  for (const alt of ranked.slice(1)) {
    process.stderr.write(`  also: ${alt.label}${alt.value.network ? ` (${alt.value.network})` : ''}\n`)
  }
  const ok = process.stdin.isTTY && process.stderr.isTTY
    ? await promptConfirm('use it?', true, process.stderr)
    : false
  if (!ok) throw new CLIError(`no chat selected for "${input}"`, ExitCodes.CommandNotFound)
  return chatInputID(top.value)
}

type Suggestion<T> = { value: T; label: string; distance: number }

function rankSuggestions<T>(query: string, items: T[], labelOf: (item: T) => string | undefined): Suggestion<T>[] {
  const q = query.trim().toLowerCase()
  const scored: Suggestion<T>[] = []
  for (const item of items) {
    const label = labelOf(item)
    if (!label) continue
    const l = label.toLowerCase()
    const distance = Math.min(levenshtein(q, l), l.includes(q) ? Math.max(0, l.length - q.length) : Infinity)
    if (Number.isFinite(distance)) scored.push({ value: item, label, distance })
  }
  scored.sort((a, b) => a.distance - b.distance || a.label.length - b.label.length)
  const cutoff = Math.max(3, Math.ceil(q.length * 0.6))
  return scored.filter(suggestion => suggestion.distance <= cutoff).slice(0, 3)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) matrix[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost)
    }
  }
  return matrix[a.length]![b.length]!
}

function matchAccounts(accounts: APIRecord[], input: string): APIRecord[] {
  const normalizedInput = normalizeSelector(input)
  const exact = accounts.filter(account =>
    accountKeys(account).some(value => normalizeSelector(value) === normalizedInput)
  )
  if (exact.length) return exact

  return accounts.filter(account =>
    accountKeys(account).some(value => normalizeSelector(value).includes(normalizedInput))
  )
}

function accountKeys(account: APIRecord): unknown[] {
  const bridge = apiRecord(account.bridge)
  const user = apiRecord(account.user)
  return [
    account.accountID,
    account.network,
    bridge.type,
    bridge.id,
    user.id,
    user.username,
    user.displayName,
    user.name,
    user.email,
  ]
}

async function retrieveChat(client: any, input: string): Promise<APIRecord | undefined> {
  try {
    return await client.chats.retrieve(input, { maxParticipantCount: 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/not\s*found|404/i.test(message)) return undefined
    throw error
  }
}

export function normalizeSelector(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s._-]+/g, '')
}

function formatAmbiguous(label: string, choices: string[]): string {
  return `Ambiguous ${label}. Use an exact ID or --pick N:\n${choices.map((choice, index) => `  ${index + 1}. ${choice}`).join('\n')}`
}

function formatAccount(account: APIRecord): string {
  const bridge = apiRecord(account.bridge)
  const user = apiRecord(account.user)
  const network = account.network ? ` ${account.network}` : ''
  const bridgeName = bridge.type ? ` ${bridge.type}` : ''
  const userName = user.displayName || user.name || user.username || user.id || ''
  return `${accountIDOf(account) || account.id || ''}${network}${bridgeName}${userName ? ` ${userName}` : ''}`
}

function accountIDOf(account: APIRecord): string {
  return typeof account.accountID === 'string' && account.accountID
    ? account.accountID
    : typeof account.id === 'string' && account.id
      ? account.id
      : ''
}

function formatChat(chat: APIRecord): string {
  const network = chat.network ? ` ${chat.network}` : ''
  const local = chat.localChatID ? ` local:${chat.localChatID}` : ''
  return `${chat.id}${local}${network} ${chat.title ?? ''}`.trim()
}

function chatInputID(chat: APIRecord): string {
  return String(chat.localChatID || chat.id)
}

export function userQueryFromInput(input: string): APIRecord {
  const trimmed = input.trim()
  if (/^@[^:]+:.+/.test(trimmed)) return { id: trimmed, username: trimmed }
  if (trimmed.includes('@')) return { email: trimmed, username: trimmed }
  if (/^\+?[\d\s().-]{5,}$/.test(trimmed)) return { phoneNumber: trimmed }
  return { fullName: trimmed, username: trimmed, id: trimmed }
}

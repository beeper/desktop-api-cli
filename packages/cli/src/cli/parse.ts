import type { CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { usage } from './output.js'
import { AbortError, ExitCodes } from '../lib/errors.js'

type ParsedCommand = {
  command?: CommandSpec
  flags: Record<string, unknown>
  globalFlags: GlobalFlags
  helpOnly?: boolean
  positionals: string[]
}

export const globalFlagSpecs: FlagSpec[] = [
  { name: 'access-token', type: 'string', env: ['BEEPER_ACCESS_TOKEN'], description: 'Use provided access token directly (bypasses stored target auth)' },
  { name: 'account', aliases: ['acct'], short: 'a', type: 'string', multiple: true, env: ['BEEPER_ACCOUNT'], description: 'Account selector for account-aware commands' },
  { name: 'color', type: 'string', enum: ['auto', 'always', 'never'], default: 'auto', env: ['BEEPER_COLOR'], description: 'Color output: auto|always|never' },
  { name: 'disable-commands', type: 'string', env: ['BEEPER_DISABLE_COMMANDS'], description: 'Comma-separated command prefixes to block; dot paths allowed' },
  { name: 'dry-run', aliases: ['dryrun', 'noop', 'preview'], short: 'n', type: 'boolean', default: false, env: ['BEEPER_DRY_RUN'], description: 'Do not make changes; print intended actions and exit successfully' },
  { name: 'enable-commands', type: 'string', env: ['BEEPER_ENABLE_COMMANDS'], description: 'Comma-separated enabled command prefixes; dot paths allowed' },
  { name: 'enable-commands-exact', type: 'string', env: ['BEEPER_ENABLE_COMMANDS_EXACT'], description: 'Comma-separated exact enabled commands; parent commands do not enable children' },
  { name: 'events', type: 'boolean', default: false, env: ['BEEPER_EVENTS'], description: 'Emit machine-readable NDJSON lifecycle events on stderr' },
  { name: 'force', aliases: ['assume-yes', 'yes'], short: 'y', type: 'boolean', default: false, description: 'Skip confirmations for destructive commands' },
  { name: 'full', type: 'boolean', default: false, description: 'Disable truncation in human table output' },
  { name: 'help', short: 'h', type: 'boolean', default: false, description: 'Show context-sensitive help' },
  { name: 'home', aliases: ['store'], type: 'string', env: ['BEEPER_HOME', 'BEEPER_STORE_DIR', 'BEEPER_CLI_CONFIG_DIR'], description: 'Override Beeper CLI config/data/state/cache root' },
  { name: 'json', aliases: ['machine'], short: 'j', type: 'boolean', default: false, env: ['BEEPER_JSON'], description: 'Output JSON to stdout (best for scripting)' },
  { name: 'lock-wait', type: 'string', description: 'Accepted for compatibility; Beeper CLI does not use a local store lock' },
  { name: 'no-input', aliases: ['non-interactive', 'noninteractive'], type: 'boolean', default: false, description: 'Never prompt; fail instead (useful for CI)' },
  { name: 'plain', aliases: ['tsv'], short: 'p', type: 'boolean', default: false, env: ['BEEPER_PLAIN'], description: 'Output stable, parseable text to stdout (TSV-like; no colors)' },
  { name: 'read-only', aliases: ['readonly'], type: 'boolean', default: false, env: ['BEEPER_READONLY'], description: 'Reject commands that intentionally write Beeper or local CLI state' },
  { name: 'results-only', type: 'boolean', default: false, description: 'In JSON mode, emit only the primary result' },
  { name: 'safety-profile', type: 'string', description: 'Safety profile name or YAML path' },
  { name: 'select', aliases: ['fields', 'project'], type: 'string', env: ['BEEPER_SELECT', 'BEEPER_FIELDS', 'BEEPER_PROJECT'], description: 'In JSON mode, select comma-separated fields; dot paths allowed' },
  { name: 'target', type: 'string', env: ['BEEPER_TARGET'], description: 'Target name or URL' },
  { name: 'timeout', type: 'string', env: ['BEEPER_TIMEOUT'], description: 'Command timeout, for example 30s, 2m, 5m0s, or 1h30m' },
  { name: 'verbose', aliases: ['debug'], short: 'v', type: 'boolean', default: false, env: ['BEEPER_DEBUG'], description: 'Enable verbose logging' },
  { name: 'version', type: 'boolean', default: false, description: 'Print version and exit' },
  { name: 'wrap-untrusted', type: 'boolean', default: false, env: ['BEEPER_WRAP_UNTRUSTED'], description: 'In JSON/raw output, wrap fetched text fields in untrusted-content markers' },
]

export function parseCommand(argv: string[], commands: CommandSpec[]): ParsedCommand {
  const helpRequested = argv.includes('--help') || argv.includes('-h')
  const global = parseGlobalFlags(argv)
  const tokens = parseArgv(argv, globalFlagSpecs, { allowUnknownFlags: true }).positionals
  if (argv.includes('--version')) {
    const command = commands.find(item => item.path.join(' ') === 'version')
    if (command) return { command, flags: {}, globalFlags: global, positionals: [] }
  }
  if (argv[0] === '__complete') {
    const command = commands.find(item => item.path.join(' ') === '__complete')
    if (!command) throw commandNotFound('unknown command "__complete"')
    return {
      command,
      flags: { cword: completeCword(argv) },
      globalFlags: global,
      positionals: completeWordsFromArgv(argv),
    }
  }
  const pathTokens = tokens.filter(token => !token.startsWith('-'))
  if (pathTokens.length === 0) {
    return { flags: {}, globalFlags: global, helpOnly: true, positionals: [] }
  }

  const command = findCommand(commands, pathTokens)
  if (!command) {
    if (helpRequested && hasCommandPrefix(commands, pathTokens)) {
      return { command: virtualGroupCommand(pathTokens), flags: { help: true }, globalFlags: global, positionals: [] }
    }
    const suggestion = suggestCommand(commands, pathTokens)
    throw commandNotFound(`unknown command "${pathTokens.join(' ')}"${suggestion ? `, did you mean "${suggestion}"?` : ''}`)
  }
  const pathLength = matchedPathLength(command, pathTokens)
  const commandArgs = tokens.slice(pathLength)
  if (helpRequested) return { command, flags: { help: true }, globalFlags: global, positionals: commandArgs }

  const { flags, positionals } = parseArgv(commandArgs, command.flags ?? [])
  validateCommandInput(command, flags, positionals)
  return { command, flags, globalFlags: global, positionals }
}

function commandNotFound(message: string): AbortError {
  return new AbortError(message, ExitCodes.CommandNotFound, undefined, 'command_not_found')
}

function completeCword(argv: string[]): number {
  const index = argv.indexOf('--cword')
  if (index === -1) return -1
  const raw = argv[index + 1]
  const parsed = raw && /^-?\d+$/.test(raw) ? Number(raw) : NaN
  if (!Number.isSafeInteger(parsed)) throw usage('--cword must be an integer')
  return parsed
}

function completeWordsFromArgv(argv: string[]): string[] {
  const separator = argv.indexOf('--')
  if (separator !== -1) return argv.slice(separator + 1)
  const out: string[] = []
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--cword') {
      index += 1
      continue
    }
    out.push(argv[index]!)
  }
  return out
}

export function stringFlag(flags: Record<string, unknown>, name: string): string | undefined {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

export function requiredStringFlag(flags: Record<string, unknown>, name: string): string {
  const value = stringFlag(flags, name)
  if (!value) throw usage(`--${name} is required`)
  return value
}

export function numberFlag(flags: Record<string, unknown>, name: string, fallback: number): number {
  const value = flags[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function stringListFlag(flags: Record<string, unknown>, name: string): string[] {
  const value = flags[name]
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return typeof value === 'string' && value ? [value] : []
}

export function parseFlagValue(flag: FlagSpec, value: unknown): boolean | number | string {
  if (flag.type === 'integer') {
    const text = String(value).trim()
    const parsed = /^-?\d+$/.test(text) ? Number(text) : NaN
    if (!Number.isSafeInteger(parsed)) throw usage(`--${flag.name} must be an integer`)
    return parsed
  }
  const parsed = flag.type === 'boolean'
    ? typeof value === 'boolean' ? value : String(value) !== 'false'
    : String(value)
  if (flag.enum && !flag.enum.includes(String(parsed))) throw usage(`invalid argument "${String(parsed)}" for "--${flag.name}" flag: expected one of: ${flag.enum.join(', ')}`)
  return parsed
}

function parseGlobalFlags(argv: string[]): GlobalFlags {
  const raw = parseArgv(argv, globalFlagSpecs, { allowUnknownFlags: true }).flags
  const color = stringGlobal(raw, argv, 'color', 'BEEPER_COLOR', 'auto')
  if (!['auto', 'always', 'never'].includes(color)) throw usage(`invalid argument "${color}" for "--color" flag: expected one of: auto, always, never`)
  return {
    accessToken: stringGlobal(raw, argv, 'access-token', 'BEEPER_ACCESS_TOKEN') || undefined,
    account: stringListGlobal(raw, argv, 'account', 'BEEPER_ACCOUNT'),
    debug: boolGlobalAliases(raw, argv, ['verbose', 'debug'], 'BEEPER_DEBUG'),
    color: color as 'auto' | 'always' | 'never',
    disableCommands: stringGlobal(raw, argv, 'disable-commands', 'BEEPER_DISABLE_COMMANDS') || undefined,
    dryRun: boolGlobal(raw, argv, 'dry-run', 'BEEPER_DRY_RUN'),
    enableCommands: stringGlobal(raw, argv, 'enable-commands', 'BEEPER_ENABLE_COMMANDS') || undefined,
    enableCommandsExact: stringGlobal(raw, argv, 'enable-commands-exact', 'BEEPER_ENABLE_COMMANDS_EXACT') || undefined,
    events: boolGlobal(raw, argv, 'events', 'BEEPER_EVENTS'),
    force: raw.force === true,
    full: raw.full === true,
    home: stringGlobal(raw, argv, 'home', ['BEEPER_HOME', 'BEEPER_STORE_DIR', 'BEEPER_CLI_CONFIG_DIR']) || undefined,
    json: boolGlobal(raw, argv, 'json', 'BEEPER_JSON') || autoJSON(argv, raw),
    lockWait: typeof raw['lock-wait'] === 'string' && raw['lock-wait'] ? raw['lock-wait'] : undefined,
    noInput: raw['no-input'] === true,
    plain: boolGlobal(raw, argv, 'plain', 'BEEPER_PLAIN'),
    readOnly: boolGlobal(raw, argv, 'read-only', 'BEEPER_READONLY'),
    resultsOnly: raw['results-only'] === true,
    safetyProfile: typeof raw['safety-profile'] === 'string' && raw['safety-profile'] ? raw['safety-profile'] : undefined,
    select: stringGlobal(raw, argv, 'select', ['BEEPER_SELECT', 'BEEPER_FIELDS', 'BEEPER_PROJECT']) || undefined,
    target: stringGlobal(raw, argv, 'target', 'BEEPER_TARGET') || undefined,
    timeout: stringGlobal(raw, argv, 'timeout', 'BEEPER_TIMEOUT') || undefined,
    wrapUntrusted: boolGlobal(raw, argv, 'wrap-untrusted', 'BEEPER_WRAP_UNTRUSTED'),
  }
}

function boolGlobal(raw: Record<string, unknown>, argv: string[], name: string, envName: string): boolean {
  return raw[name] === true || (!hasNoFlag(argv, name) && envBool(envName))
}

function boolGlobalAliases(raw: Record<string, unknown>, argv: string[], names: string[], envName: string): boolean {
  return names.some(name => raw[name] === true) || (!names.some(name => hasNoFlag(argv, name)) && envBool(envName))
}

function autoJSON(argv: string[], raw: Record<string, unknown>): boolean {
  if (!envBool('BEEPER_AUTO_JSON')) return false
  if (hasNoFlag(argv, 'json') || raw.json === true || raw.plain === true) return false
  if (envBool('BEEPER_JSON') || envBool('BEEPER_PLAIN')) return false
  return !process.stdout.isTTY
}

function stringGlobal(raw: Record<string, unknown>, argv: string[], name: string, envName: string | string[], fallback = ''): string {
  if (typeof raw[name] === 'string' && raw[name]) return raw[name]
  if (hasLongFlag(argv, name)) return fallback
  for (const candidate of Array.isArray(envName) ? envName : [envName]) {
    const fromEnv = process.env[candidate]?.trim()
    if (fromEnv) return fromEnv
  }
  return fallback
}

function stringListGlobal(raw: Record<string, unknown>, argv: string[], name: string, envName: string): string[] | undefined {
  const value = raw[name]
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value) return [value]
  if (!hasLongFlag(argv, name) && process.env[envName]?.trim()) return splitEnvList(process.env[envName]!)
  return undefined
}

function splitEnvList(value: string): string[] | undefined {
  const items = value.split(',').map(item => item.trim()).filter(Boolean)
  return items.length ? items : undefined
}

function envBool(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function hasLongFlag(argv: string[], name: string): boolean {
  return argv.some(token => token === `--${name}` || token.startsWith(`--${name}=`) || token === `--no-${name}`)
}

function hasNoFlag(argv: string[], name: string): boolean {
  return argv.some(token => token === `--no-${name}` || token === `--${name}=false`)
}

function parseArgv(
  argv: string[],
  specs: FlagSpec[],
  options: { allowUnknownFlags?: boolean } = {},
): { flags: Record<string, unknown>; positionals: string[] } {
  const byName = flagMap(specs)
  const flags: Record<string, unknown> = {}
  const positionals: string[] = []
  for (const spec of specs) {
    if (spec.default !== undefined) flags[spec.name] = spec.default
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) continue
    if (token === '--') {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (!token.startsWith('-')) {
      positionals.push(token)
      continue
    }
    const parsed = flagToken(token)
    const noPrefix = parsed.name.startsWith('no-') ? parsed.name.slice(3) : undefined
    const spec = byName.get(parsed.name) ?? (noPrefix ? byName.get(noPrefix) : undefined)
    if (!spec) {
      if (!options.allowUnknownFlags) throw usage(`unknown flag --${parsed.name}`, 'Run with --help to see available flags')
      positionals.push(token)
      continue
    }
    if (spec.type === 'boolean') {
      const value = noPrefix && !byName.has(parsed.name) ? false : parsed.value === undefined ? true : parsed.value !== 'false'
      setFlag(flags, spec, parseFlagValue(spec, value))
      continue
    }
    const value = parsed.value ?? argv[index + 1]
    if (value === undefined || value.startsWith('-')) throw usage(missingFlagValueMessage(spec, value))
    setFlag(flags, spec, parseFlagValue(spec, value))
    if (parsed.value === undefined) index += 1
  }
  return { flags, positionals }
}

function missingFlagValueMessage(spec: FlagSpec, value: string | undefined): string {
  const expected = spec.type === 'integer' ? 'integer' : 'string'
  if (value === undefined) return `--${spec.name}: expected ${expected} value but got "EOL" (<EOL>)`
  return `--${spec.name}: expected ${expected} value but got "${value}"`
}

function findCommand(commands: CommandSpec[], tokens: string[]): CommandSpec | undefined {
  return commands
    .filter(command => commandPaths(command).some(path => path.every((part, index) => tokens[index] === part)))
    .sort((a, b) => matchedPathLength(b, tokens) - matchedPathLength(a, tokens))[0]
}

function hasCommandPrefix(commands: CommandSpec[], tokens: string[]): boolean {
  return commands.some(command => commandPaths(command).some(path => tokens.length < path.length && tokens.every((part, index) => path[index] === part)))
}

function virtualGroupCommand(path: string[]): CommandSpec {
  return {
    description: path.length === 1 ? rootNamespaceDescription(path[0]!) : `${path.join(' ')} commands`,
    path,
    risk: 'read',
    run: async () => undefined,
  }
}

function rootNamespaceDescription(name: string): string {
  const descriptions: Record<string, string> = {
    account: 'Manage connected chat accounts',
    accounts: 'Manage connected chat accounts',
    api: 'Call raw Beeper Desktop API endpoints',
    auth: 'Authenticate and manage stored credentials',
    chat: 'List and manage chats',
    chats: 'List and manage chats',
    config: 'Manage configuration',
    contact: 'List and search contacts',
    contacts: 'List and search contacts',
    group: 'List and manage group chats',
    groups: 'List and manage group chats',
    install: 'Install Beeper Desktop or Beeper Server',
    media: 'Download message media',
    messages: 'List, search, edit, and delete messages',
    presence: 'Send presence indicators',
    remove: 'Remove configured resources',
    resolve: 'Resolve Beeper selectors',
    search: 'Search Beeper',
    send: 'Send messages, files, reactions, and presence',
    target: 'Manage Beeper Desktop and Server targets',
    targets: 'Manage Beeper Desktop and Server targets',
    use: 'Select default resources',
  }
  return descriptions[name] ?? `${name} commands`
}

function matchedPathLength(command: CommandSpec, tokens: string[]): number {
  return commandPaths(command)
    .filter(path => path.every((part, index) => tokens[index] === part))
    .sort((a, b) => b.length - a.length)[0]?.length ?? command.path.length
}

function commandPaths(command: CommandSpec): string[][] {
  return [command.path, ...(command.aliases ?? [])]
}

function suggestCommand(commands: CommandSpec[], tokens: string[]): string | undefined {
  const parent = tokens.slice(0, -1)
  const input = tokens.at(-1)
  if (!input) return undefined
  const candidates = commands
    .flatMap(command => commandPaths(command))
    .filter(path => path.length >= tokens.length)
    .filter(path => !parent.length || parent.every((part, index) => path[index] === part))
    .map(path => ({ path, distance: editDistance(input, path[tokens.length - 1] ?? '') }))
    .filter(candidate => candidate.distance <= suggestionThreshold(input))
    .sort((a, b) => a.distance - b.distance || a.path.join(' ').localeCompare(b.path.join(' ')))
  return candidates[0]?.path.slice(0, tokens.length).join(' ')
}

function suggestionThreshold(input: string): number {
  return Math.max(1, Math.min(2, Math.ceil(input.length / 3)))
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length] ?? 0
}

function validatePositionals(command: CommandSpec, values: string[]): void {
  const args = command.args ?? []
  const required = args.filter(arg => arg.required).length
  const variadic = args.some(arg => arg.variadic)
  if (values.length < required) throw usage(`expected "${formatArgUsage(args[values.length])}"`)
  if (!variadic && values.length > args.length) throw usage(`unexpected argument ${values[args.length] ?? values.at(-1) ?? ''}`.trim())
}

function formatArgUsage(arg: { name: string; required?: boolean; variadic?: boolean } | undefined): string {
  if (!arg) return '<argument>'
  if (arg.variadic) return arg.required ? `<${arg.name}> ...` : `[<${arg.name}> ...]`
  return arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
}

export function validateCommandInput(command: CommandSpec, flags: Record<string, unknown>, positionals: string[]): void {
  validatePositionals(command, positionals)
  for (const flag of command.flags ?? []) {
    const value = flags[flag.name]
    if (flag.required && (value === undefined || value === '')) throw usage(`--${flag.name} is required`)
  }
}

function flagMap(specs: FlagSpec[]): Map<string, FlagSpec> {
  const out = new Map<string, FlagSpec>()
  for (const spec of specs) {
    out.set(spec.name, spec)
    if (spec.short) out.set(spec.short, spec)
    for (const alias of spec.aliases ?? []) out.set(alias, spec)
  }
  return out
}

function flagToken(token: string): { name: string; value?: string } {
  const trimmed = token.replace(/^-+/, '')
  const index = trimmed.indexOf('=')
  if (index === -1) return { name: trimmed }
  return { name: trimmed.slice(0, index), value: trimmed.slice(index + 1) }
}

function setFlag(out: Record<string, unknown>, spec: FlagSpec, value: boolean | number | string): void {
  if (!spec.multiple) {
    out[spec.name] = value
    return
  }
  const current = Array.isArray(out[spec.name]) ? out[spec.name] as unknown[] : []
  out[spec.name] = [...current, value]
}

import type { CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { usage } from './output.js'

type ParsedCommand = {
  command?: CommandSpec
  flags: Record<string, unknown>
  globalFlags: GlobalFlags
  helpOnly?: boolean
  positionals: string[]
}

export const globalFlagSpecs: FlagSpec[] = [
  { name: 'access-token', type: 'string', env: ['BEEPER_ACCESS_TOKEN'], description: 'Use provided access token directly' },
  { name: 'account', aliases: ['acct'], short: 'a', type: 'string', multiple: true, description: 'Account selector for account-aware commands' },
  { name: 'color', type: 'string', enum: ['auto', 'always', 'never'], default: 'auto', description: 'Color output: auto|always|never' },
  { name: 'debug', type: 'boolean', default: false },
  { name: 'disable-commands', type: 'string', description: 'Comma-separated command prefixes to block' },
  { name: 'dry-run', aliases: ['dryrun', 'noop', 'preview'], short: 'n', type: 'boolean', default: false, description: 'Do not make changes; print intended actions' },
  { name: 'enable-commands', type: 'string', description: 'Comma-separated enabled command prefixes' },
  { name: 'enable-commands-exact', type: 'string', description: 'Comma-separated exact enabled commands' },
  { name: 'events', type: 'boolean', default: false },
  { name: 'force', aliases: ['assume-yes', 'yes'], short: 'y', type: 'boolean', default: false, description: 'Skip confirmations for destructive commands' },
  { name: 'full', type: 'boolean', default: false, description: 'Disable truncation in human table output' },
  { name: 'home', type: 'string', env: ['BEEPER_CLI_CONFIG_DIR'], description: 'Override Beeper CLI config/data root' },
  { name: 'json', aliases: ['machine'], short: 'j', type: 'boolean', default: false, description: 'Output JSON to stdout' },
  { name: 'no-input', aliases: ['non-interactive', 'noninteractive'], type: 'boolean', default: false, description: 'Never prompt; fail instead' },
  { name: 'plain', aliases: ['tsv'], short: 'p', type: 'boolean', default: false, description: 'Output stable TSV-like text' },
  { name: 'read-only', type: 'boolean', default: false, env: ['BEEPER_READONLY'], description: 'Reject commands that intentionally write' },
  { name: 'results-only', type: 'boolean', default: false, description: 'In JSON mode, emit only the primary result' },
  { name: 'safety-profile', type: 'string', description: 'Safety profile name or YAML path' },
  { name: 'select', aliases: ['fields', 'project'], type: 'string', description: 'Select comma-separated JSON fields' },
  { name: 'target', type: 'string', description: 'Target name or URL' },
  { name: 'timeout', type: 'string', description: 'Command timeout, for example 30s or 2m' },
  { name: 'version', short: 'v', type: 'boolean', default: false, description: 'Print version and exit' },
  { name: 'wrap-untrusted', type: 'boolean', default: false, description: 'Wrap fetched text fields in untrusted-content markers' },
]

export function parseCommand(argv: string[], commands: CommandSpec[]): ParsedCommand {
  const helpRequested = argv.includes('--help') || argv.includes('-h')
  const global = parseGlobalFlags(argv)
  const tokens = parseArgv(argv, globalFlagSpecs, { allowUnknownFlags: true }).positionals
  if (argv.includes('--version') || argv.includes('-v')) {
    const command = commands.find(item => item.path.join(' ') === 'version')
    if (command) return { command, flags: {}, globalFlags: global, positionals: [] }
  }
  if (argv[0] === '__complete') {
    const command = commands.find(item => item.path.join(' ') === '__complete')
    if (!command) throw usage('unknown command "__complete"')
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
  if (!command) throw usage(`unknown command "${pathTokens.join(' ')}"`)
  const pathLength = matchedPathLength(command, pathTokens)
  const commandArgs = tokens.slice(pathLength)
  if (helpRequested) return { command, flags: { help: true }, globalFlags: global, positionals: commandArgs }

  const { flags, positionals } = parseArgv(commandArgs, command.flags ?? [])
  validateCommandInput(command, flags, positionals)
  return { command, flags, globalFlags: global, positionals }
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
  if (flag.enum && !flag.enum.includes(String(parsed))) throw usage(`--${flag.name} must be one of: ${flag.enum.join(', ')}`)
  return parsed
}

function parseGlobalFlags(argv: string[]): GlobalFlags {
  const raw = parseArgv(argv, globalFlagSpecs, { allowUnknownFlags: true }).flags
  const readOnlyFromEnv = envBool('BEEPER_READONLY')
  return {
    accessToken: typeof raw['access-token'] === 'string' && raw['access-token'] ? raw['access-token'] : undefined,
    account: Array.isArray(raw.account) ? raw.account.map(String).filter(Boolean) : typeof raw.account === 'string' && raw.account ? [raw.account] : undefined,
    debug: raw.debug === true,
    color: raw.color === 'always' || raw.color === 'never' ? raw.color : 'auto',
    disableCommands: typeof raw['disable-commands'] === 'string' && raw['disable-commands'] ? raw['disable-commands'] : undefined,
    dryRun: raw['dry-run'] === true,
    enableCommands: typeof raw['enable-commands'] === 'string' && raw['enable-commands'] ? raw['enable-commands'] : undefined,
    enableCommandsExact: typeof raw['enable-commands-exact'] === 'string' && raw['enable-commands-exact'] ? raw['enable-commands-exact'] : undefined,
    events: raw.events === true,
    force: raw.force === true,
    full: raw.full === true,
    home: typeof raw.home === 'string' && raw.home ? raw.home : undefined,
    json: raw.json === true,
    noInput: raw['no-input'] === true,
    plain: raw.plain === true,
    readOnly: raw['read-only'] === true || (!hasNoFlag(argv, 'read-only') && readOnlyFromEnv),
    resultsOnly: raw['results-only'] === true,
    safetyProfile: typeof raw['safety-profile'] === 'string' && raw['safety-profile'] ? raw['safety-profile'] : undefined,
    select: typeof raw.select === 'string' && raw.select ? raw.select : undefined,
    target: typeof raw.target === 'string' && raw.target ? raw.target : undefined,
    timeout: typeof raw.timeout === 'string' && raw.timeout ? raw.timeout : undefined,
    wrapUntrusted: raw['wrap-untrusted'] === true,
  }
}

function envBool(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
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
      if (!options.allowUnknownFlags) throw usage(`unknown flag --${parsed.name}`)
      positionals.push(token)
      continue
    }
    if (spec.type === 'boolean') {
      const value = noPrefix && !byName.has(parsed.name) ? false : parsed.value === undefined ? true : parsed.value !== 'false'
      setFlag(flags, spec, parseFlagValue(spec, value))
      continue
    }
    const value = parsed.value ?? argv[index + 1]
    if (value === undefined || value.startsWith('-')) throw usage(`--${spec.name} requires a value`)
    setFlag(flags, spec, parseFlagValue(spec, value))
    if (parsed.value === undefined) index += 1
  }
  return { flags, positionals }
}

function findCommand(commands: CommandSpec[], tokens: string[]): CommandSpec | undefined {
  return commands
    .filter(command => commandPaths(command).some(path => path.every((part, index) => tokens[index] === part)))
    .sort((a, b) => matchedPathLength(b, tokens) - matchedPathLength(a, tokens))[0]
}

function matchedPathLength(command: CommandSpec, tokens: string[]): number {
  return commandPaths(command)
    .filter(path => path.every((part, index) => tokens[index] === part))
    .sort((a, b) => b.length - a.length)[0]?.length ?? command.path.length
}

function commandPaths(command: CommandSpec): string[][] {
  return [command.path, ...(command.aliases ?? [])]
}

function validatePositionals(command: CommandSpec, values: string[]): void {
  const args = command.args ?? []
  const required = args.filter(arg => arg.required).length
  const variadic = args.some(arg => arg.variadic)
  if (values.length < required) throw usage(`${command.path.join(' ')} requires ${args[values.length]?.name ?? 'more arguments'}`)
  if (!variadic && values.length > args.length) throw usage(`${command.path.join(' ')} got too many arguments`)
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

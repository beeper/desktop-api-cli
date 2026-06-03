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
  { name: 'debug', type: 'boolean', default: false },
  { name: 'dry-run', type: 'boolean', default: false },
  { name: 'events', type: 'boolean', default: false },
  { name: 'force', type: 'boolean', default: false },
  { name: 'json', type: 'boolean', default: false },
  { name: 'no-input', type: 'boolean', default: false },
  { name: 'plain', type: 'boolean', default: false },
  { name: 'safety-profile', type: 'string', description: 'Safety profile name or YAML path' },
  { name: 'target', type: 'string' },
  { name: 'wrap-untrusted', type: 'boolean', default: false },
]

export function parseCommand(argv: string[], commands: CommandSpec[]): ParsedCommand {
  const helpRequested = argv.includes('--help')
  const global = parseGlobalFlags(argv)
  const tokens = parseArgv(argv, globalFlagSpecs, { allowUnknownFlags: true }).positionals
  const pathTokens = tokens.filter(token => !token.startsWith('-'))
  if (pathTokens.length === 0) {
    return { flags: {}, globalFlags: global, helpOnly: true, positionals: [] }
  }

  const command = findCommand(commands, pathTokens)
  if (!command) throw usage(`unknown command "${pathTokens.join(' ')}"`)
  const pathLength = command.path.length
  const commandArgs = tokens.slice(pathLength)
  if (helpRequested) return { command, flags: { help: true }, globalFlags: global, positionals: commandArgs }

  const { flags, positionals } = parseArgv(commandArgs, command.flags ?? [])
  validateCommandInput(command, flags, positionals)
  return { command, flags, globalFlags: global, positionals }
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
  return {
    debug: raw.debug === true,
    dryRun: raw['dry-run'] === true,
    events: raw.events === true,
    force: raw.force === true,
    json: raw.json === true,
    noInput: raw['no-input'] === true,
    plain: raw.plain === true,
    safetyProfile: typeof raw['safety-profile'] === 'string' && raw['safety-profile'] ? raw['safety-profile'] : undefined,
    target: typeof raw.target === 'string' && raw.target ? raw.target : undefined,
    wrapUntrusted: raw['wrap-untrusted'] === true,
  }
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
    .filter(command => command.path.every((part, index) => tokens[index] === part))
    .sort((a, b) => b.path.length - a.path.length)[0]
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
  for (const spec of specs) out.set(spec.name, spec)
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

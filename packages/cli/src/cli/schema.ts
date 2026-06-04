import type { ArgSpec, CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { globalFlagSpecs } from './parse.js'
import { commandVisible } from './policy.js'

type SchemaDoc = {
  schema_version: 1
  build: string
  command: SchemaNode
}

type SchemaNode = {
  alias_paths?: string[]
  aliases?: string[][]
  flags?: SchemaFlag[]
  help: string
  hidden?: boolean
  mcp?: boolean
  name: string
  output?: string
  path: string
  positionals?: SchemaArg[]
  primary_result_key?: string
  program_alias_paths?: string[]
  program_path?: string
  raw_json?: boolean
  requirements?: string[]
  risk?: string
  subcommands?: SchemaNode[]
  type: 'application' | 'command'
  usage?: string
}

type SchemaFlag = {
  aliases?: string[]
  default?: boolean | number | string
  envs?: string[]
  enum?: string[]
  has_default?: boolean
  help?: string
  multiple?: boolean
  name: string
  placeholder?: string
  required?: boolean
  short?: string
  type: string
}

type SchemaArg = {
  enum?: string[]
  help?: string
  name: string
  required?: boolean
  type: 'string'
  variadic?: boolean
}

export function buildSchema(commands: CommandSpec[], version: string, requested: string[] = [], flags?: GlobalFlags, options: { includeHidden?: boolean } = {}): SchemaDoc {
  const visible = commands.filter(command => visibleInSchema(command, flags, Boolean(options.includeHidden)))
  const prefix = normalizeRequestedPath(visible, requested)
  const prefixHasCanonicalChildren = prefix.length > 0 && visible.some(command =>
    command.path.length > prefix.length
    && command.path.slice(0, prefix.length).every((part, index) => part === prefix[index]))
  const includeAliasChildren = !prefixHasCanonicalChildren || prefix[0] === 'auth'
  const filtered = prefix.length
    ? visible.filter(command =>
      command.path.slice(0, prefix.length).every((part, index) => part === prefix[index])
      || (includeAliasChildren && (command.aliases ?? []).some(alias => alias.slice(0, prefix.length).every((part, index) => part === prefix[index]))))
    : visible
  return {
    schema_version: 1,
    build: version,
    command: nodeFor(filtered, prefix, prefix.length ? prefix.at(-1) ?? 'beeper' : 'beeper'),
  }
}

function visibleInSchema(command: CommandSpec, flags: GlobalFlags | undefined, includeHidden: boolean): boolean {
  const candidate = includeHidden ? { ...command, hidden: false } : command
  return flags ? commandVisible(candidate, flags) : includeHidden || !command.hidden
}

function normalizeRequestedPath(commands: CommandSpec[], requested: string[]): string[] {
  const parts = requested.flatMap(part => part.trim().split(/\s+/)).filter(Boolean)
  if (!parts.length) return []
  const matched = commands
    .flatMap(command => [command.path, ...(command.aliases ?? [])].map(path => ({ command, path })))
    .filter(item => item.path.join('.') === parts.join('.'))
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (matched) return matched.command.path
  if (parts.length === 1) {
    const canonical = canonicalNamespaceForAlias(parts[0]!)
    if (canonical) return [canonical]
  }
  return parts
}

function nodeFor(commands: CommandSpec[], prefix: string[], name: string): SchemaNode {
  const exact = commands.find(command => command.path.join('.') === prefix.join('.'))
  const exactAlias = exact ? undefined : commands.find(command => (command.aliases ?? []).some(alias => alias.join('.') === prefix.join('.')))
  const nodeCommand = exact ?? exactAlias
  const rootAliases = prefix.length === 0 ? rootAliasNodes(commands) : []
  const rootAliasNames = new Set(rootAliases.map(node => node.name))
  const childNames = new Set<string>()
  const hasCanonicalChildren = prefix.length > 0 && commands.some(command =>
    command.path.length > prefix.length
    && command.path.slice(0, prefix.length).every((part, index) => part === prefix[index]))
  for (const command of commands) {
    const child = command.path[prefix.length]
    if (prefix.length === 0 && child && rootAliasNames.has(child) && !commands.some(candidate => candidate.path.length === 1 && candidate.path[0] === child)) continue
    if (child) childNames.add(child)
    const commandUnderPrefix = command.path.slice(0, prefix.length).every((part, index) => part === prefix[index])
    if (prefix.length > 0 && !commandUnderPrefix && (!hasCanonicalChildren || prefix[0] === 'auth')) {
      const aliasChild = (command.aliases ?? [])
        .find(alias => alias.length > prefix.length && alias.slice(0, prefix.length).every((part, index) => part === prefix[index]))
        ?.at(prefix.length)
      if (aliasChild) childNames.add(aliasChild)
    }
  }
  const children = [...childNames]
    .sort((a, b) => childPriority(prefix, a) - childPriority(prefix, b) || a.localeCompare(b))
    .map(child => nodeFor(commands.filter(command =>
      command.path[prefix.length] === child
      || (command.aliases ?? []).some(alias =>
        alias.length > prefix.length
        && alias[prefix.length] === child
        && alias.slice(0, prefix.length).every((part, index) => part === prefix[index]))), [...prefix, child], child))
  const subcommands = prefix.length === 0 ? sortRootNodes([...children, ...rootAliases]) : children

  const namespaceAliasPaths = !nodeCommand && prefix.length === 1 ? namespaceAliases(prefix[0]!, commands).map(alias => [alias]) : undefined

  const aliases = schemaAliasesForNode(prefix, nodeCommand) ?? (namespaceAliasPaths?.length ? namespaceAliasPaths : undefined)
  return {
    alias_paths: schemaAliasPaths(aliases),
    aliases,
    flags: schemaFlags(flagsForNode(prefix, nodeCommand)),
    help: nodeCommand?.description ?? (prefix.length ? `${prefix.join(' ')} commands` : 'Beeper CLI'),
    hidden: nodeCommand?.hidden || undefined,
    mcp: nodeCommand?.mcp || undefined,
    name,
    output: nodeCommand?.output,
    path: exactAlias ? nodeCommand?.path.join(' ') ?? prefix.join(' ') : prefix.length ? prefix.join(' ') : 'beeper',
    positionals: nodeCommand?.args?.map(schemaArg),
    primary_result_key: nodeCommand ? primaryResultKey(nodeCommand) : undefined,
    program_alias_paths: programAliasPaths(aliases),
    program_path: prefix.length ? `beeper ${exactAlias ? nodeCommand?.path.join(' ') ?? prefix.join(' ') : prefix.join(' ')}` : 'beeper',
    raw_json: nodeCommand?.rawJson || undefined,
    requirements: nodeCommand ? requirements(nodeCommand) : undefined,
    risk: nodeCommand?.risk,
    subcommands: subcommands.length ? subcommands : undefined,
    type: prefix.length === 0 ? 'application' : 'command',
    usage: nodeCommand ? usageForNode(nodeCommand, prefix, children, Boolean(exactAlias)) : prefix.length ? namespaceUsage(prefix, commands) : 'beeper <command> [flags]',
  }
}

function rootAliasNodes(commands: CommandSpec[]): SchemaNode[] {
  const nodes: SchemaNode[] = []
  const seen = new Set(commands.filter(command => command.path.length === 1).map(command => command.path[0]).filter(Boolean))
  for (const command of commands) {
    if (command.path.length <= 1) continue
    const aliases = (command.aliases ?? []).filter(alias => alias.length === 1)
    if (!aliases.length) continue
    const primary = aliases[0]![0]!
    if (seen.has(primary)) continue
    seen.add(primary)
    nodes.push({
      alias_paths: schemaAliasPaths(aliases.slice(1)),
      aliases: aliases.slice(1),
      flags: schemaFlags(flagsForNode(command.path, command)),
      help: `${command.description} (alias for '${command.path.join(' ')}')`,
      hidden: command.hidden || undefined,
      mcp: command.mcp || undefined,
      name: primary,
      output: command.output,
      path: primary,
      positionals: command.args?.map(schemaArg),
      primary_result_key: primaryResultKey(command),
      program_alias_paths: programAliasPaths(aliases.slice(1)),
      program_path: `beeper ${primary}`,
      raw_json: command.rawJson || undefined,
      requirements: requirements(command),
      risk: command.risk,
      type: 'command',
      usage: `beeper ${primary}${aliases.length > 1 ? ` (${aliases.slice(1).map(alias => alias.join(' ')).join(',')})` : ''}${usageArgs(command.args ?? [])} [flags]`,
    })
  }
  const me = commands.find(command => command.path.join(' ') === 'me')
  const whoamiAliases = me?.aliases?.filter(alias => alias.length === 1 && alias[0]?.startsWith('who')) ?? []
  if (me && whoamiAliases.length) {
    const primary = whoamiAliases[0]![0]!
    if (!seen.has(primary)) {
      seen.add(primary)
      nodes.push({
        alias_paths: schemaAliasPaths(whoamiAliases.slice(1)),
        aliases: whoamiAliases.slice(1),
        flags: schemaFlags(flagsForNode(me.path, me)),
        help: `${me.description} (alias for '${me.path.join(' ')}')`,
        hidden: me.hidden || undefined,
        mcp: me.mcp || undefined,
        name: primary,
        output: me.output,
        path: primary,
        positionals: me.args?.map(schemaArg),
        primary_result_key: primaryResultKey(me),
        program_alias_paths: programAliasPaths(whoamiAliases.slice(1)),
        program_path: `beeper ${primary}`,
        raw_json: me.rawJson || undefined,
        requirements: requirements(me),
        risk: me.risk,
        type: 'command',
        usage: `beeper ${primary}${whoamiAliases.length > 1 ? ` (${whoamiAliases.slice(1).map(alias => alias.join(' ')).join(',')})` : ''}${usageArgs(me.args ?? [])} [flags]`,
      })
    }
  }
  return nodes
}

function sortRootNodes(nodes: SchemaNode[]): SchemaNode[] {
  return nodes.sort((a, b) => childPriority([], a.name) - childPriority([], b.name) || a.name.localeCompare(b.name))
}

function childPriority(prefix: string[], child: string): number {
  const parent = prefix.join(' ')
  const rootOrder = [
    'message',
    'ls',
    'search',
    'open',
    'download',
    'upload',
    'login',
    'logout',
    'status',
    'me',
    'whoami',
    'setup',
    'send',
    'chats',
    'chat',
    'groups',
    'group',
    'messages',
    'accounts',
    'account',
    'contacts',
    'contact',
    'presence',
    'media',
    'targets',
    'target',
    'use',
    'remove',
    'resolve',
    'export',
    'watch',
    'doctor',
    'auth',
    'install',
    'api',
    'config',
    'docs',
    'schema',
    'mcp',
    'agent',
    'exit-codes',
    'completion',
    'help',
    'version',
  ]
  const orders: Record<string, string[]> = {
    '': rootOrder,
    account: ['list', 'show', 'add', 'use', 'remove'],
    accounts: ['list', 'show', 'add', 'use', 'remove'],
    auth: ['add', 'list', 'email', 'logout', 'status'],
    chat: ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread', 'rename', 'description', 'avatar', 'priority', 'draft', 'remind', 'disappear', 'focus', 'notify-anyway'],
    chats: ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread', 'rename', 'description', 'avatar', 'priority', 'draft', 'remind', 'disappear', 'focus', 'notify-anyway'],
    config: ['get', 'keys', 'set', 'unset', 'list', 'path'],
    contact: ['list', 'show'],
    contacts: ['list', 'show'],
    group: ['list', 'show', 'create', 'rename', 'description'],
    groups: ['list', 'show', 'create', 'rename', 'description'],
    media: ['download', 'message'],
    messages: ['list', 'search', 'context', 'show', 'export', 'forward', 'edit', 'delete', 'revoke'],
    presence: ['typing', 'paused'],
    search: ['all'],
    send: ['text', 'file', 'voice', 'sticker', 'react', 'presence'],
    target: ['list', 'use', 'add', 'remove', 'logs', 'runtime', 'tunnel'],
    'target runtime': ['start', 'stop', 'restart'],
    targets: ['list', 'use', 'add', 'remove', 'logs', 'runtime', 'tunnel'],
    'targets runtime': ['start', 'stop', 'restart'],
  }
  const order = orders[parent] ?? []
  const index = order.indexOf(child)
  return index === -1 ? order.length : index
}

function namespaceUsage(prefix: string[], commands: CommandSpec[]): string {
  const aliases = prefix.length === 1 ? namespaceAliases(prefix[0]!, commands) : []
  return `beeper ${prefix.join(' ')}${aliases.length ? ` (${aliases.join(',')})` : ''} <command> [flags]`
}

function namespaceAliases(name: string, commands: CommandSpec[]): string[] {
  const allowed = singularNamespaceAliases()[name] ?? []
  const aliases = new Set<string>()
  for (const command of commands) {
    if (command.path[0] !== name) continue
    for (const alias of command.aliases ?? []) {
      if (alias.length < 2) continue
      const aliasRoot = alias[0]
      if (aliasRoot && allowed.includes(aliasRoot)) aliases.add(aliasRoot)
    }
  }
  return [...aliases].sort((a, b) => childPriority([], a) - childPriority([], b) || a.localeCompare(b))
}

function canonicalNamespaceForAlias(alias: string): string | undefined {
  return Object.entries(singularNamespaceAliases()).find(([, aliases]) => aliases.includes(alias))?.[0]
}

function singularNamespaceAliases(): Record<string, string[]> {
  return {
    accounts: ['account'],
    chats: ['chat'],
    contacts: ['contact'],
    groups: ['group'],
    targets: ['target'],
  }
}

function usageForCommand(command: CommandSpec): string {
  const aliases = formatUsageAliases(command)
  return `beeper ${[command.path.join(' '), aliases].filter(Boolean).join(' ')}${usageArgs(command.args ?? [])} [flags]`
}

function usageForNode(command: CommandSpec, prefix: string[], children: SchemaNode[], aliasNode = false): string {
  if (children.length && !command.args?.length) return `beeper ${prefix.join(' ')} <command> [flags]`
  if (aliasNode) {
    const aliases = (command.aliases ?? [])
      .filter(alias => alias.join(' ') !== prefix.join(' '))
      .filter(alias => alias.length === prefix.length && alias.slice(0, -1).every((part, index) => part === prefix[index]))
      .map(alias => alias.at(-1)!)
    return `beeper ${prefix.join(' ')}${aliases.length ? ` (${[...new Set(aliases)].join(',')})` : ''}${usageArgs(command.args ?? [])} [flags]`
  }
  return usageForCommand(command)
}

function schemaAliasesForNode(prefix: string[], command: CommandSpec | undefined): string[][] | undefined {
  if (!command) return undefined
  if (command.path.join(' ') === prefix.join(' ')) return command.aliases
  const aliases = (command.aliases ?? [])
    .filter(alias => alias.join(' ') !== prefix.join(' '))
    .filter(alias => alias.length === prefix.length && alias.slice(0, -1).every((part, index) => part === prefix[index]))
  return aliases.length ? aliases : undefined
}

function schemaAliasPaths(aliases: string[][] | undefined): string[] | undefined {
  const paths = aliases?.map(alias => alias.join(' ')).filter(Boolean)
  return paths?.length ? paths : undefined
}

function programAliasPaths(aliases: string[][] | undefined): string[] | undefined {
  const paths = schemaAliasPaths(aliases)?.map(alias => `beeper ${alias}`)
  return paths?.length ? paths : undefined
}

function usageArgs(args: ArgSpec[]): string {
  if (!args.length) return ''
  return ` ${args.map(formatArgUsage).join(' ')}`
}

function formatUsageAliases(command: CommandSpec): string {
  const canonical = command.path.join(' ')
  const aliases = (command.aliases ?? [])
    .map(alias => alias.join(' '))
    .filter(alias => alias !== canonical)
  return aliases.length ? `(${[...new Set(aliases)].join(',')})` : ''
}

function formatArgUsage(arg: ArgSpec): string {
  if (arg.variadic) return arg.required ? `<${arg.name}> ...` : `[<${arg.name}> ...]`
  return arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
}

function flagsForNode(prefix: string[], exact: CommandSpec | undefined): FlagSpec[] {
  if (!prefix.length) return displayFlags(globalFlagSpecs)
  return mergeFlags(displayFlags(globalFlagSpecs), exact?.flags ?? [])
}

function mergeFlags(globalFlags: FlagSpec[], localFlags: FlagSpec[]): FlagSpec[] {
  const out = [...globalFlags]
  for (const local of localFlags) {
    const index = out.findIndex(flag => flag.name === local.name)
    if (index === -1) out.push(local)
    else out[index] = local
  }
  return out
}

function schemaFlags(flags: FlagSpec[]): SchemaFlag[] {
  return flags.map(flag => ({
    aliases: flag.aliases,
    default: flag.default,
    envs: flag.env,
    enum: flag.enum,
    has_default: flag.default === undefined ? undefined : true,
    help: flag.description,
    multiple: flag.multiple,
    name: flag.name,
    placeholder: flag.placeholder ?? defaultPlaceholder(flag),
    required: flag.required,
    short: flag.short,
    type: flag.type,
  }))
}

function displayFlags(flags: FlagSpec[]): FlagSpec[] {
  const priority = new Map([
    ['help', 0],
    ['color', 1],
    ['home', 2],
    ['account', 3],
    ['access-token', 4],
    ['enable-commands', 5],
    ['enable-commands-exact', 6],
    ['disable-commands', 7],
    ['json', 8],
    ['plain', 9],
    ['wrap-untrusted', 10],
    ['results-only', 11],
    ['select', 12],
    ['dry-run', 13],
    ['force', 14],
    ['no-input', 15],
    ['verbose', 16],
    ['version', 17],
    ['events', 18],
    ['full', 19],
    ['lock-wait', 20],
    ['read-only', 21],
    ['safety-profile', 22],
    ['target', 23],
    ['timeout', 24],
  ])
  return [...flags].sort((a, b) => (priority.get(a.name) ?? 100) - (priority.get(b.name) ?? 100) || a.name.localeCompare(b.name))
}

function defaultPlaceholder(flag: FlagSpec): string {
  if (flag.default !== undefined) return String(flag.default)
  if (flag.type === 'integer') return 'INT'
  if (flag.type === 'boolean') return 'BOOL'
  return 'STRING'
}

function schemaArg(arg: ArgSpec): SchemaArg {
  return {
    enum: arg.enum,
    help: arg.description,
    name: arg.name,
    required: arg.required,
    type: 'string',
    variadic: arg.variadic,
  }
}

function requirements(command: CommandSpec): string[] | undefined {
  const out: string[] = []
  if (command.risk === 'write') out.push('write')
  if (command.risk === 'destructive') out.push('destructive', 'force')
  return out.length ? out : undefined
}

function primaryResultKey(command: CommandSpec): string | undefined {
  const path = command.path.join(' ')
  if (path === 'auth list') return 'accounts'
  if (path === 'auth services') return 'services'
  if (path === 'config keys') return 'keys'
  if (path === 'config path') return 'path'
  if (path === 'targets list') return 'targets'
  return undefined
}

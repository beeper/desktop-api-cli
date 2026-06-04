import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { commands } from '../src/cli/commands.js'
import { globalFlagSpecs } from '../src/cli/parse.js'
import type { ArgSpec, CommandSpec, FlagSpec } from '../src/cli/types.js'

const root = new URL('..', import.meta.url).pathname
const docsDir = join(root, 'docs', 'commands')

await rm(docsDir, { recursive: true, force: true })
await mkdir(docsDir, { recursive: true })
await writeFile(join(docsDir, 'README.md'), commandIndex())

for (const command of commands.filter(command => !command.hidden)) {
  await writeFile(join(docsDir, `${command.path.join('-')}.md`), commandDoc(command))
}

function commandIndex(): string {
  const visible = commands.filter(command => !command.hidden)
  const rootRows = rootCommandRows(visible)
    .map(row => `| \`${row.usage}\` | ${escapeTable(row.description)} |`)
  const rows = visible
    .sort(compareCommands)
    .map(command => `| [\`${command.path.join(' ')}\`](${command.path.join('-')}.md) | ${escapeTable(command.description)} | ${aliases(command)} |`)
  return [
    '# Command Index',
    '',
    'Generated from the live command registry. Do not edit command pages by hand.',
    '',
    '## Root Commands',
    '',
    '| Usage | Description |',
    '| --- | --- |',
    ...rootRows,
    '',
    '## Full Command Reference',
    '',
    '| Command | Description | Aliases |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

function commandDoc(command: CommandSpec): string {
  return [
    `# beeper ${command.path.join(' ')}`,
    '',
    command.description,
    '',
    '## Usage',
    '',
    '```sh',
    commandUsage(command),
    '```',
    '',
    command.aliases?.length ? ['## Aliases', '', ...command.aliases.map(alias => `- \`beeper ${alias.join(' ')}\``), ''].join('\n') : undefined,
    jsonOutputSection(command),
    section('Arguments', (command.args ?? []).map(argRow)),
    section('Flags', (command.flags ?? []).map(flagRow)),
    section('Global Flags', displayFlags(globalFlagSpecs).map(flagRow)),
    command.examples?.length ? ['## Examples', '', ...command.examples.map(example => `\`\`\`sh\n${example}\n\`\`\``), ''].join('\n') : undefined,
  ].filter(Boolean).join('\n')
}

function jsonOutputSection(command: CommandSpec): string | undefined {
  const key = primaryResultKey(command)
  if (!key) return undefined
  return [
    '## JSON Output',
    '',
    `Default JSON output is an object containing the \`${key}\` field.`,
    `Use \`--json --results-only\` to emit only \`${key}\`.`,
    '',
  ].join('\n')
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

function section(title: string, rows: string[]): string | undefined {
  if (!rows.length) return undefined
  return [`## ${title}`, '', '| Name | Description |', '| --- | --- |', ...rows, ''].join('\n')
}

function argRow(arg: ArgSpec): string {
  const name = formatArgUsage(arg)
  const suffixes = [
    arg.enum?.length ? `Values: ${arg.enum.map(value => `\`${value}\``).join(', ')}.` : undefined,
  ].filter(Boolean).join(' ')
  return `| \`${name}\` | ${escapeTable([arg.description, suffixes].filter(Boolean).join(' '))} |`
}

function flagRow(flag: FlagSpec): string {
  const tokens = [
    flag.short ? `-${flag.short}` : undefined,
    `--${flag.name}${flagValueUsage(flag)}`,
    ...(flag.aliases ?? []).map(alias => `--${alias}`),
  ].filter(Boolean).join(', ')
  const suffixes = [
    flag.default !== undefined ? `Default: \`${String(flag.default)}\`.` : undefined,
    flag.enum?.length ? `Values: ${flag.enum.map(value => `\`${value}\``).join(', ')}.` : undefined,
    flag.env?.length ? `Env: ${flag.env.map(value => `\`${value}\``).join(', ')}.` : undefined,
    flag.multiple ? 'Repeatable.' : undefined,
    flag.required ? 'Required.' : undefined,
  ].filter(Boolean).join(' ')
  return `| \`${tokens}\` | ${escapeTable([flag.description, suffixes].filter(Boolean).join(' '))} |`
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
  ])
  return [...flags].sort((a, b) => (priority.get(a.name) ?? 100) - (priority.get(b.name) ?? 100) || a.name.localeCompare(b.name))
}

function usageArgs(args: ArgSpec[]): string {
  if (!args.length) return ''
  return ` ${args.map(formatArgUsage).join(' ')}`
}

function formatArgUsage(arg: ArgSpec): string {
  if (arg.variadic) return arg.required ? `<${arg.name}> ...` : `[<${arg.name}> ...]`
  return arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
}

function aliases(command: CommandSpec): string {
  return command.aliases?.length ? command.aliases.map(alias => `\`${alias.join(' ')}\``).join(', ') : ''
}

function usageAliases(command: CommandSpec): string {
  const canonical = command.path.join(' ')
  const values = (command.aliases ?? [])
    .map(alias => alias.join(' '))
    .filter(alias => alias !== canonical)
  return values.length ? `(${[...new Set(values)].join(',')})` : ''
}

function commandUsage(command: CommandSpec): string {
  const hasChildren = commands.some(candidate => !candidate.hidden && candidate.path.length > command.path.length && candidate.path.slice(0, command.path.length).every((part, index) => part === command.path[index]))
  if (hasChildren && !command.args?.length) return `beeper ${command.path.join(' ')} <command> [flags]`
  return `beeper ${[command.path.join(' '), usageAliases(command)].filter(Boolean).join(' ')}${usageArgs(command.args ?? [])} [flags]`
}

function rootCommandRows(visible: CommandSpec[]): Array<{ description: string; sort: string; usage: string }> {
  const rows = new Map<string, { description: string; sort: string; usage: string }>()
  const topLevel = new Set(visible.map(command => command.path[0]).filter((part): part is string => Boolean(part)))
  for (const command of visible) {
    if (command.path.length === 1) {
      const hasChildren = visible.some(candidate =>
        candidate.path.length > 1 && candidate.path[0] === command.path[0]
        || (candidate.aliases ?? []).some(alias => alias.length > 1 && alias[0] === command.path[0]))
      rows.set(command.path[0]!, {
        description: command.description,
        sort: command.path[0]!,
        usage: hasChildren && !command.args?.length ? `beeper ${command.path[0]} <command> [flags]` : commandUsage(command),
      })
    }
  }
  for (const command of visible) {
    if (command.path.length <= 1) continue
    const rootAliases = (command.aliases ?? [])
      .filter(alias => alias.length === 1)
      .map(alias => alias[0]!)
    if (!rootAliases.length) continue
    const name = rootAliases[0]!
    if (rows.has(name)) continue
    const alternateAliases = rootAliases.slice(1)
    rows.set(name, {
      description: `${command.description} (alias for 'beeper ${command.path.join(' ')}')`,
      sort: name,
      usage: `beeper ${name}${alternateAliases.length ? ` (${alternateAliases.join(',')})` : ''}${usageArgs(command.args ?? [])} [flags]`,
    })
  }
  const me = visible.find(command => command.path.join(' ') === 'me')
  const whoamiAliases = me?.aliases?.filter(alias => alias.length === 1 && alias[0]?.startsWith('who')).map(alias => alias[0]!) ?? []
  if (me && whoamiAliases.length && !rows.has(whoamiAliases[0]!)) {
    const name = whoamiAliases[0]!
    rows.set(name, {
      description: `${me.description} (alias for 'beeper ${me.path.join(' ')}')`,
      sort: name,
      usage: `beeper ${name}${whoamiAliases.length > 1 ? ` (${whoamiAliases.slice(1).join(',')})` : ''}${usageArgs(me.args ?? [])} [flags]`,
    })
  }
  for (const name of topLevel) {
    if (rows.has(name)) continue
    const aliases = namespaceAliases(name, visible)
    rows.set(name, {
      description: rootNamespaceDescription(name),
      sort: name,
      usage: `beeper ${name}${aliases.length ? ` (${aliases.join(',')})` : ''} <command> [flags]`,
    })
  }
  return [...rows.values()].sort((a, b) => rootCommandPriority(a.sort) - rootCommandPriority(b.sort) || a.sort.localeCompare(b.sort))
}

function rootCommandPriority(name: string): number {
  const order = [
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
    'messages',
    'accounts',
    'contacts',
    'presence',
    'media',
    'targets',
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
  const index = order.indexOf(name)
  return index === -1 ? order.length : index
}

function namespaceAliases(name: string, visible: CommandSpec[]): string[] {
  const allowed = singularNamespaceAliases()[name] ?? []
  const aliases = new Set<string>()
  for (const command of visible) {
    if (command.path[0] !== name) continue
    for (const alias of command.aliases ?? []) {
      if (alias.length < 2) continue
      const aliasRoot = alias[0]
      if (aliasRoot && allowed.includes(aliasRoot)) aliases.add(aliasRoot)
    }
  }
  return [...aliases].sort((a, b) => rootCommandPriority(a) - rootCommandPriority(b) || a.localeCompare(b))
}

function singularNamespaceAliases(): Record<string, string[]> {
  return {
    accounts: ['account'],
    chats: ['chat'],
    contacts: ['contact'],
    targets: ['target'],
  }
}

function rootNamespaceDescription(name: string): string {
  const descriptions: Record<string, string> = {
    accounts: 'Manage connected chat accounts',
    api: 'Call raw Beeper Desktop API endpoints',
    auth: 'Authenticate and manage stored credentials',
    chats: 'List and manage chats',
    config: 'Manage configuration',
    contacts: 'List and search contacts',
    install: 'Install Beeper Desktop or Beeper Server',
    media: 'Download message media',
    messages: 'List, search, edit, and delete messages',
    presence: 'Send presence indicators',
    remove: 'Remove configured resources',
    resolve: 'Resolve Beeper selectors',
    send: 'Send messages, files, reactions, and presence',
    targets: 'Manage Beeper Desktop and Server targets',
    use: 'Select default resources',
  }
  return descriptions[name] ?? `${name} commands`
}

function flagValueUsage(flag: FlagSpec): string {
  if (flag.type === 'boolean') return ''
  if (flag.default !== undefined) return `=${JSON.stringify(flag.default)}`
  return `=${flag.placeholder ?? (flag.type === 'integer' ? 'INTEGER' : 'STRING')}`
}

function compareCommands(a: CommandSpec, b: CommandSpec): number {
  return a.path.join(' ').localeCompare(b.path.join(' '))
}

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

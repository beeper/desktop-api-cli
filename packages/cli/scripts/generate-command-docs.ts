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
  const rows = commands
    .filter(command => !command.hidden)
    .sort(compareCommands)
    .map(command => `| [\`${command.path.join(' ')}\`](${command.path.join('-')}.md) | ${escapeTable(command.description)} | ${aliases(command)} |`)
  return [
    '# Command Index',
    '',
    'Generated from the live command registry. Do not edit command pages by hand.',
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
    `beeper ${command.path.join(' ')}${usageArgs(command.args ?? [])} [flags]`,
    '```',
    '',
    command.aliases?.length ? ['## Aliases', '', ...command.aliases.map(alias => `- \`beeper ${alias.join(' ')}\``), ''].join('\n') : undefined,
    section('Arguments', (command.args ?? []).map(argRow)),
    section('Flags', (command.flags ?? []).map(flagRow)),
    section('Global Flags', globalFlagSpecs.map(flagRow)),
    command.examples?.length ? ['## Examples', '', ...command.examples.map(example => `\`\`\`sh\n${example}\n\`\`\``), ''].join('\n') : undefined,
  ].filter(Boolean).join('\n')
}

function section(title: string, rows: string[]): string | undefined {
  if (!rows.length) return undefined
  return [`## ${title}`, '', '| Name | Description |', '| --- | --- |', ...rows, ''].join('\n')
}

function argRow(arg: ArgSpec): string {
  const name = `${arg.required ? '<' : '['}${arg.name}${arg.variadic ? ' ...' : ''}${arg.required ? '>' : ']'}`
  return `| \`${name}\` | ${escapeTable(arg.description ?? '')} |`
}

function flagRow(flag: FlagSpec): string {
  const tokens = [
    flag.short ? `-${flag.short}` : undefined,
    `--${flag.name}${flag.type === 'boolean' ? '' : ` <${flag.placeholder ?? 'value'}>`}`,
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

function usageArgs(args: ArgSpec[]): string {
  if (!args.length) return ''
  return ` ${args.map(arg => arg.variadic ? `<${arg.name}> ...` : arg.required ? `<${arg.name}>` : `[${arg.name}]`).join(' ')}`
}

function aliases(command: CommandSpec): string {
  return command.aliases?.length ? command.aliases.map(alias => `\`${alias.join(' ')}\``).join(', ') : ''
}

function compareCommands(a: CommandSpec, b: CommandSpec): number {
  return a.path.join(' ').localeCompare(b.path.join(' '))
}

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>')
}

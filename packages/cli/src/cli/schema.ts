import type { ArgSpec, CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { globalFlagSpecs } from './parse.js'
import { commandVisible } from './policy.js'

type SchemaDoc = {
  build: string
  command: SchemaNode
  schema_version: 1
}

type SchemaNode = {
  aliases?: string[][]
  flags?: SchemaFlag[]
  help: string
  hidden?: boolean
  name: string
  output?: string
  path: string
  positionals?: SchemaArg[]
  requirements?: string[]
  subcommands?: SchemaNode[]
  type: 'application' | 'command'
  usage?: string
}

type SchemaFlag = {
  aliases?: string[]
  default?: boolean | number | string
  envs?: string[]
  enum?: string[]
  help?: string
  multiple?: boolean
  name: string
  placeholder?: string
  required?: boolean
  short?: string
  type: string
}

type SchemaArg = {
  help?: string
  name: string
  required?: boolean
  type: 'string'
  variadic?: boolean
}

export function buildSchema(commands: CommandSpec[], version: string, requested: string[] = [], flags?: GlobalFlags): SchemaDoc {
  const visible = commands.filter(command => flags ? commandVisible(command, flags) : !command.hidden)
  const filtered = requested.length
    ? visible.filter(command => command.path.join('.').startsWith(requested.join('.')))
    : visible
  return {
    build: version,
    command: nodeFor(filtered, requested, requested.length ? requested.at(-1) ?? 'beeper' : 'beeper'),
    schema_version: 1,
  }
}

function nodeFor(commands: CommandSpec[], prefix: string[], name: string): SchemaNode {
  const exact = commands.find(command => command.path.join('.') === prefix.join('.'))
  const childNames = new Set<string>()
  for (const command of commands) {
    const child = command.path[prefix.length]
    if (child) childNames.add(child)
  }
  const children = [...childNames]
    .sort()
    .map(child => nodeFor(commands.filter(command => command.path[prefix.length] === child), [...prefix, child], child))

  return {
    aliases: exact?.aliases,
    flags: prefix.length === 0 ? schemaFlags(globalFlagSpecs) : schemaFlags(exact?.flags ?? []),
    help: exact?.description ?? 'Beeper CLI',
    hidden: exact?.hidden || undefined,
    name,
    output: exact?.output,
    path: prefix.join(' '),
    positionals: exact?.args?.map(schemaArg),
    requirements: exact ? requirements(exact) : undefined,
    subcommands: children.length ? children : undefined,
    type: prefix.length === 0 ? 'application' : 'command',
    usage: exact ? `beeper ${exact.path.join(' ')}` : undefined,
  }
}

function schemaFlags(flags: FlagSpec[]): SchemaFlag[] {
  return flags.map(flag => ({
    aliases: flag.aliases,
    default: flag.default,
    envs: flag.env,
    enum: flag.enum,
    help: flag.description,
    multiple: flag.multiple,
    name: flag.name,
    placeholder: flag.placeholder,
    required: flag.required,
    short: flag.short,
    type: flag.type,
  }))
}

function schemaArg(arg: ArgSpec): SchemaArg {
  return {
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

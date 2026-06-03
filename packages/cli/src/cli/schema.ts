import type { ArgSpec, CommandSpec, FlagSpec } from './types.js'
import { globalFlagSpecs } from './parse.js'

type SchemaDoc = {
  build: string
  command: SchemaNode
  schema_version: 1
}

type SchemaNode = {
  flags?: SchemaFlag[]
  help: string
  name: string
  path: string
  positionals?: SchemaArg[]
  requirements?: string[]
  subcommands?: SchemaNode[]
  type: 'application' | 'command'
  usage?: string
}

type SchemaFlag = {
  default?: boolean | number | string
  enum?: string[]
  help?: string
  multiple?: boolean
  name: string
  required?: boolean
  type: string
}

type SchemaArg = {
  help?: string
  name: string
  required?: boolean
  type: 'string'
  variadic?: boolean
}

export function buildSchema(commands: CommandSpec[], version: string, requested: string[] = []): SchemaDoc {
  const filtered = requested.length
    ? commands.filter(command => command.path.join('.').startsWith(requested.join('.')))
    : commands
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
    flags: prefix.length === 0 ? schemaFlags(globalFlagSpecs) : schemaFlags(exact?.flags ?? []),
    help: exact?.description ?? 'Beeper CLI',
    name,
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
    default: flag.default,
    enum: flag.enum,
    help: flag.description,
    multiple: flag.multiple,
    name: flag.name,
    required: flag.required,
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

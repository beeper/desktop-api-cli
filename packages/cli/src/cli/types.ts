export type FlagSpec = {
  name: string
  default?: boolean | number | string
  description?: string
  enum?: string[]
  multiple?: boolean
  required?: boolean
  type: 'boolean' | 'string' | 'integer'
}

export type ArgSpec = {
  name: string
  description?: string
  required?: boolean
  variadic?: boolean
}

export type CommandRisk = 'read' | 'write' | 'destructive'

export type CommandContext = {
  args: string[]
  commandPath: string[]
  flags: Record<string, unknown>
  globalFlags: GlobalFlags
}

export type CommandSpec = {
  args?: ArgSpec[]
  description: string
  examples?: string[]
  flags?: FlagSpec[]
  mcp?: boolean
  path: string[]
  risk: CommandRisk
  run(ctx: CommandContext): Promise<unknown>
}

export type GlobalFlags = {
  debug: boolean
  dryRun: boolean
  events: boolean
  force: boolean
  json: boolean
  noInput: boolean
  plain: boolean
  safetyProfile?: string
  target?: string
  wrapUntrusted: boolean
}

export type FlagSpec = {
  name: string
  aliases?: string[]
  short?: string
  default?: boolean | number | string
  description?: string
  env?: string[]
  enum?: string[]
  multiple?: boolean
  placeholder?: string
  required?: boolean
  type: 'boolean' | 'string' | 'integer'
}

export type ArgSpec = {
  name: string
  description?: string
  enum?: string[]
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
  aliases?: string[][]
  description: string
  examples?: string[]
  flags?: FlagSpec[]
  hidden?: boolean
  mcp?: boolean
  output?: 'accounts' | 'auth' | 'chats' | 'contacts' | 'diagnostic' | 'generic' | 'messages' | 'status' | 'targets'
  path: string[]
  rawJson?: boolean
  risk: CommandRisk
  run(ctx: CommandContext): Promise<unknown>
}

export type GlobalFlags = {
  accessToken?: string
  account?: string[]
  color: 'auto' | 'always' | 'never'
  debug: boolean
  disableCommands?: string
  dryRun: boolean
  enableCommands?: string
  enableCommandsExact?: string
  events: boolean
  force: boolean
  full: boolean
  home?: string
  json: boolean
  lockWait?: string
  noInput: boolean
  plain: boolean
  readOnly: boolean
  resultsOnly: boolean
  safetyProfile?: string
  select?: string
  target?: string
  timeout?: string
  wrapUntrusted: boolean
}

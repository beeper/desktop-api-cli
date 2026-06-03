import type { CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { enforcePolicy } from './policy.js'
import { wrapUntrusted } from './output.js'
import { parseFlagValue, validateCommandInput } from './parse.js'

type JsonRpcRequest = {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
}

type McpOptions = {
  allowTools: string[]
  allowWrite: boolean
  listTools: boolean
  maxOutputBytes: number
  timeoutSeconds: number
}

export async function serveMcp(commands: CommandSpec[], flags: GlobalFlags, options: McpOptions, version: string): Promise<void> {
  const tools = mcpCommands(commands, options)
  if (options.listTools) {
    process.stdout.write(`${JSON.stringify(mcpTools(tools), null, 2)}\n`)
    return
  }
  const buffer: string[] = []
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    buffer.push(String(chunk))
    let joined = buffer.join('')
    let index = joined.indexOf('\n')
    while (index !== -1) {
      const line = joined.slice(0, index).trim()
      joined = joined.slice(index + 1)
      if (line) await handleLine(tools, flags, options, version, line)
      index = joined.indexOf('\n')
    }
    buffer.length = 0
    if (joined) buffer.push(joined)
  }
  const finalLine = buffer.join('').trim()
  if (finalLine) await handleLine(tools, flags, options, version, finalLine)
}

function mcpTools(commands: CommandSpec[]): Record<string, unknown>[] {
  return commands
    .filter(command => command.mcp)
    .map(command => ({
      description: command.description,
      inputSchema: {
        additionalProperties: false,
        properties: Object.fromEntries([
          ...(command.args ?? []).map(arg => [arg.name, { description: arg.description, type: 'string' }]),
          ...(command.flags ?? []).map(flag => [flag.name, inputSchemaForFlag(flag)]),
        ]),
        required: [
          ...(command.args ?? []).filter(arg => arg.required).map(arg => arg.name),
          ...(command.flags ?? []).filter(flag => flag.required).map(flag => flag.name),
        ],
        type: 'object',
      },
      name: command.path.join('_'),
    }))
}

async function handleLine(commands: CommandSpec[], flags: GlobalFlags, options: McpOptions, version: string, line: string): Promise<void> {
  let request: JsonRpcRequest = {}
  try {
    request = JSON.parse(line) as JsonRpcRequest
    if (request.method === 'initialize') {
      respond(request.id, { capabilities: { tools: {} }, protocolVersion: '2024-11-05', serverInfo: { name: 'beeper', version } })
      return
    }
    if (request.method === 'tools/list') {
      respond(request.id, { tools: mcpTools(commands) })
      return
    }
    if (request.method === 'tools/call') {
      const name = String(request.params?.name ?? '')
      const tool = commands.find(command => command.mcp && command.path.join('_') === name)
      if (!tool) throw new Error(`unknown MCP tool: ${name}`)
      if (tool.risk !== 'read' && !options.allowWrite) throw new Error(`MCP tool "${name}" requires mcp --allow-write`)
      const args = request.params?.arguments && typeof request.params.arguments === 'object'
        ? request.params.arguments as Record<string, unknown>
        : {}
      const globalFlags = { ...flags, json: true, wrapUntrusted: true }
      const positionals = positionalsFor(tool, args)
      const toolFlags = flagsFor(tool, args)
      validateCommandInput(tool, toolFlags, positionals)
      enforcePolicy(tool, globalFlags)
      const result = await withTimeout(options.timeoutSeconds, () => tool.run({ args: positionals, commandPath: tool.path, flags: toolFlags, globalFlags }))
      const structured = {
        exit_code: 0,
        risk: tool.risk,
        service: tool.path[0],
        stdout: wrapUntrusted(result),
        stderr: '',
        tool: tool.path.join('_'),
      }
      respond(request.id, { content: [{ text: truncate(JSON.stringify(structured), options.maxOutputBytes), type: 'text' }], structuredContent: structured })
      return
    }
    if (request.id !== undefined) respond(request.id, {})
  } catch (error) {
    respondError(request.id, error instanceof Error ? error.message : String(error))
  }
}

function mcpCommands(commands: CommandSpec[], options: McpOptions): CommandSpec[] {
  return commands
    .filter(command => command.mcp)
    .filter(command => options.allowWrite || command.risk === 'read')
    .filter(command => !options.allowTools.length || options.allowTools.some(pattern => toolMatches(command, pattern)))
}

function toolMatches(command: CommandSpec, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase().replaceAll(/\s+/g, '.').replaceAll('_', '.')
  if (!normalized || normalized === '*' || normalized === 'all') return true
  const dotted = command.path.join('.')
  const underscored = command.path.join('_')
  return normalized === command.risk || normalized === command.path[0] || normalized === dotted || normalized === underscored || (normalized.endsWith('.*') && dotted.startsWith(normalized.slice(0, -2) + '.'))
}

async function withTimeout<T>(seconds: number, run: () => Promise<T>): Promise<T> {
  if (seconds <= 0) throw new Error('--timeout-seconds must be greater than zero')
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`MCP tool timed out after ${seconds}s`)), seconds * 1000)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function truncate(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return value
  return Buffer.byteLength(value) <= maxBytes ? value : `${value.slice(0, maxBytes)}...`
}

function inputSchemaForFlag(flag: FlagSpec): Record<string, unknown> {
  const schema = {
    description: flag.description,
    enum: flag.enum,
    type: flag.type === 'integer' ? 'integer' : flag.type,
  }
  return flag.multiple ? { description: flag.description, items: schema, type: 'array' } : schema
}

function positionalsFor(command: CommandSpec, input: Record<string, unknown>): string[] {
  return (command.args ?? [])
    .map(arg => input[arg.name])
    .filter(value => value !== undefined)
    .map(String)
}

function flagsFor(command: CommandSpec, input: Record<string, unknown>): Record<string, unknown> {
  const flags: Record<string, unknown> = {}
  for (const flag of command.flags ?? []) {
    const value = input[flag.name] ?? flag.default
    if (value === undefined) continue
    flags[flag.name] = flag.multiple
      ? (Array.isArray(value) ? value : [value]).map(item => parseFlagValue(flag, item))
      : parseFlagValue(flag, value)
  }
  return flags
}

function respond(id: JsonRpcRequest['id'], result: unknown): void {
  process.stdout.write(`${JSON.stringify({ id, jsonrpc: '2.0', result })}\n`)
}

function respondError(id: JsonRpcRequest['id'], message: string): void {
  process.stdout.write(`${JSON.stringify({ error: { code: -32000, message }, id, jsonrpc: '2.0' })}\n`)
}

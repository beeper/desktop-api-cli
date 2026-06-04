import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Readable, Writable } from 'node:stream'
import { z, type ZodTypeAny } from 'zod'

import type { ArgSpec, CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { enforcePolicy } from './policy.js'
import { wrapUntrusted } from './output.js'
import { parseFlagValue, validateCommandInput } from './parse.js'

type McpOptions = {
  allowTools: string[]
  allowWrite: boolean
  httpHost: string
  httpPath: string
  httpPort: number
  listTools: boolean
  maxOutputBytes: number
  timeoutSeconds: number
  transport: 'http' | 'stdio'
}

const curatedMcpCommandPaths = [
  ['status'],
  ['me'],
  ['targets', 'list'],
  ['accounts', 'list'],
  ['accounts', 'show'],
  ['contacts', 'list'],
  ['contacts', 'show'],
  ['chats', 'list'],
  ['chats', 'show'],
  ['resolve', 'account'],
  ['resolve', 'chat'],
  ['resolve', 'contact'],
  ['resolve', 'target'],
  ['messages', 'list'],
  ['messages', 'context'],
  ['messages', 'show'],
  ['messages', 'export'],
  ['messages', 'search'],
  ['send', 'text'],
  ['send', 'react'],
  ['chats', 'read'],
  ['messages', 'edit'],
] as const

export async function serveMcp(commands: CommandSpec[], flags: GlobalFlags, options: McpOptions, version: string): Promise<void> {
  const tools = mcpCommands(commands, options)
  if (options.listTools) {
    process.stdout.write(`${JSON.stringify({ tools: mcpTools(tools) }, null, 2)}\n`)
    return
  }

  if (options.transport === 'http') {
    await serveHttpMcp(tools, flags, options, version)
    return
  }

  const server = createMcpServer(tools, flags, options, version)
  await server.connect(new BeeperMcpStdioTransport())
}

function createMcpServer(tools: CommandSpec[], flags: GlobalFlags, options: McpOptions, version: string): McpServer {
  const server = new McpServer({ name: 'beeper', version })
  for (const command of tools) {
    for (const name of toolNames(command)) server.registerTool(name, {
      _meta: {
        command: command.path.join(' '),
        risk: command.risk,
        service: command.path[0],
      },
      annotations: {
        destructiveHint: command.risk === 'destructive',
        idempotentHint: command.risk === 'read',
        openWorldHint: true,
        readOnlyHint: command.risk === 'read',
      },
      description: command.description,
      inputSchema: sdkInputSchema(command),
    }, async input => runTool(command, flags, options, input as Record<string, unknown>))
  }
  return server
}

async function serveHttpMcp(tools: CommandSpec[], flags: GlobalFlags, options: McpOptions, version: string): Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>()

  const createTransport = async (): Promise<StreamableHTTPServerTransport> => {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      onsessionclosed: sessionId => {
        transports.delete(sessionId)
      },
      onsessioninitialized: sessionId => {
        transports.set(sessionId, transport)
      },
      sessionIdGenerator: randomUUID,
    })
    await createMcpServer(tools, flags, options, version).connect(transport)
    return transport
  }

  const path = normalizeHttpPath(options.httpPath)
  const httpServer = createServer((req, res) => {
    void handleMcpHttpRequest(transports, createTransport, path, req, res)
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(options.httpPort, options.httpHost, resolve)
  })

  const address = httpServer.address() as AddressInfo
  process.stderr.write(`Beeper MCP HTTP server listening on http://${address.address}:${address.port}${path}\n`)

  await new Promise<void>((resolve, reject) => {
    httpServer.on('close', resolve)
    httpServer.on('error', reject)
  })
}

async function handleMcpHttpRequest(
  transports: Map<string, StreamableHTTPServerTransport>,
  createTransport: () => Promise<StreamableHTTPServerTransport>,
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
    if (url.pathname !== path) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found', path: url.pathname }))
      return
    }
    const sessionId = headerValue(req.headers['mcp-session-id'])
    const transport = sessionId ? transports.get(sessionId) : await createTransport()
    if (!transport) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'session_not_found' }))
      return
    }
    await transport.handleRequest(req, res)
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' })
    }
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function normalizeHttpPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/mcp'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

class BeeperMcpStdioTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private buffer = ''
  private started = false

  constructor(
    private readonly stdin: Readable = process.stdin,
    private readonly stdout: Writable = process.stdout,
  ) {}

  async start(): Promise<void> {
    if (this.started) throw new Error('BeeperMcpStdioTransport already started')
    this.started = true
    this.stdin.setEncoding('utf8')
    this.stdin.on('data', this.onData)
    this.stdin.on('end', this.onEnd)
    this.stdin.on('error', this.onInputError)
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await new Promise<void>(resolve => {
      if (this.stdout.write(`${JSON.stringify(message)}\n`)) resolve()
      else this.stdout.once('drain', resolve)
    })
  }

  async close(): Promise<void> {
    this.stdin.off('data', this.onData)
    this.stdin.off('end', this.onEnd)
    this.stdin.off('error', this.onInputError)
    this.buffer = ''
    this.onclose?.()
  }

  private readonly onData = (chunk: string | Buffer): void => {
    this.buffer += String(chunk)
    this.processBuffer(false)
  }

  private readonly onEnd = (): void => {
    this.processBuffer(true)
  }

  private readonly onInputError = (error: Error): void => {
    this.onerror?.(error)
  }

  private processBuffer(final: boolean): void {
    let index = this.buffer.indexOf('\n')
    while (index !== -1) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line) this.handleLine(line)
      index = this.buffer.indexOf('\n')
    }
    if (final) {
      const line = this.buffer.trim()
      this.buffer = ''
      if (line) this.handleLine(line)
    }
  }

  private handleLine(line: string): void {
    try {
      const message = normalizeLegacyInitialize(JSON.parse(line)) as JSONRPCMessage
      this.onmessage?.(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      void this.send({ error: { code: -32000, message }, jsonrpc: '2.0' } as JSONRPCMessage)
    }
  }
}

function normalizeLegacyInitialize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const message = value as { method?: unknown; params?: unknown }
  if (message.method !== 'initialize') return value
  const params = message.params && typeof message.params === 'object'
    ? message.params as Record<string, unknown>
    : {}
  message.params = {
    capabilities: {},
    clientInfo: { name: 'beeper-cli-legacy-mcp-client', version: '0' },
    protocolVersion: '2024-11-05',
    ...params,
  }
  return message
}

function mcpTools(commands: CommandSpec[]): Record<string, unknown>[] {
  return commands
    .flatMap(command => toolNames(command).map(name => ({
      description: command.description,
      name,
      requirements: requirements(command),
      risk: command.risk,
      service: command.path[0],
    })))
}

function requirements(command: CommandSpec): string[] | undefined {
  const out: string[] = []
  if (command.risk === 'write') out.push('write')
  if (command.risk === 'destructive') out.push('destructive', 'force')
  return out.length ? out : undefined
}

async function runTool(tool: CommandSpec, flags: GlobalFlags, options: McpOptions, args: Record<string, unknown>) {
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
    stdout: wrapUntrusted(mcpStdout(tool, result)),
    stderr: '',
    tool: toolName(tool),
  }
  return {
    content: [{ text: truncate(JSON.stringify(structured), options.maxOutputBytes), type: 'text' as const }],
    structuredContent: structured,
  }
}

function mcpStdout(command: CommandSpec, result: unknown): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result
  const record = result as Record<string, unknown>
  if (command.output === 'targets' && Array.isArray(record.targets)) return record.targets
  if (command.output === 'auth' && Array.isArray(record.accounts)) return record.accounts
  return result
}

function mcpCommands(commands: CommandSpec[], options: McpOptions): CommandSpec[] {
  const allowTools = expandAllowTools(options.allowTools)
  return curatedMcpCommands(commands)
    .filter(command => options.allowWrite || command.risk === 'read')
    .filter(command => !allowTools.length || allowTools.some(pattern => toolMatches(command, pattern)))
}

function curatedMcpCommands(commands: CommandSpec[]): CommandSpec[] {
  return curatedMcpCommandPaths.map(path => {
    const command = commands.find(candidate => pathMatches(candidate.path, path))
    if (!command) throw new Error(`Curated MCP command not found: ${path.join(' ')}`)
    return command
  })
}

function pathMatches(path: string[], expected: readonly string[]): boolean {
  return path.length === expected.length && path.every((part, index) => part === expected[index])
}

function expandAllowTools(patterns: string[]): string[] {
  return patterns.flatMap(pattern => pattern.split(',').map(item => item.trim()).filter(Boolean))
}

function toolMatches(command: CommandSpec, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase().replaceAll(/\s+/g, '.').replaceAll('_', '.')
  if (!normalized || normalized === '*' || normalized === 'all') return true
  const dotted = command.path.join('.')
  const normalizedNames = toolNames(command).map(name => name.toLowerCase().replaceAll('_', '.').replaceAll('-', '.'))
  return normalized === command.risk || normalized === command.path[0] || normalized === dotted || normalizedNames.includes(normalized) || (normalized.endsWith('.*') && dotted.startsWith(normalized.slice(0, -2) + '.'))
}

function toolName(command: CommandSpec): string {
  return command.path.join('_').replaceAll('-', '_')
}

function toolNames(command: CommandSpec): string[] {
  return [...new Set([toolName(command), command.path.join('_')])]
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

function sdkInputSchema(command: CommandSpec): ZodTypeAny {
  const positionalNames = new Set((command.args ?? []).map(arg => arg.name))
  const shape = Object.fromEntries([
    ...(command.args ?? []).map(arg => [arg.name, zodSchemaForArg(arg)]),
    ...(command.flags ?? []).filter(flag => !positionalNames.has(flag.name)).map(flag => [flag.name, zodSchemaForFlag(flag)]),
  ])
  return z.object(shape).strict()
}

function zodSchemaForArg(arg: ArgSpec): ZodTypeAny {
  let schema = stringSchema(arg.description, arg.enum)
  if (arg.variadic) schema = z.array(schema).describe(arg.description ?? '')
  return arg.required ? schema : schema.optional()
}

function zodSchemaForFlag(flag: FlagSpec): ZodTypeAny {
  let schema: ZodTypeAny
  if (flag.type === 'boolean') {
    schema = z.union([z.boolean(), z.string()]).describe(flag.description ?? '')
  } else if (flag.type === 'integer') {
    schema = z.union([z.number().int(), z.string()]).describe(flag.description ?? '')
  } else {
    schema = stringSchema(flag.description, flag.enum)
  }
  if (flag.multiple) schema = z.array(schema).describe(flag.description ?? '')
  if (flag.default !== undefined) schema = schema.default(flag.default)
  return flag.required ? schema : schema.optional()
}

function stringSchema(description?: string, enumValues?: string[]): ZodTypeAny {
  const schema = enumValues?.length
    ? z.enum(enumValues as [string, ...string[]])
    : z.string()
  return schema.describe(description ?? '')
}

function positionalsFor(command: CommandSpec, input: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const arg of command.args ?? []) {
    const value = input[arg.name]
    if (value === undefined) continue
    if (arg.variadic && Array.isArray(value)) out.push(...value.map(String))
    else out.push(String(value))
  }
  return out
}

function flagsFor(command: CommandSpec, input: Record<string, unknown>): Record<string, unknown> {
  const flags: Record<string, unknown> = {}
  const positionalNames = new Set((command.args ?? []).map(arg => arg.name))
  for (const flag of command.flags ?? []) {
    if (positionalNames.has(flag.name) && input[flag.name] !== undefined) continue
    const value = input[flag.name] ?? flag.default
    if (value === undefined) continue
    flags[flag.name] = flag.multiple
      ? (Array.isArray(value) ? value : [value]).map(item => parseFlagValue(flag, item))
      : parseFlagValue(flag, value)
  }
  return flags
}

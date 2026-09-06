import { Args } from '@oclif/core'
import { BeeperCommand } from '../../lib/command.js'
import { createClient } from '../../lib/client.js'
import { printData } from '../../lib/output.js'

export default class BridgesShow extends BeeperCommand {
  static override summary = 'Show bridge details, login flows, and connected accounts'
  static override args = {
    bridge: Args.string({ required: true, description: 'Bridge ID, display name, network, or type' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesShow)
    const client = await createClient(flags)
    const response = await client.bridges.list()
    const listBridge = resolveBridge(((response as unknown as { items?: Array<Record<string, unknown>> }).items ?? []), args.bridge)
    const bridgeID = String(listBridge.id)
    const [bridge, loginFlows, capabilities] = await Promise.all([
      client.bridges.retrieve(bridgeID).catch(() => listBridge),
      client.bridges.loginFlows.list(bridgeID).catch(() => undefined),
      client.bridges.retrieveCapabilities(bridgeID).catch(() => undefined),
    ])
    await printData({
      ...bridge,
      loginFlows: loginFlows ? (loginFlows as { items?: unknown[] }).items ?? loginFlows : undefined,
      capabilities,
    }, flags.json ? 'json' : 'human')
  }
}

export function resolveBridge(items: Array<Record<string, unknown>>, input: string): Record<string, unknown> {
  const byID = items.find(item => item.id === input)
  if (byID) return byID

  const normalizedInput = normalize(input)
  const exact = items.filter(item => [
    item.id,
    item.displayName,
    item.network,
    item.type,
  ].some(value => normalize(value) === normalizedInput))
  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) throw ambiguousBridge(input, exact)

  const partial = items.filter(item => [
    item.id,
    item.displayName,
    item.network,
    item.type,
  ].some(value => normalize(value).includes(normalizedInput)))
  if (partial.length === 1) return partial[0]!
  if (partial.length > 1) throw ambiguousBridge(input, partial)

  throw new Error(`Unknown bridge "${input}". Run \`beeper bridges list\`.`)
}

function ambiguousBridge(input: string, matches: Array<Record<string, unknown>>): Error {
  const options = matches.map(item => `${String(item.displayName ?? item.id)} (${String(item.id)})`).join(', ')
  return new Error(`Bridge "${input}" is ambiguous. Use one of: ${options}`)
}

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '')
}

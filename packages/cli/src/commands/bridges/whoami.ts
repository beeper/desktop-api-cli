import { Flags } from '@oclif/core'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { hungryURL, prepareBridgeEnv, whoami, type WhoamiBridge, type WhoamiResponse } from '../../lib/bridges/manager.js'
import { printData } from '../../lib/output.js'

export default class BridgesWhoami extends BridgeCommand {
  static override summary = 'Show Beeper account details for bridge-manager APIs'
  static override aliases = ['bridges:w']
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    raw: Flags.boolean({ char: 'r', default: process.env.BEEPER_WHOAMI_RAW === '1', description: 'Get raw JSON output instead of pretty-printed bridge status' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesWhoami)
    const env = await prepareBridgeEnv(flags)
    const data = await whoami(env)
    if (flags.raw) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
      return
    }
    if (flags.json) {
      await printData(data, 'json')
      return
    }
    printWhoami(data, env.domain)
  }
}

function printWhoami(data: WhoamiResponse, domain: string): void {
  const user = data.userInfo
  process.stdout.write(`User ID: @${user.username}:${domain}\n`)
  if (user.isAdmin) process.stdout.write('Admin: true\n')
  if (user.isFree) process.stdout.write('Free: true\n')
  if (user.fullName) process.stdout.write(`Name: ${user.fullName}\n`)
  if (user.email) process.stdout.write(`Email: ${user.email}\n`)
  if (user.supportRoomId) process.stdout.write(`Support room ID: ${user.supportRoomId}\n`)
  if (user.createdAt) process.stdout.write(`Registered at: ${new Date(user.createdAt).toLocaleString()}\n`)
  process.stdout.write('Cloud bridge details:\n')
  if (user.channel) process.stdout.write(`  Update channel: ${user.channel}\n`)
  if (user.bridgeClusterId) process.stdout.write(`  Cluster ID: ${user.bridgeClusterId}\n`)
  process.stdout.write(`  Hungryserv URL: ${hungryURL(domain, user.username)}\n`)
  process.stdout.write('Bridges:\n')
  if (data.user.hungryserv) process.stdout.write(`  ${formatBridge('hungryserv', data.user.hungryserv)}\n`)
  for (const name of Object.keys(data.user.bridges ?? {}).sort()) {
    process.stdout.write(`  ${formatBridge(name, data.user.bridges![name]!)}\n`)
  }
}

function formatBridge(name: string, bridge: WhoamiBridge): string {
  const parts = [name]
  const version = parseBridgeImage(name, bridge.version)
  if (version) parts.push(`(version: ${version})`)
  if (bridge.bridgeState?.isSelfHosted) {
    const typeName = bridge.bridgeState.bridgeType && !name.includes(bridge.bridgeState.bridgeType) ? `${bridge.bridgeState.bridgeType}, ` : ''
    parts.push(`(${typeName}self-hosted)`)
  }
  parts.push(`- ${bridge.bridgeState?.stateEvent ?? 'UNKNOWN'}`)
  const remote = formatBridgeRemotes(name, bridge)
  if (remote) parts.push(`- ${remote}`)
  return parts.join(' ')
}

function formatBridgeRemotes(name: string, bridge: WhoamiBridge): string {
  if (['hungryserv', 'androidsms', 'imessage'].includes(name)) return ''
  const states = Object.values(bridge.remoteState ?? {})
  if (!states.length) return bridge.bridgeState?.isSelfHosted ? '' : 'not logged in'
  if (states.length > 1) return 'multiple remotes'
  const state = states[0]!
  return `remote: ${state.stateEvent ?? 'UNKNOWN'} (${state.remoteName ?? ''} / ${state.remoteID ?? ''})`
}

function parseBridgeImage(name: string, image: string | undefined): string {
  if (!image || image === '?') return ''
  if (name === 'imessagecloud') return image.slice(0, 8)
  const match = image.match(/^docker\.beeper-tools\.com\/(?:bridge\/)?([a-z]+):(v2-)?([0-9a-f]{40})(?:-amd64)?$/)
  return match ? `${match[2] ?? ''}${match[3]!.slice(0, 8)}` : image
}

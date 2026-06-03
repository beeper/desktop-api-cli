import { Flags } from '@oclif/core'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { prepareBridgeEnv, whoami } from '../../lib/bridges/manager.js'
import { proxyAppserviceWebsocket } from '../../lib/bridges/websocket-proxy.js'

export default class BridgesProxy extends BridgeCommand {
  static override summary = 'Connect to an appservice websocket and proxy it to a local appservice HTTP server'
  static override aliases = ['bridges:x']
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    registration: Flags.string({ char: 'r', required: true, default: process.env.BEEPER_BRIDGE_REGISTRATION_FILE, description: 'Registration file containing as_token, hs_token, and local appservice URL' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesProxy)
    const env = await prepareBridgeEnv(flags)
    const info = await whoami(env)
    await proxyAppserviceWebsocket({
      homeserverURL: `https://matrix.${env.domain}/_hungryserv/${encodeURIComponent(info.userInfo.username)}`,
      registrationPath: flags.registration,
    })
  }
}

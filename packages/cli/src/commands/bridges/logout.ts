import { Flags } from '@oclif/core'
import { ensureWritable, isForce } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { logoutBridgeTarget, prepareBridgeEnv } from '../../lib/bridges/manager.js'
import { printSuccess } from '../../lib/output.js'

export default class BridgesLogout extends BridgeCommand {
  static override summary = 'Log out from the Beeper server for bridge-manager APIs'
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesLogout)
    ensureWritable(flags)
    const env = await prepareBridgeEnv(flags)
    await logoutBridgeTarget(env, isForce(flags))
    await printSuccess({ message: 'Logged out successfully', data: { target: env.target.id } }, flags.json ? 'json' : 'human')
  }
}

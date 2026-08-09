import { Flags } from '@oclif/core'
import { BeeperCommand, ensureWritable } from '../../lib/command.js'
import { installServer, type InstallChannel } from '../../lib/installations.js'
import { pathSetupHint } from '../../lib/env.js'
import { printSuccess } from '../../lib/output.js'

export default class SetupInstallServer extends BeeperCommand {
  static override summary = 'Install Beeper Server locally'
  static override flags = {
    channel: Flags.string({ options: ['stable', 'nightly'], default: 'stable', description: 'Server release channel' }),
    'server-env': Flags.string({ options: ['production', 'staging'], default: 'production', description: 'Server environment (production or staging)' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(SetupInstallServer)
    ensureWritable(flags)
    const installation = await installServer({ channel: flags.channel as InstallChannel, serverEnv: flags['server-env'] })
    await printSuccess({
      message: `Installed Beeper Server ${installation.version ?? ''}`.trim(),
      detail: pathSetupHint() ?? installation.path,
      data: installation,
    }, flags.json ? 'json' : 'human')
  }
}

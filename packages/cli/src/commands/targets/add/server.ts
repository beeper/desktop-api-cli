import { Args, Flags } from '@oclif/core'
import { BeeperCommand, ensureWritable } from '../../../lib/command.js'
import { createProfileTarget, readTarget, updateConfig } from '../../../lib/targets.js'
import { printSuccess } from '../../../lib/output.js'

export default class TargetsAddServer extends BeeperCommand {
  static override summary = 'Add a managed Beeper Server target'
  static override args = { name: Args.string({ required: false, description: 'Target name (default: "server")' }) }
  static override flags = {
    port: Flags.integer({ description: 'TCP port the managed Server will expose its API on' }),
    default: Flags.boolean({ default: false, description: 'Set this target as the default after creation' }),
    'server-env': Flags.string({ options: ['production', 'staging'], default: 'production', description: 'Server environment (production or staging)' }),
  }
  async run(): Promise<void> {
    const { args, flags } = await this.parse(TargetsAddServer)
    ensureWritable(flags)
    const id = args.name ?? 'server'
    if (await readTarget(id)) throw new Error(`Target "${id}" already exists.`)
    const target = await createProfileTarget('server', id, { serverEnv: flags['server-env'], port: flags.port })
    if (flags.default) await updateConfig(config => ({ ...config, defaultTarget: target.id }))
    await printSuccess({ message: `Added target: ${target.id}`, detail: target.baseURL, data: target }, flags.json ? 'json' : 'human')
  }
}

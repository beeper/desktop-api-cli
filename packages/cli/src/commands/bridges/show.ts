import { Args, Flags } from '@oclif/core'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { printData } from '../../lib/output.js'
import { prepareBridgeEnv } from '../../lib/bridges/manager.js'

export default class BridgesShow extends BridgeCommand {
  static override summary = 'Show self-hosted bridge type details'
  static override args = {
    bridge: Args.string({ required: true, description: 'Bridge type' }),
  }
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    template: Flags.boolean({ default: false, description: 'Print the raw template' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesShow)
    const env = await prepareBridgeEnv(flags)
    const templateName = `${args.bridge}.tpl.yaml`
    const template = env.catalog.templates[templateName]
    if (!template) throw new Error(`Unknown bridge type "${args.bridge}".`)
    if (flags.template && !flags.json) {
      process.stdout.write(template)
      return
    }
    const official = env.catalog.officialBridges.find(item => item.typeName === args.bridge)
    await printData({
      id: args.bridge,
      bridgeType: args.bridge,
      names: official?.names ?? [],
      websocket: Boolean(env.catalog.websocketBridges[args.bridge]),
      ipSuffix: env.catalog.bridgeIPSuffix[args.bridge],
      template: templateName,
      templateBody: flags.template ? template : undefined,
    }, flags.json ? 'json' : 'human')
  }
}

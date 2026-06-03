import { Flags } from '@oclif/core'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { printList } from '../../lib/output.js'
import { prepareBridgeEnv } from '../../lib/bridges/manager.js'

export default class BridgesList extends BridgeCommand {
  static override summary = 'List self-hosted bridge types'
  static override description = '`bridges list` lists the bridge-manager templates available for `beeper bridges config` and `beeper bridges run`.'
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesList)
    const env = await prepareBridgeEnv(flags)
    const items = env.catalog.supportedBridges.map(type => {
      const official = env.catalog.officialBridges.find(item => item.typeName === type)
      return {
        id: type,
        bridgeType: type,
        names: official?.names ?? [],
        websocket: Boolean(env.catalog.websocketBridges[type]),
        template: `${type}.tpl.yaml`,
      }
    })

    await printList(items, flags.json ? 'json' : 'human', {
      title: 'No bridges matched',
      subtitle: 'Add templates with BEEPER_BRIDGE_TEMPLATE_DIR or ~/.beeper/bridges/templates.',
      suggestions: [{ command: 'beeper bridges config sh-discord --type discord', hint: 'generate a self-hosted bridge config' }],
    })
  }
}

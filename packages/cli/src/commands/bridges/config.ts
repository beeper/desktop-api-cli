import { Args, Flags } from '@oclif/core'
import { ensureWritable } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { generateBridgeConfig, outputFile, prepareBridgeEnv } from '../../lib/bridges/manager.js'

export default class BridgesConfig extends BridgeCommand {
  static override summary = 'Generate a config for an official Beeper bridge'
  static override aliases = ['bridges:c']
  static override args = { bridge: Args.string({ required: true, description: 'Self-hosted bridge name, usually sh-...' }) }
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    'no-state': Flags.boolean({ default: false, description: "Don't send a bridge state update" }),
    output: Flags.string({ char: 'o', default: process.env.BEEPER_BRIDGE_CONFIG_FILE ?? '-', description: 'Path to save generated config file to. Use - for stdout.' }),
    param: Flags.string({ char: 'p', multiple: true, description: 'Bridge-specific config option in key=value form. Repeatable.' }),
    type: Flags.string({ char: 't', default: process.env.BEEPER_BRIDGE_TYPE, description: 'The type of bridge being registered.' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesConfig)
    ensureWritable(flags)
    const env = await prepareBridgeEnv(flags)
    const cfg = await generateBridgeConfig(env, args.bridge, {
      force: flags.force,
      noState: flags['no-state'],
      params: flags.param,
      type: flags.type,
    })
    await outputFile('Config', cfg.config ?? '', flags.output)
    printStartupHint(cfg.bridgeType, flags.output, cfg.homeserver_url, cfg.your_user_id)
  }
}

function printStartupHint(bridgeType: string, outputPath: string, homeserverURL: string, userID: string): void {
  const configPath = outputPath === '-' || !outputPath ? '<config file>' : outputPath
  let startupCommand = ''
  let installInstructions = ''
  if (['imessage', 'whatsapp', 'discord', 'slack', 'gmessages', 'gvoice', 'signal', 'meta', 'twitter', 'bluesky', 'linkedin'].includes(bridgeType)) {
    startupCommand = `mautrix-${bridgeType}`
    if (configPath !== 'config.yaml' && configPath !== '<config file>') startupCommand += ` -c ${configPath}`
    installInstructions = `https://docs.mau.fi/bridges/go/setup.html?bridge=${bridgeType}#installation`
  } else if (bridgeType === 'imessagego') {
    startupCommand = 'beeper-imessage'
    if (configPath !== 'config.yaml' && configPath !== '<config file>') startupCommand += ` -c ${configPath}`
  } else if (bridgeType === 'heisenbridge') {
    startupCommand = `python -m heisenbridge -c ${configPath} -o ${userID} ${homeserverURL.replace('https://', 'wss://')}`
    installInstructions = 'https://github.com/beeper/bridge-manager/wiki/Heisenbridge'
  }
  if (startupCommand) process.stderr.write(`\nStartup command: ${startupCommand}\n`)
  if (installInstructions) process.stderr.write(`See ${installInstructions} for bridge installation instructions\n`)
}

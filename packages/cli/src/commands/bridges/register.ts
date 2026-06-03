import { Args, Flags } from '@oclif/core'
import { ensureWritable } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { outputFile, prepareBridgeEnv, registerBridge, registrationToYAML, validateBridgeName, writeRegistrationJSON } from '../../lib/bridges/manager.js'

export default class BridgesRegister extends BridgeCommand {
  static override summary = 'Register a third-party bridge and print the appservice registration'
  static override aliases = ['bridges:r']
  static override args = { bridge: Args.string({ required: true, description: 'Self-hosted bridge name, usually sh-...' }) }
  static override flags = {
    address: Flags.string({ char: 'a', default: process.env.BEEPER_BRIDGE_ADDRESS, description: 'HTTPS address where Beeper can push events. Omit to use websocket.' }),
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    get: Flags.boolean({ char: 'g', default: false, description: "Only get existing registrations, don't create if missing" }),
    json: Flags.boolean({ char: 'j', default: process.env.BEEPER_BRIDGE_REGISTRATION_JSON === '1', description: 'Return all data as JSON instead of registration YAML' }),
    'no-state': Flags.boolean({ default: false, description: "Don't send a bridge state update" }),
    output: Flags.string({ char: 'o', default: process.env.BEEPER_BRIDGE_REGISTRATION_FILE ?? '-', description: 'Path to save generated registration file to. Use - for stdout.' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesRegister)
    ensureWritable(flags)
    validateBridgeName(args.bridge, flags.force)
    const env = await prepareBridgeEnv(flags)
    const output = await registerBridge(env, args.bridge, {
      address: flags.address,
      force: flags.force,
      get: flags.get,
      noState: flags['no-state'],
    })
    if (flags.json) {
      await writeRegistrationJSON(output)
      return
    }
    await outputFile('Registration', registrationToYAML(output.registration), flags.output)
    process.stderr.write('\nAdditional bridge configuration details:\n')
    process.stderr.write(`* Homeserver domain: ${output.homeserver_domain}\n`)
    process.stderr.write(`* Homeserver URL: ${output.homeserver_url}\n`)
    process.stderr.write(`* Your user ID: ${output.your_user_id}\n`)
  }
}

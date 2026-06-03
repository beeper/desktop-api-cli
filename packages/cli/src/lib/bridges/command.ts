import { Flags } from '@oclif/core'
import { BeeperCommand } from '../command.js'

export abstract class BridgeCommand extends BeeperCommand {
  static override baseFlags = {
    ...BeeperCommand.baseFlags,
    target: Flags.string({ description: 'Named Beeper target to use for this command' }),
  }
}

import { ExitCodes } from '../lib/errors.js'
import { commands, commandHelp, help } from './commands.js'
import { enforcePolicy } from './policy.js'
import { parseCommand } from './parse.js'
import { usage, writeError, writeResult } from './output.js'

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  let parsed
  try {
    parsed = parseCommand(argv, commands)
    if (parsed.globalFlags.json && parsed.globalFlags.plain) throw usage('cannot combine --json and --plain')
    if (parsed.helpOnly) {
      process.stdout.write(help())
      return
    }
    if (!parsed.command) throw new Error('missing command')
    if (parsed.flags.help) {
      process.stdout.write(commandHelp(parsed.command))
      return
    }
    enforcePolicy(parsed.command, parsed.globalFlags)
    const result = await parsed.command.run({
      args: parsed.positionals,
      commandPath: parsed.command.path,
      flags: parsed.flags,
      globalFlags: parsed.globalFlags,
    })
    writeResult(result, parsed.globalFlags)
  } catch (error) {
    const flags = parsed?.globalFlags ?? { events: argv.includes('--events'), json: argv.includes('--json') }
    process.exitCode = writeError(error, flags) || ExitCodes.Generic
  }
}

import { AbortError, ExitCodes } from '../lib/errors.js'
import { commands, commandHelp, help } from './commands.js'
import { enforcePolicy } from './policy.js'
import { parseCommand } from './parse.js'
import { usage, writeError, writeResult } from './output.js'

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  let parsed: ReturnType<typeof parseCommand> | undefined
  try {
    parsed = parseCommand(argv, commands)
    if (parsed.globalFlags.json && parsed.globalFlags.plain) throw usage('cannot combine --json and --plain')
    applyGlobalEnvironment(parsed.globalFlags)
    if (parsed.helpOnly) {
      process.stdout.write(help(parsed.globalFlags))
      return
    }
    if (!parsed.command) throw new Error('missing command')
    if (parsed.flags.help) {
      process.stdout.write(commandHelp(parsed.command, parsed.globalFlags))
      return
    }
    enforcePolicy(parsed.command, parsed.globalFlags)
    const flags = commandFlags(parsed.command, parsed.flags, parsed.globalFlags)
    const { command, globalFlags, positionals } = parsed
    const result = await runWithTimeout(() => command.run({
      args: positionals,
      commandPath: command.path,
      flags,
      globalFlags,
    }), globalFlags.timeout)
    writeResult(result, globalFlags, command)
  } catch (error) {
    const flags = parsed?.globalFlags ?? { events: argv.includes('--events'), json: argv.includes('--json') }
    process.exitCode = writeError(error, flags) || ExitCodes.Generic
  }
}

async function runWithTimeout<T>(run: () => Promise<T>, timeout?: string): Promise<T> {
  const ms = parseDuration(timeout)
  const promise = run()
  if (!ms) return promise
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AbortError(`command timed out after ${timeout}`, ExitCodes.Generic, undefined, 'timeout')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = /^(\d+)(ms|s|m|h)?$/.exec(value.trim())
  if (!match) throw usage('--timeout must be a duration like 500ms, 30s, 2m, or 1h')
  const amount = Number(match[1])
  if (!Number.isSafeInteger(amount) || amount <= 0) throw usage('--timeout must be greater than 0')
  const unit = match[2] ?? 'ms'
  const factor = unit === 'h' ? 3_600_000 : unit === 'm' ? 60_000 : unit === 's' ? 1_000 : 1
  return amount * factor
}

function applyGlobalEnvironment(flags: { accessToken?: string; home?: string }): void {
  if (flags.home) process.env.BEEPER_CLI_CONFIG_DIR = flags.home
  if (flags.accessToken) process.env.BEEPER_ACCESS_TOKEN = flags.accessToken
}

function commandFlags(
  command: { flags?: Array<{ multiple?: boolean; name: string }> },
  flags: Record<string, unknown>,
  globalFlags: { account?: string[] },
): Record<string, unknown> {
  const accountSpec = command.flags?.find(flag => flag.name === 'account')
  if (!accountSpec || !globalFlags.account?.length) return flags
  const current = flags.account
  if (accountSpec.multiple) {
    const local = Array.isArray(current) ? current.map(String) : typeof current === 'string' ? [current] : []
    return { ...flags, account: [...globalFlags.account, ...local] }
  }
  return current === undefined ? { ...flags, account: globalFlags.account[0] } : flags
}

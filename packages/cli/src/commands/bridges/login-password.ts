import { Flags } from '@oclif/core'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { ensureWritable, isNoInput } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { loginWithPassword, prepareBridgeTargetEnv } from '../../lib/bridges/manager.js'
import { printSuccess } from '../../lib/output.js'

export default class BridgesLoginPassword extends BridgeCommand {
  static override summary = 'Log into the Beeper server using username and password'
  static override aliases = ['bridges:p']
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    password: Flags.string({ char: 'p', default: process.env.BEEPER_PASSWORD, description: 'The Beeper password' }),
    username: Flags.string({ char: 'u', default: process.env.BEEPER_USERNAME, description: 'The Beeper username to log in as' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesLoginPassword)
    ensureWritable(flags)
    const env = await prepareBridgeTargetEnv(flags)
    const username = flags.username || await prompt('Username:')
    const password = flags.password || await prompt('Password:')
    const login = await loginWithPassword(env, username, password)
    await printSuccess({ message: `Successfully logged in as ${login.userID}`, data: { target: env.target.id, userID: login.userID } }, flags.json ? 'json' : 'human')
  }
}

async function prompt(message: string): Promise<string> {
  if (isNoInput() || !process.stdin.isTTY) throw new Error(`${message.replace(/:$/, '')} is required.`)
  const rl = createInterface({ input, output })
  try {
    return (await rl.question(`${message} `)).trim()
  } finally {
    rl.close()
  }
}

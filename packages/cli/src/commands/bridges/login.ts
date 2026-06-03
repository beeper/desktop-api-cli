import { Flags } from '@oclif/core'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { ensureWritable, isNoInput } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { loginWithEmail, prepareBridgeTargetEnv } from '../../lib/bridges/manager.js'
import { printSuccess } from '../../lib/output.js'

export default class BridgesLogin extends BridgeCommand {
  static override summary = 'Log into the Beeper server for bridge-manager APIs'
  static override aliases = ['bridges:l']
  static override flags = {
    email: Flags.string({ default: process.env.BEEPER_EMAIL, description: 'The Beeper account email to log in with' }),
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    'no-desktop': Flags.boolean({ default: process.env.BBCTL_NO_DESKTOP_LOGIN === '1', description: 'Accepted for bbctl compatibility; Desktop login is not used by this command' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(BridgesLogin)
    ensureWritable(flags)
    const env = await prepareBridgeTargetEnv(flags)
    const email = flags.email || await prompt('Email:')
    const login = await loginWithEmail(env, email, () => prompt('Enter login code sent to your email:'))
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

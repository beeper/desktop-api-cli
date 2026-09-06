import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { Args, Flags } from '@oclif/core'
import { BeeperCommand, ensureWritable } from '../../lib/command.js'
import type { Bridge, LoginFlow } from '@beeper/desktop-api/resources/bridges.js'
import { createClient } from '../../lib/client.js'
import { printAccountLoginStep, runGuidedAccountLogin } from '../../lib/account-login.js'
import { printData } from '../../lib/output.js'

type AccountType = Bridge

export default class AccountsAdd extends BeeperCommand {
  static override summary = 'Connect a chat account by bridge'
  static override description = '`accounts add` without an argument opens the guided bridge chooser. Pass a bridge ID when you already know which chat network connector to use.'
  static override args = {
    bridge: Args.string({ description: 'Bridge ID, network, or type to connect. Omit to list available bridges.' }),
  }
  static override flags = {
    cookie: Flags.string({ description: 'Cookie value for non-interactive login, in name=value form. Repeat for multiple cookies.', multiple: true }),
    field: Flags.string({ description: 'Field value for non-interactive login, in id=value form. Repeat for multiple fields.', multiple: true }),
    flow: Flags.string({ description: 'Login flow ID. If omitted, Desktop chooses the default flow.' }),
    guided: Flags.boolean({ default: true, allowNo: true, description: 'Prompt through login steps until completion' }),
    'login-id': Flags.string({ description: 'Existing login ID to re-login as' }),
    'non-interactive': Flags.boolean({ default: false, description: 'Do not prompt; require --flow, --field, and --cookie values when needed.' }),
    webview: Flags.boolean({ default: false, description: 'Use Bun.WebView to collect cookie login fields when a cookie step is returned.' }),
    'webview-backend': Flags.string({ default: 'chrome', description: 'Bun.WebView backend for cookie login steps.', options: ['auto', 'chrome', 'webkit'] }),
    'webview-timeout': Flags.integer({ default: 120, description: 'Seconds to wait for Bun.WebView cookie collection.' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AccountsAdd)
    ensureWritable(flags)
    const client = await createClient(flags)

    if (!args.bridge) {
      const bridges = await client.bridges.list()
      if (flags.json) {
        await printData(bridges, 'json')
        return
      }
      if (flags.guided && !flags['non-interactive'] && process.stdin.isTTY) {
        args.bridge = await chooseAccountType(bridges.items)
      } else {
        printAvailableAccounts(bridges.items)
        return
      }
    }

    const bridges = await client.bridges.list()
    const accountType = resolveAccountType(bridges.items, args.bridge)
    if (accountType.status !== 'available') {
      const suffix = accountType.statusText ? `: ${accountType.statusText}` : ''
      throw new Error(`${accountType.displayName} is not available${suffix}`)
    }

    let flowID = flags.flow
    if (!flowID) {
      const flows = await client.bridges.loginFlows.list(accountType.id)
      const loginFlows = flows.items
      if (loginFlows.length > 1) {
        if (flags.guided && !flags.json && !flags['non-interactive']) flowID = await chooseLoginFlow(loginFlows)
        else throw new Error(`Multiple sign-in methods are available for ${accountType.displayName}. Pass --flow.`)
      } else {
        flowID = loginFlows[0]?.id
      }
      if (!flowID) throw new Error(`No login flows returned for ${accountType.displayName}.`)
      if (!flags.json && loginFlows.length > 1) this.log(`Using flow ${flowID}`)
    }

    const step = await client.bridges.loginSessions.create(accountType.id, {
      flowID,
      loginID: flags['login-id'],
    })
    const result = flags.guided ? await runGuidedAccountLogin(client, accountType.id, step, {
      cookies: parseKeyValueFlags(flags.cookie, '--cookie'),
      fields: parseKeyValueFlags(flags.field, '--field'),
      nonInteractive: flags['non-interactive'],
      webview: flags.webview,
      webviewBackend: flags['webview-backend'] as 'auto' | 'chrome' | 'webkit',
      webviewTimeoutMs: flags['webview-timeout'] * 1000,
    }) : step
    if (flags.json) await printData(result, 'json')
    else await printAccountLoginStep(result)
  }
}

async function chooseAccountType(items: AccountType[]): Promise<string> {
  const available = items.filter(item => item.status === 'available')
  if (!available.length) throw new Error('No available bridges to connect.')

  process.stdout.write('Choose a bridge to connect an account:\n')
  available.forEach((account, index) => {
    const multiple = account.supportsMultipleAccounts ? 'multiple allowed' : 'single account'
    process.stdout.write(`  ${index + 1}. ${account.displayName} (${account.id}) - ${multiple}\n`)
  })

  const rl = createInterface({ input, output })
  try {
    for (;;) {
      const answer = (await rl.question('Select a bridge: ')).trim()
      const selected = /^\d+$/.test(answer) ? Number.parseInt(answer, 10) : Number.NaN
      if (Number.isInteger(selected) && selected >= 1 && selected <= available.length) return available[selected - 1]!.id
      const byID = available.find(account => account.id === answer)
      if (byID) return byID.id
      process.stdout.write('Choose one of the listed bridges.\n')
    }
  } finally {
    rl.close()
  }
}

function printAvailableAccounts(items: AccountType[]): void {
  const sections: Array<[string, AccountType[]]> = [
    ['On-Device Accounts', items.filter(item => item.provider === 'local')],
    ['Beeper Cloud Accounts', items.filter(item => item.provider === 'cloud')],
    ['Self-Hosted Accounts', items.filter(item => item.provider === 'self-hosted')],
  ]

  process.stdout.write('Choose a bridge to connect an account:\n\n')
  for (const [title, accounts] of sections) {
    if (!accounts.length) continue
    process.stdout.write(`${title}\n`)
    for (const account of accounts) {
      const status = account.statusText ?? statusLabel(account)
      const command = account.status === 'available' ? `beeper accounts add ${account.id}` : undefined
      const multiple = account.supportsMultipleAccounts ? 'multiple allowed' : 'single account'
      process.stdout.write(`  ${account.displayName} (${account.id}) - ${multiple}${status ? ` - ${status}` : ''}\n`)
      if (command) process.stdout.write(`    ${command}\n`)
    }
    process.stdout.write('\n')
  }
  process.stdout.write('Run `beeper bridges list` for the scriptable catalog or `beeper bridges show <bridge>` for login flows.\n')
}

export function resolveAccountType(items: AccountType[], input: string): AccountType {
  const byID = items.find(item => item.id === input)
  if (byID) return byID

  const normalizedInput = normalize(input)
  const exact = items.filter(item => [
    item.id,
    item.displayName,
    item.network,
    item.type,
  ].some(value => normalize(value) === normalizedInput))

  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) throw ambiguousAccountType(input, exact)

  const partial = items.filter(item => [
    item.id,
    item.displayName,
    item.network,
    item.type,
  ].some(value => normalize(value).includes(normalizedInput)))

  if (partial.length === 1) return partial[0]!
  if (partial.length > 1) throw ambiguousAccountType(input, partial)
  throw new Error(`Unknown bridge "${input}". Run \`beeper bridges list\` to list available bridges.`)
}

function ambiguousAccountType(input: string, matches: AccountType[]): Error {
  const options = matches.map(item => `${item.displayName} (${item.id})`).join(', ')
  return new Error(`Account type ${input} is ambiguous. Use one of: ${options}`)
}

function statusLabel(account: AccountType): string | undefined {
  if (account.status === 'available') return undefined
  if (account.status === 'connected') return `${account.displayName} Connected`
  return account.status.replaceAll('_', ' ')
}

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '')
}

function parseKeyValueFlags(values: string[] | undefined, flagName: string): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (const value of values ?? []) {
    const equalsIndex = value.indexOf('=')
    if (equalsIndex <= 0) throw new Error(`${flagName} must use name=value form.`)
    parsed[value.slice(0, equalsIndex)] = value.slice(equalsIndex + 1)
  }

  return parsed
}

async function chooseLoginFlow(flows: LoginFlow[]): Promise<string> {
  process.stdout.write('Choose how you want to sign in:\n')
  flows.forEach((flow, index) => {
    const description = flow.description ? ` - ${flow.description}` : ''
    process.stdout.write(`  ${index + 1}. ${flow.name}${description}\n`)
  })

  const rl = createInterface({ input, output })
  try {
    for (;;) {
      const answer = (await rl.question('Select a sign-in method: ')).trim()
      const selected = Number.parseInt(answer, 10)
      if (Number.isInteger(selected) && selected >= 1 && selected <= flows.length) return flows[selected - 1]!.id
      const byID = flows.find(flow => flow.id === answer)
      if (byID) return byID.id
      process.stdout.write('Choose one of the listed sign-in methods.\n')
    }
  } finally {
    rl.close()
  }
}

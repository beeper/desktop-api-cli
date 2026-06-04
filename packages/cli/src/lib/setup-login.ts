import { BeeperDesktop } from '@beeper/desktop-api'
import type { LoginRegisterResponse, LoginResponseResponse } from '@beeper/desktop-api/resources/app/login'
import { evaluateReadiness, type Readiness } from './app-state.js'
import { connectedAccountSummary } from './local-desktop.js'
import { promptConfirm, promptText } from './prompts.js'
import { publicTarget, writeTarget, type PublicTarget, type Target } from './targets.js'

type AppLoginSuccess = LoginResponseResponse.Success | LoginRegisterResponse

export type SetupLoginResult = {
  accounts: string[]
  readiness: Readiness
  target: PublicTarget
}

export async function startEmailSetup(target: Target, email: string): Promise<{ setupRequestID: string }> {
  const client = setupClient(target)
  const start = await client.app.login.start()
  await client.app.login.email({ setupRequestID: start.setupRequestID, email })
  return { setupRequestID: start.setupRequestID }
}

export async function finishEmailSetup(target: Target, options: {
  code: string
  force?: boolean
  json?: boolean
  setupRequestID: string
  username?: string
}): Promise<SetupLoginResult> {
  const client = setupClient(target)
  let output = await client.app.login.response({ setupRequestID: options.setupRequestID, response: options.code })
  if ('registrationRequired' in output && output.registrationRequired === true) {
    const nonInteractive = options.json || !process.stdin.isTTY
    if (nonInteractive && !options.force) throw new Error('Registration requires --force to accept the Beeper terms in non-interactive setup.')
    const fallback = output.usernameSuggestions?.[0]
    const username = options.username ?? (nonInteractive ? undefined : (await promptText(`Username${fallback ? ` [${fallback}]` : ''}: `)) || fallback)
    if (!username) throw new Error('Registration requires --username.')
    if (!options.force && !await promptConfirm('Accept the Beeper terms and create this account?', true)) throw new Error('Registration cancelled.')
    output = await client.app.login.register({
      acceptTerms: true,
      leadToken: output.leadToken,
      setupRequestID: output.setupRequestID,
      username,
    })
  }
  return persistSetupLogin(target, output as AppLoginSuccess)
}

function setupClient(target: Target): BeeperDesktop {
  return new BeeperDesktop({ baseURL: target.baseURL, accessToken: 'setup-login-public-client', logLevel: 'warn' })
}

async function persistSetupLogin(target: Target, data: AppLoginSuccess): Promise<SetupLoginResult> {
  const token = data.matrix?.accessToken
  if (!token) throw new Error('Setup did not return a Matrix access token.')
  const auth = { accessToken: token, source: 'email' as const, tokenType: 'Bearer' as const }
  await writeTarget({ ...target, auth })
  const [readiness, accounts] = await Promise.all([
    evaluateReadiness({ baseURL: target.baseURL, target: target.id, token }),
    connectedAccountSummary(target, auth).catch(() => []),
  ])
  return { accounts, readiness, target: publicTarget({ ...target, auth }) }
}

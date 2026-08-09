import { Flags } from '@oclif/core'
import { BeeperCommand, ensureWritable, writeEvent } from '../lib/command.js'
import { driveVerification, evaluateReadiness, type Readiness } from '../lib/app-state.js'
import { ensureDesktopToken, findLocalDesktop } from '../lib/desktop-auth.js'
import { promptText, promptYesNoDefaultYes } from '../lib/app-api.js'
import { installDesktop, installServer, readInstallations } from '../lib/installations.js'
import { connectedAccountSummary, findLocalDesktopSession, localConnectedAccountSummary, localDesktopReadiness, type LocalDesktopSession } from '../lib/local-desktop.js'
import { loginWithPKCE } from '../lib/oauth.js'
import { findDesktopAppPath, launchDesktopApp, startProfile } from '../lib/profiles.js'
import { interactiveEmailSetup } from '../lib/setup-login.js'
import { renderStartupLogo } from '../lib/logo.js'
import {
  builtInDesktopTargetID,
  createProfileTarget,
  customTargetID,
  readConfig,
  readTarget,
  listTargets,
  saveTargetAuth,
  updateConfig,
  writeTarget,
  type AuthSource,
  type Target,
} from '../lib/targets.js'
import { printData, printSuccess } from '../lib/output.js'

export default class Setup extends BeeperCommand {
  static override summary = 'Make the selected target ready for messaging'
  static override flags = {
    local: Flags.boolean({ default: false, description: 'Use the local Beeper Desktop session on this device' }),
    oauth: Flags.boolean({ default: false, description: 'Authorize the target with browser OAuth/PKCE' }),
    remote: Flags.string({ description: 'Connect to a remote Beeper Desktop or Server URL' }),
    server: Flags.boolean({ default: false, description: 'Set up a local Beeper Server target' }),
    desktop: Flags.boolean({ default: false, description: 'Set up a local Beeper Desktop target' }),
    install: Flags.boolean({ default: false, description: 'Allow installing missing managed runtime' }),
    channel: Flags.string({ options: ['stable', 'nightly'], default: 'stable', description: 'Install release channel' }),
    'server-env': Flags.string({ options: ['production', 'staging'], default: 'production', description: 'Server environment (production or staging)' }),
    email: Flags.string({ description: 'Sign in with an email address' }),
    username: Flags.string({ description: 'Username to use if setup creates a new account' }),
  }

  static override examples = [
    'beeper setup --local',
    'beeper setup --oauth',
    'beeper setup --remote https://my-beeper.example.com',
    'beeper setup --server --install',
    'beeper setup --desktop --install',
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(Setup)
    ensureWritable(flags)
    const targetModeCount = [Boolean(flags.remote), flags.server, flags.desktop].filter(Boolean).length
    if (targetModeCount > 1) throw new Error('Specify at most one of --remote, --server, or --desktop')
    const authModeCount = [flags.local, flags.oauth, Boolean(flags.email)].filter(Boolean).length
    if (authModeCount > 1) throw new Error('Specify at most one of --local, --oauth, or --email')
    if ((flags.local || flags.oauth) && (flags.remote || flags.server || flags.desktop)) {
      throw new Error('Use --local or --oauth with an existing target, not with --remote, --server, or --desktop.')
    }
    if (flags.events) writeEvent('setup_step', { step: 'start', target: flags.target })

    if (flags.remote) {
      await this.setupRemote(flags)
      return
    }
    if (flags.server) {
      await this.setupManaged('server', flags)
      return
    }
    if (flags.desktop) {
      await this.setupManaged('desktop', flags)
      return
    }

    const target = await setupTarget(flags)
    if (flags.local) {
      await this.setupLocal(target, flags)
      return
    }
    if (flags.oauth) {
      await this.setupOAuth(target, flags)
      return
    }
    if (flags.email) {
      await this.setupEmail(target, flags)
      return
    }

    await this.setupDefault(target, flags)
  }

  private async setupDefault(target: Target, flags: SetupFlags): Promise<void> {
    const setupCmd = setupCommand(target)
    printSetupHeader(flags)
    printResumeBanner(target, flags)
    if (target.type === 'desktop') {
      const detected = await detectDesktopSetup(target, flags)
      if (detected.kind === 'session-found') {
        const local = detected.local
        if (flags.yes) {
          await this.printSetupResult(await commitLocalDesktopSetup(local), flags)
          return
        }
        if (flags.json || !process.stdin.isTTY) {
          await printData(setupSessionFoundOutput(local, setupCmd), flags.json ? 'json' : 'human')
          return
        }
        printLocalDesktopPreview(local)
        if (await promptYesNoDefaultYes('Use this Desktop session for CLI access?')) {
          await this.printSetupResult(await commitLocalDesktopSetup(local), flags)
          return
        }
        await printSuccess({
          message: local.readiness.state === 'ready' ? 'Beeper Desktop is ready' : `Setup paused: ${local.readiness.state}`,
          detail: setupDetailForReadiness(local.readiness, local.target),
          data: { target: publicTarget(local.target), readiness: local.readiness },
        }, 'human')
        return
      } else if (flags.json || !process.stdin.isTTY) {
        await printData(setupStateOutput(detected, target), flags.json ? 'json' : 'human')
        return
      } else if (detected.kind === 'installed-not-running' && !flags.json && process.stdin.isTTY) {
        printStatus('Found Beeper Desktop on this device.', 'installed, not running')
        const shouldLaunch = flags.yes || await promptYesNoDefaultYes('Launch Beeper Desktop now?')
        if (shouldLaunch) {
          await launchAndPoll(target, setupCmd, flags)
          return
        }
      } else if (detected.kind === 'running-signed-out' && !flags.json && process.stdin.isTTY) {
        printStatus('Found Beeper Desktop on this device.', 'running, signed out')
        const shouldOpen = flags.yes || await promptYesNoDefaultYes('Open Beeper Desktop so you can sign in?')
        if (shouldOpen) {
          await launchAndPoll(target, setupCmd, flags)
          return
        }
      } else if (detected.kind === 'session-unreadable' && !flags.json && process.stdin.isTTY) {
        printStatus('Found Beeper Desktop on this device.', 'signed in, but CLI could not read the local session')
        process.stdout.write('You can still connect through Beeper Desktop.\n')
        if (flags.debug) process.stdout.write(`\n${detected.reason}\n`)
        process.stdout.write('\n')
        const useOAuth = flags.yes || await promptYesNoDefaultYes('Connect through Beeper Desktop instead?')
        if (useOAuth) {
          await this.setupOAuth(target, flags)
          return
        }
      } else if (detected.kind === 'not-installed' && !flags.json && process.stdin.isTTY) {
        await this.setupFromChoice(flags)
        return
      }
    }

    const readiness = await evaluateReadiness({ baseURL: target.baseURL, target: target.id })
    if (readiness.state === 'target-unreachable' && target.type !== 'desktop') {
      if (flags.json || !process.stdin.isTTY) {
        await printData(currentTargetBrokenOutput(target, readiness), flags.json ? 'json' : 'human')
        return
      }
      if (await this.handleBrokenCurrentTarget(target, readiness, flags)) return
    }
    if (readiness.state === 'target-unreachable' && target.type === 'desktop' && !flags.json && process.stdin.isTTY) {
      const shouldLaunch = flags.yes || await promptYesNoDefaultYes('Beeper Desktop is not reachable. Launch it now?')
      if (shouldLaunch) {
        await launchAndPoll(target, setupCmd, flags)
        return
      }
    }

    if (flags.json || !process.stdin.isTTY) {
      await printData({ target: publicTarget(target), readiness }, flags.json ? 'json' : 'human')
      return
    }

    await printSuccess({
      message: readiness.state === 'ready' ? 'Target ready' : `Setup paused: ${readiness.state}`,
      detail: setupDetailForReadiness(readiness, target),
      data: { target: publicTarget(target), readiness },
    }, 'human')
  }

  private async setupLocal(target: Target, flags: SetupFlags): Promise<void> {
    const result = await setupLocalDesktop(target, flags)
    await this.printSetupResult(result, flags)
  }

  private async setupOAuth(target: Target, flags: SetupFlags): Promise<void> {
    const result = await setupOAuthTarget(target, flags)
    await this.printSetupResult(result, flags)
  }

  private async setupEmail(target: Target, flags: SetupFlags): Promise<void> {
    const result = await setupEmailTarget(target, flags)
    await this.printSetupResult(result, flags)
  }

  private async setupRemote(flags: SetupFlags): Promise<void> {
    const name = flags.target ?? await uniqueRemoteName(flags.remote!)
    if (!flags.json && process.stdin.isTTY) {
      process.stdout.write('Connecting to Desktop API on another device.\n\n')
      process.stdout.write(`Name: ${name}\n`)
      process.stdout.write(`URL:  ${flags.remote!}\n\n`)
    }
    const target: Target = {
      id: name,
      name,
      type: 'remote',
      baseURL: flags.remote!,
      managed: false,
    }
    const result = flags.email ? await setupEmailTarget(target, flags) : await setupOAuthTarget(target, flags, 'remote-oauth')
    await writeTarget(target)
    if (!flags.target) await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? target.id }))
    await this.printSetupResult(result, flags)
  }

  private async setupManaged(type: 'desktop' | 'server', flags: SetupFlags): Promise<void> {
    if (flags.install) {
      if ((flags.json || !process.stdin.isTTY) && !flags.yes) throw new Error('Install requires --install --yes in non-interactive mode.')
      if (type === 'desktop') await installWithCopy('desktop', flags)
      else await installWithCopy('server', flags)
    }
    const id = flags.target ?? type
    const target = await readTarget(id) ?? await createProfileTarget(type, id, { serverEnv: flags['server-env'], port: undefined })
    if (!flags.target) await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? target.id }))
    await startProfile(target).catch(error => {
      if (type === 'desktop') return undefined
      throw error
    })
    if (flags.email) {
      await this.setupEmail(target, flags)
      return
    }
    const readiness = await evaluateReadiness({ baseURL: target.baseURL, target: target.id })
    await printData({ target: publicTarget(target), readiness }, flags.json ? 'json' : 'human')
  }

  private async printSetupResult(result: SetupResult, flags: SetupFlags): Promise<void> {
    result = await maybeDriveOnboarding(result, flags)
    if (flags.json || !process.stdin.isTTY) {
      await printData(result, flags.json ? 'json' : 'human')
      return
    }
    await printSuccess({
      message: result.readiness.state === 'ready'
        ? `Connected to ${result.target.name ?? result.target.id}`
        : `Connected; setup paused: ${result.readiness.state}`,
      detail: setupResultDetail(result),
      data: result,
    }, 'human')
    if (result.readiness.state === 'ready') printNextSteps()
  }

  private async setupFromChoice(flags: SetupFlags): Promise<void> {
    process.stdout.write('No usable Beeper Desktop session was found on this device.\n\n')
    process.stdout.write('How do you want to connect Beeper CLI?\n\n')
    process.stdout.write('  1. Install Beeper Desktop\n')
    process.stdout.write('  2. Install local Beeper Server\n')
    process.stdout.write('  3. Connect with Desktop API on another device\n\n')
    const choice = await promptChoice('Choose [1]: ', ['1', '2', '3'], '1')
    if (choice === '1') {
      if (!await promptYesNoDefaultYes('Install Beeper Desktop stable from beeper.com?')) return
      await installWithCopy('desktop', { ...flags, channel: 'stable' })
      const target = await setupTarget({ ...flags, desktop: true })
      await launchAndPoll(target, setupCommand(target), flags)
      return
    }
    if (choice === '2') {
      if (!await promptYesNoDefaultYes('Install local Beeper Server stable from beeper.com?')) return
      await installWithCopy('server', { ...flags, channel: 'stable', 'server-env': 'production' })
      await this.setupManaged('server', { ...flags, install: false, server: true, channel: 'stable' })
      return
    }
    const url = await promptText('Desktop API URL: ')
    if (!url) throw new Error('Remote URL is required.')
    await this.setupRemote({ ...flags, remote: url })
  }

  private async handleBrokenCurrentTarget(target: Target, readiness: Readiness, flags: SetupFlags): Promise<boolean> {
    process.stdout.write(`Beeper CLI is set up for ${target.name ?? target.id}, but it is not reachable.\n\n`)
    if (readiness.message) process.stdout.write(`${readiness.message}\n\n`)
    process.stdout.write('What do you want to do?\n\n')
    process.stdout.write(`  1. Retry ${target.name ?? target.id}\n`)
    process.stdout.write('  2. Use Beeper Desktop on this device\n')
    process.stdout.write('  3. Install local Beeper Server\n')
    process.stdout.write('  4. Connect with Desktop API on another device\n\n')
    const choice = await promptChoice('Choose [1]: ', ['1', '2', '3', '4'], '1')
    if (choice === '1') return false
    if (choice === '2') {
      const desktop = await defaultDesktopTarget()
      await this.setupDefault(desktop, { ...flags, target: desktop.id })
      return true
    }
    if (choice === '3') {
      if (!await promptYesNoDefaultYes('Install local Beeper Server stable from beeper.com?')) return true
      await installWithCopy('server', { ...flags, channel: 'stable', 'server-env': 'production' })
      await this.setupManaged('server', { ...flags, install: false, server: true, channel: 'stable' })
      return true
    }
    const url = await promptText('Desktop API URL: ')
    if (!url) throw new Error('Remote URL is required.')
    await this.setupRemote({ ...flags, remote: url })
    return true
  }
}

type SetupFlags = {
  'base-url'?: string
  channel?: string
  debug?: boolean
  desktop?: boolean
  events?: boolean
  install?: boolean
  json?: boolean
  local?: boolean
  oauth?: boolean
  email?: string
  remote?: string
  server?: boolean
  'server-env'?: string
  target?: string
  username?: string
  yes?: boolean
}

type SetupResult = {
  accounts: string[]
  authSource?: AuthSource
  readiness: Awaited<ReturnType<typeof evaluateReadiness>>
  target: ReturnType<typeof publicTarget>
}

type PreparedLocalDesktopSetup = {
  accounts: string[]
  readiness: Readiness
  session: LocalDesktopSession
  target: Target
}

type DesktopSetupDetection =
  | { kind: 'session-found'; local: PreparedLocalDesktopSetup }
  | { kind: 'installed-not-running' }
  | { kind: 'running-signed-out'; readiness?: Readiness }
  | { kind: 'session-unreadable'; reason: string; readiness?: Readiness }
  | { kind: 'not-installed' }

async function setupTarget(flags: SetupFlags): Promise<Target> {
  if (flags['base-url']) return { id: customTargetID, type: 'desktop', baseURL: flags['base-url'] }
  if (flags.target) {
    const target = await readTarget(flags.target)
    if (!target) throw new Error(`Unknown Beeper target "${flags.target}". Run \`beeper targets list\`.`)
    return target
  }
  const config = await readConfig()
  if (config.defaultTarget) {
    const target = await readTarget(config.defaultTarget)
    if (target) return target
  }
  const desktop = await readTarget(builtInDesktopTargetID)
  if (desktop) return desktop
  return defaultDesktopTarget()
}

async function defaultDesktopTarget(): Promise<Target> {
  const detected = await findLocalDesktop({ scan: true, timeoutMs: 300 }).catch(() => undefined)
  const target: Target = {
    id: builtInDesktopTargetID,
    type: 'desktop',
    name: 'Beeper Desktop',
    baseURL: detected?.baseURL ?? 'http://127.0.0.1:23373',
    managed: false,
    runtime: { install: 'desktop', port: 23373 },
  }
  await writeTarget(target)
  await updateConfig(next => ({ ...next, defaultTarget: next.defaultTarget ?? target.id }))
  return target
}

async function setupLocalDesktop(target: Target, flags: SetupFlags): Promise<SetupResult> {
  return commitLocalDesktopSetup(await prepareLocalDesktopSetup(target, flags))
}

async function prepareLocalDesktopSetup(target: Target, flags: SetupFlags): Promise<PreparedLocalDesktopSetup> {
  if (flags.events) writeEvent('setup_step', { step: 'local-desktop', target: target.id })
  const desktop = await findLocalDesktop({ baseURL: target.baseURL, scan: target.id === builtInDesktopTargetID, timeoutMs: 500 }).catch(() => undefined)
  const resolvedTarget: Target = {
    ...target,
    id: target.id === customTargetID ? builtInDesktopTargetID : target.id,
    type: 'desktop',
    name: target.name ?? 'Beeper Desktop',
    baseURL: desktop?.baseURL ?? target.baseURL,
    managed: target.managed ?? false,
  }
  const session = await findLocalDesktopSession(resolvedTarget)
  const readiness = localDesktopReadiness(session)
  const accounts = await localConnectedAccountSummary(session.dataDir).catch(() => [])
  return { accounts, readiness, session, target: resolvedTarget }
}

async function detectDesktopSetup(target: Target, flags: SetupFlags): Promise<DesktopSetupDetection> {
  printProgress(flags, 'Checking Beeper Desktop')
  const appInstalled = await isDesktopAppInstalled()
  printProgress(flags, 'Reading local Desktop session')
  const local = await prepareLocalDesktopSetup(target, flags).catch(error => ({ error }))
  if (!('error' in local)) return { kind: 'session-found', local }

  printProgress(flags, 'Checking Desktop readiness')
  const desktop = await findLocalDesktop({ baseURL: target.baseURL, scan: target.id === builtInDesktopTargetID, timeoutMs: 500 }).catch(() => undefined)
  if (desktop) {
    const readiness = await evaluateReadiness({ baseURL: desktop.baseURL, target: target.id, token: false })
    if (readiness.state === 'needs-login') return { kind: 'running-signed-out', readiness }
    return {
      kind: 'session-unreadable',
      reason: local.error instanceof Error ? local.error.message : String(local.error),
      readiness,
    }
  }

  return appInstalled ? { kind: 'installed-not-running' } : { kind: 'not-installed' }
}

async function isDesktopAppInstalled(): Promise<boolean> {
  const installations = await readInstallations().catch((): Awaited<ReturnType<typeof readInstallations>> => ({}))
  return Boolean(installations.desktop?.path || await findDesktopAppPath())
}

async function commitLocalDesktopSetup(prepared: PreparedLocalDesktopSetup): Promise<SetupResult> {
  await writeTarget(prepared.target)
  await saveTargetAuth(prepared.target, prepared.session.auth)
  await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? prepared.target.id }))
  return {
    accounts: prepared.accounts,
    authSource: prepared.session.auth.source,
    readiness: prepared.readiness,
    target: publicTarget({ ...prepared.target, auth: prepared.session.auth }),
  }
}

async function setupOAuthTarget(target: Target, flags: SetupFlags, source?: AuthSource): Promise<SetupResult> {
  if (flags.events) writeEvent('setup_step', { step: 'oauth', target: target.id })
  if ((flags.json || !process.stdin.isTTY) && !flags.yes) throw new Error('OAuth setup requires an interactive terminal or --yes to open the browser.')
  const authSource = source ?? (target.type === 'remote' ? 'remote-oauth' : 'desktop-oauth')
  const token = target.type === 'desktop' && target.id === builtInDesktopTargetID
    ? await ensureDesktopToken({ baseURL: target.baseURL, save: false, scan: true })
    : await loginWithPKCE({
      baseURL: target.baseURL,
      clientName: 'Beeper CLI',
      openBrowser: true,
      save: false,
      scope: 'read write',
      source: authSource,
    })
  const auth = typeof token === 'string'
    ? { accessToken: token, source: authSource, tokenType: 'Bearer' as const }
    : {
      accessToken: token.access_token,
      clientID: token.clientID,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
      scope: token.scope,
      source: authSource,
      tokenType: token.token_type,
    }
  await writeTarget(target)
  await saveTargetAuth(target, auth)
  const [readiness, accounts] = await Promise.all([
    evaluateReadiness({ baseURL: target.baseURL, target: target.id, token: auth.accessToken }),
    connectedAccountSummary(target, auth).catch(() => []),
  ])
  return { accounts, authSource, readiness, target: publicTarget({ ...target, auth }) }
}

async function setupEmailTarget(target: Target, flags: SetupFlags): Promise<SetupResult> {
  if (flags.events) writeEvent('setup_step', { step: 'email', target: target.id })
  const email = flags.email
  if (!email) throw new Error('Email setup requires --email.')
  if (flags.json || !process.stdin.isTTY) throw new Error('Email setup prompts for the verification code. For automation, use `beeper auth email start` and `beeper auth email response`.')
  return interactiveEmailSetup(target, { email, username: flags.username, yes: flags.yes, json: flags.json })
}

function publicTarget(target: Target): Omit<Target, 'auth'> & { auth?: { source?: AuthSource; tokenType?: 'Bearer' } } {
  const { auth, ...rest } = target
  return { ...rest, auth: auth ? { source: auth.source, tokenType: auth.tokenType } : undefined }
}

function localDesktopPreview(prepared: PreparedLocalDesktopSetup): Record<string, unknown> {
  return {
    authSource: prepared.session.auth.source,
    baseURL: prepared.target.baseURL,
    dataDir: prepared.session.dataDir,
    signedInAs: prepared.session.userID,
    connectedAccounts: prepared.accounts,
  }
}

function printLocalDesktopPreview(prepared: PreparedLocalDesktopSetup): void {
  process.stdout.write('Found Beeper Desktop on this device.\n\n')
  process.stdout.write(`Status: ${prepared.readiness.state === 'ready' ? 'signed in and ready' : prepared.readiness.state}\n`)
  if (prepared.session.userID) process.stdout.write(`Signed in as: ${prepared.session.userID}\n`)
  if (prepared.accounts.length) process.stdout.write(`Connected accounts: ${prepared.accounts.join(', ')}\n`)
  process.stdout.write('\n')
}

function setupSessionFoundOutput(local: PreparedLocalDesktopSetup, setupCmd: string): Record<string, unknown> {
  return {
    state: local.readiness.state === 'ready' ? 'desktop-ready' : 'desktop-session-found',
    message: local.readiness.state === 'ready'
      ? 'Beeper Desktop is signed in and ready.'
      : 'Beeper Desktop is signed in, but setup is not finished.',
    target: publicTarget(local.target),
    readiness: local.readiness,
    localDesktop: localDesktopPreview(local),
    recommendedAction: action('use-desktop-session', `${setupCmd} --local`),
    availableActions: [
      action('use-desktop-session', `${setupCmd} --local`),
      action('desktop-oauth', `${setupCmd} --oauth`),
      action('connect-remote', 'beeper setup --remote <url>'),
    ],
  }
}

function printSetupHeader(flags: SetupFlags): void {
  if (flags.json || !process.stdin.isTTY || process.env.BEEPER_QUIET === '1') return
  process.stdout.write(`${renderStartupLogo()}\n\n`)
  process.stdout.write('Setup\n\n')
}

function printResumeBanner(target: Target, flags: SetupFlags): void {
  if (flags.json || !process.stdin.isTTY || process.env.BEEPER_QUIET === '1') return
  if (target.id !== builtInDesktopTargetID || flags.target) process.stdout.write(`Continuing setup for ${target.name ?? target.id}.\n\n`)
}

function printStatus(title: string, status: string): void {
  process.stdout.write(`${title}\n\n`)
  process.stdout.write(`Status: ${status}\n\n`)
}

function printProgress(flags: SetupFlags, message: string): void {
  if (flags.json || !process.stdin.isTTY || process.env.BEEPER_QUIET === '1') return
  process.stdout.write(`${message}...\n`)
}

async function promptChoice(label: string, allowed: string[], fallback: string): Promise<string> {
  const value = await promptText(label)
  const normalized = value || fallback
  if (!allowed.includes(normalized)) throw new Error(`Choose one of: ${allowed.join(', ')}`)
  return normalized
}

async function launchAndPoll(target: Target, setupCmd: string, flags: SetupFlags): Promise<void> {
  if (flags.events) writeEvent('setup_step', { step: 'launch', target: target.id })
  if (!flags.json && process.stdin.isTTY) process.stdout.write('Opening Beeper Desktop...\n')
  await launchDesktopApp(target)
  const readiness = await pollReadiness(target, 10_000)
  const detail = readiness.state === 'target-unreachable'
    ? `Run \`${setupCmd}\` again after Beeper Desktop finishes starting.`
    : setupDetailForReadiness(readiness, target)
  await printSuccess({
    message: 'Launched Beeper Desktop',
    detail,
    data: { target: publicTarget(target), readiness },
  }, flags.json ? 'json' : 'human')
  if (!flags.json && process.stdin.isTTY && readiness.state === 'target-unreachable') {
    process.stdout.write('\nNext:\n')
    process.stdout.write(`  ${setupCmd}\n`)
    process.stdout.write('  beeper doctor\n')
  }
}

async function pollReadiness(target: Target, timeoutMs: number): Promise<Readiness> {
  const started = Date.now()
  let readiness = await evaluateReadiness({ baseURL: target.baseURL, target: target.id, token: false })
  while (readiness.state === 'target-unreachable' && Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 500))
    readiness = await evaluateReadiness({ baseURL: target.baseURL, target: target.id, token: false })
  }
  return readiness
}

async function maybeDriveOnboarding(result: SetupResult, flags: SetupFlags): Promise<SetupResult> {
  if (flags.json || !process.stdin.isTTY) return result
  if (result.readiness.state !== 'needs-verification' && result.readiness.state !== 'verification-in-progress') return result
  process.stdout.write('Continuing verification...\n\n')
  await driveVerification({ baseURL: result.target.baseURL, target: result.target.id, yes: flags.yes })
  return {
    ...result,
    readiness: await evaluateReadiness({ baseURL: result.target.baseURL, target: result.target.id }),
    target: result.target,
  }
}

async function installWithCopy(type: 'desktop' | 'server', flags: SetupFlags): Promise<void> {
  const label = type === 'desktop' ? 'Beeper Desktop' : 'local Beeper Server'
  const channel = flags.channel === 'nightly' ? 'nightly' : 'stable'
  const serverEnv = flags['server-env'] === 'staging' ? 'staging' : 'production'
  if (!flags.json && process.stdin.isTTY) process.stdout.write(`Installing ${label} ${channel} from beeper.com...\n`)
  if (type === 'desktop') await installDesktop({ channel, serverEnv })
  else await installServer({ channel, serverEnv })
  if (!flags.json && process.stdin.isTTY) process.stdout.write(`Installed ${label} ${channel}.\n\n`)
}

function setupResultDetail(result: SetupResult): string | undefined {
  const detail = setupDetailForReadiness(result.readiness, result.target)
  if (result.accounts.length && detail) return `Connected accounts: ${result.accounts.join(', ')}\n${detail}`
  if (result.accounts.length) return `Connected accounts: ${result.accounts.join(', ')}`
  return detail
}

function printNextSteps(): void {
  process.stdout.write('\nNext:\n')
  process.stdout.write('  beeper chats list\n')
  process.stdout.write('  beeper send text --to <chat> "hello"\n')
}

function setupStateOutput(detected: Exclude<DesktopSetupDetection, { kind: 'session-found' }>, target: Target): Record<string, unknown> {
  if (detected.kind === 'installed-not-running') {
    return setupActionEnvelope({
      state: 'desktop-installed-not-running',
      message: 'Beeper Desktop is installed but not running.',
      target,
      recommendedAction: action('launch-desktop', 'beeper setup --desktop --yes'),
      availableActions: [
        action('launch-desktop', 'beeper setup --desktop --yes'),
        action('connect-remote', 'beeper setup --remote <url>'),
        action('install-server', 'beeper setup --server --install --yes'),
      ],
    })
  }
  if (detected.kind === 'running-signed-out') {
    return setupActionEnvelope({
      state: 'desktop-running-signed-out',
      message: 'Beeper Desktop is running but not signed in.',
      target,
      readiness: detected.readiness,
      recommendedAction: action('open-desktop', 'beeper setup --desktop --yes'),
      availableActions: [
        action('open-desktop', 'beeper setup --desktop --yes'),
        action('connect-remote', 'beeper setup --remote <url>'),
      ],
    })
  }
  if (detected.kind === 'session-unreadable') {
    return setupActionEnvelope({
      state: 'desktop-running-session-unreadable',
      message: 'Beeper Desktop is running, but CLI could not read the local session.',
      target,
      readiness: detected.readiness,
      detail: detected.reason,
      recommendedAction: action('desktop-oauth', 'beeper setup --oauth --yes'),
      availableActions: [
        action('desktop-oauth', 'beeper setup --oauth --yes'),
        action('connect-remote', 'beeper setup --remote <url>'),
      ],
    })
  }
  return setupActionEnvelope({
    state: 'desktop-not-installed',
    message: 'No Beeper Desktop installation was found on this device.',
    target,
    recommendedAction: action('install-desktop', 'beeper setup --desktop --install --yes'),
    availableActions: [
      action('install-desktop', 'beeper setup --desktop --install --yes'),
      action('install-server', 'beeper setup --server --install --yes'),
      action('connect-remote', 'beeper setup --remote <url>'),
    ],
  })
}

function currentTargetBrokenOutput(target: Target, readiness: Readiness): Record<string, unknown> {
  return {
    state: 'current-target-unreachable',
    message: `Beeper CLI is set up for ${target.name ?? target.id}, but it is not reachable.`,
    target: publicTarget(target),
    readiness,
    recommendedAction: action('retry-current', `beeper setup -t ${target.id}`),
    availableActions: [
      action('retry-current', `beeper setup -t ${target.id}`),
      action('use-desktop', 'beeper setup --desktop'),
      action('install-server', 'beeper setup --server --install --yes'),
      action('connect-remote', 'beeper setup --remote <url>'),
    ],
  }
}

function setupActionEnvelope(options: {
  state: string
  message: string
  target: Target
  detail?: string
  readiness?: Readiness
  recommendedAction: ReturnType<typeof action>
  availableActions: Array<ReturnType<typeof action>>
}): Record<string, unknown> {
  return {
    state: options.state,
    message: options.message,
    detail: options.detail,
    target: publicTarget(options.target),
    readiness: options.readiness,
    recommendedAction: options.recommendedAction,
    availableActions: options.availableActions,
  }
}

function action(id: string, command: string): { id: string; command: string } {
  return { id, command }
}

function setupDetailForReadiness(readiness: Readiness, target: Pick<Target, 'id'>): string | undefined {
  if (readiness.state === 'needs-login') return 'Sign in to Beeper Desktop, then run `beeper setup` again.'
  if (readiness.state === 'needs-verification' || readiness.state === 'verification-in-progress') return 'Continue verification to finish setup.'
  if (readiness.state === 'needs-recovery-key' || readiness.state === 'needs-secrets') return `Run \`beeper verify recovery-key${target.id === builtInDesktopTargetID ? '' : ` -t ${target.id}`}\`.`
  if (readiness.state === 'needs-cross-signing-setup') return `Run \`beeper verify reset-recovery-key${target.id === builtInDesktopTargetID ? '' : ` -t ${target.id}`}\`.`
  if (readiness.state === 'needs-first-sync' || readiness.state === 'initializing') return 'Beeper is still syncing. You can rerun `beeper setup` at any time.'
  return readiness.message
}

async function uniqueRemoteName(url: string): Promise<string> {
  const base = remoteName(url)
  const targets = await listTargets()
  const ids = new Set(targets.map(target => target.id))
  if (!ids.has(base)) return base
  for (let index = 2; index < 100; index += 1) {
    const id = `${base}-${index}`
    if (!ids.has(id)) return id
  }
  return `remote-${Date.now()}`
}

function setupCommand(target: Target): string {
  return target.id === builtInDesktopTargetID ? 'beeper setup' : `beeper setup -t ${target.id}`
}

function remoteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-zA-Z0-9._-]/g, '-') || 'remote'
  } catch {
    return 'remote'
  }
}

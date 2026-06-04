import { access } from 'node:fs/promises'
import { driveVerification, evaluateReadiness, type Readiness } from '../lib/app-state.js'
import { authFromToken, authorizeTarget, findLocalDesktop } from '../lib/desktop-auth.js'
import { installDesktop, installServer, readInstallations, type Installations } from '../lib/installations.js'
import { connectedAccountSummary, findLocalDesktopSession, localConnectedAccountSummary, localDesktopReadiness, type LocalDesktopSession } from '../lib/local-desktop.js'
import { renderStartupLogo } from '../lib/logo.js'
import { promptChoice, promptConfirm, promptText } from '../lib/prompts.js'
import { findDesktopAppPath, launchDesktopApp, startProfile } from '../lib/profiles.js'
import { SERVER_ENV_API_BASE_URLS, normalizeServerEnv } from '../lib/server-env.js'
import { finishEmailSetup, startEmailSetup, type SetupLoginResult } from '../lib/setup-login.js'
import {
  builtInDesktopTargetID,
  createDefaultDesktopTarget,
  createProfileTarget,
  listTargets,
  publicTarget,
  readConfig,
  readTarget,
  updateConfig,
  writeTarget,
  type ManagedTargetType,
  type Target,
} from '../lib/targets.js'
import type { CommandContext } from './types.js'
import { usage, writeEvent } from './output.js'
import { stringFlag } from './parse.js'

type SetupFlags = {
  'server-env': string
  channel: string
  debug: boolean
  desktop: boolean
  email?: string
  events: boolean
  install: boolean
  json: boolean
  local: boolean
  oauth: boolean
  remote?: string
  server: boolean
  target?: string
  username?: string
  force: boolean
}

type PreparedLocalDesktopSetup = {
  accounts: string[]
  readiness: Readiness
  session: LocalDesktopSession
  target: Target
}

type DesktopSetupDetection =
  | { kind: 'session-found'; local: PreparedLocalDesktopSetup; serverInstalled: boolean }
  | { kind: 'installed-not-running'; serverInstalled: boolean }
  | { kind: 'running-signed-out'; readiness?: Readiness; serverInstalled: boolean }
  | { kind: 'session-unreadable'; reason: string; readiness?: Readiness; serverInstalled: boolean }
  | { kind: 'not-installed'; serverInstalled: boolean }

type SetupAction = { command: string; id: string }

export async function runSetup(ctx: CommandContext): Promise<unknown> {
  const flags = setupFlags(ctx)
  const targetModeCount = [Boolean(flags.remote), flags.server, flags.desktop].filter(Boolean).length
  if (targetModeCount > 1) throw usage('Specify at most one of --remote, --server, or --desktop')
  const authModeCount = [flags.local, flags.oauth, Boolean(flags.email)].filter(Boolean).length
  if (authModeCount > 1) throw usage('Specify at most one of --local, --oauth, or --email')
  if ((flags.local || flags.oauth) && (flags.remote || flags.server || flags.desktop)) {
    throw usage('Use --local or --oauth with an existing target, not with --remote, --server, or --desktop.')
  }
  if (ctx.globalFlags.dryRun) {
    return {
      dry_run: true,
      op: 'setup',
      request: {
        authMode: flags.local ? 'local' : flags.oauth ? 'oauth' : flags.email ? 'email' : 'auto',
        channel: flags.channel,
        email: flags.email,
        install: flags.install,
        remote: flags.remote,
        serverEnv: flags['server-env'],
        target: flags.target,
        targetMode: flags.remote ? 'remote' : flags.server ? 'server' : flags.desktop ? 'desktop' : 'selected',
        username: flags.username,
        force: flags.force,
      },
    }
  }
  if (flags.events) writeEvent('setup_step', { step: 'start', target: flags.target })

  if (flags.remote) return setupRemote(flags)
  if (flags.server) return setupManaged('server', flags)
  if (flags.desktop) return setupManaged('desktop', flags)

  const target = await setupTarget(flags)
  if (flags.local) {
    const prepared = await prepareLocalDesktopSetup(target, flags)
    return printSetupResult(await commitLocalDesktopSetup(prepared), flags)
  }
  if (flags.oauth) return printSetupResult(await setupOAuthTarget(target, flags), flags)
  if (flags.email) return printSetupResult(await setupEmailTarget(target, flags), flags)
  return setupDefault(target, flags)
}

function setupFlags(ctx: CommandContext): SetupFlags {
  return {
    'server-env': stringFlag(ctx.flags, 'server-env') || 'prod',
    channel: stringFlag(ctx.flags, 'channel') || 'stable',
    debug: ctx.globalFlags.debug,
    desktop: ctx.flags.desktop === true,
    email: stringFlag(ctx.flags, 'email'),
    events: ctx.globalFlags.events,
    install: ctx.flags.install === true,
    json: ctx.globalFlags.json,
    local: ctx.flags.local === true,
    oauth: ctx.flags.oauth === true,
    remote: stringFlag(ctx.flags, 'remote'),
    server: ctx.flags.server === true,
    target: ctx.globalFlags.target,
    username: stringFlag(ctx.flags, 'username'),
    force: ctx.globalFlags.force,
  }
}

async function setupDefault(target: Target, flags: SetupFlags): Promise<unknown> {
  const setupCmd = setupCommand(target)
  if (interactive(flags)) {
    process.stdout.write(`${renderStartupLogo()}\n\n`)
    process.stdout.write('Setup\n\n')
    if (target.id !== builtInDesktopTargetID || flags.target) process.stdout.write(`Continuing setup for ${target.name ?? target.id}.\n\n`)
  }
  if (target.type === 'desktop') {
    const detected = await detectDesktopSetup(target, flags)
    if (detected.kind === 'session-found') {
      const local = detected.local
      if (flags.force) return printSetupResult(await commitLocalDesktopSetup(local), flags)
      if (!interactive(flags)) return setupSessionFoundOutput(local, setupCmd, detected.serverInstalled)
      printLocalDesktopPreview(local)
      if (await promptConfirm('Use this Desktop session for CLI access?', true)) {
        return printSetupResult(await commitLocalDesktopSetup(local), flags)
      }
      return printInteractiveSetupStatus(
        local.readiness.state === 'ready' ? 'Beeper Desktop is ready' : `Setup paused: ${local.readiness.state}`,
        setupDetailForReadiness(local.readiness),
      )
    }
    if (!interactive(flags)) return setupStateOutput(detected, target)
    if (detected.kind === 'installed-not-running') {
      printStatus('Found Beeper Desktop on this device.', 'installed, not running')
      if (flags.force || await promptConfirm('Launch Beeper Desktop now?', true)) return launchAndPoll(target, setupCmd, flags)
    } else if (detected.kind === 'running-signed-out') {
      printStatus('Found Beeper Desktop on this device.', 'running, signed out')
      if (flags.force || await promptConfirm('Open Beeper Desktop so you can sign in?', true)) return launchAndPoll(target, setupCmd, flags)
    } else if (detected.kind === 'session-unreadable') {
      printStatus('Found Beeper Desktop on this device.', 'signed in, but CLI could not read the local session')
      process.stdout.write('You can still connect through Beeper Desktop.\n')
      if (flags.debug) process.stdout.write(`\n${detected.reason}\n`)
      process.stdout.write('\n')
      if (flags.force || await promptConfirm('Connect through Beeper Desktop instead?', true)) {
        return printSetupResult(await setupOAuthTarget(target, flags), flags)
      }
    } else if (detected.kind === 'not-installed') {
      return setupFromChoice(flags)
    }
  }

  const readiness = await evaluateReadiness({ baseURL: target.baseURL, target: target.id })
  if (readiness.state === 'target-unreachable' && target.type !== 'desktop') {
    if (!interactive(flags)) {
      return currentTargetBrokenOutput(target, readiness, await isServerInstalled())
    }
    if (await handleBrokenCurrentTarget(target, readiness, flags)) return undefined
  }
  if (readiness.state === 'target-unreachable' && target.type === 'desktop' && interactive(flags)) {
    if (flags.force || await promptConfirm('Beeper Desktop is not reachable. Launch it now?', true)) {
      return launchAndPoll(target, setupCmd, flags)
    }
  }
  if (!interactive(flags)) return { readiness, target: publicTarget(target) }
  return printInteractiveSetupStatus(
    readiness.state === 'ready' ? 'Target ready' : `Setup paused: ${readiness.state}`,
    setupDetailForReadiness(readiness),
  )
}

async function setupRemote(flags: SetupFlags): Promise<unknown> {
  const name = flags.target ?? await uniqueRemoteName(flags.remote!)
  if (interactive(flags)) {
    process.stdout.write('Connecting to Desktop API on another device.\n\n')
    process.stdout.write(`Name: ${name}\n`)
    process.stdout.write(`URL:  ${flags.remote!}\n\n`)
  }
  const target: Target = {
    baseURL: flags.remote!,
    id: name,
    name,
    type: 'remote',
  }
  const result = flags.email ? await setupEmailTarget(target, flags) : await setupOAuthTarget(target, flags)
  if (!flags.target) await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? target.id }))
  return printSetupResult(result, flags)
}

async function setupManaged(type: ManagedTargetType, flags: SetupFlags): Promise<unknown> {
  if (flags.install) {
    if (!interactive(flags) && !flags.force) throw usage('Install requires --install --force in non-interactive mode.')
    await installWithCopy(type, flags)
  }
  const id = flags.target ?? type
  const target = await readTarget(id) ?? await createProfileTarget(type, id, { serverEnv: flags['server-env'], port: undefined })
  if (!flags.target) await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? target.id }))
  await startProfile(target).catch(error => {
    if (type === 'desktop') return undefined
    throw error
  })
  if (flags.email) return printSetupResult(await setupEmailTarget(target, flags), flags)
  return { readiness: await evaluateReadiness({ baseURL: target.baseURL, target: target.id }), target: publicTarget(target) }
}

async function printSetupResult(result: SetupLoginResult, flags: SetupFlags): Promise<unknown> {
  result = await maybeDriveOnboarding(result, flags)
  if (!interactive(flags)) return result
  process.stdout.write(result.readiness.state === 'ready'
    ? `Connected to ${result.target.name ?? result.target.id}\n`
    : `Connected; setup paused: ${result.readiness.state}\n`)
  const readinessDetail = setupDetailForReadiness(result.readiness)
  const detail = result.accounts.length && readinessDetail
    ? `Connected accounts: ${result.accounts.join(', ')}\n${readinessDetail}`
    : result.accounts.length
      ? `Connected accounts: ${result.accounts.join(', ')}`
      : readinessDetail
  if (detail) process.stdout.write(`${detail}\n`)
  if (result.readiness.state === 'ready') {
    process.stdout.write('\nNext:\n')
    process.stdout.write('  beeper chats list\n')
    process.stdout.write('  beeper send text --to <chat> --message "hello"\n')
  }
  return undefined
}

async function setupFromChoice(flags: SetupFlags): Promise<unknown> {
  const serverInstalled = await isServerInstalled()
  process.stdout.write('No usable Beeper Desktop session was found on this device.\n\n')
  process.stdout.write('How do you want to connect Beeper CLI?\n\n')
  process.stdout.write('  1. Install Beeper Desktop\n')
  process.stdout.write(`  2. ${serverInstalled ? 'Use installed local Beeper Server' : 'Install local Beeper Server'}\n`)
  process.stdout.write('  3. Connect with Desktop API on another device\n\n')
  const defaultChoice = serverInstalled ? '2' : '1'
  const choice = await promptChoice(`Choose [${defaultChoice}]: `, ['1', '2', '3'], { defaultValue: defaultChoice })
  if (choice === '1') {
    if (!await promptConfirm('Install Beeper Desktop stable from beeper.com?', true)) return undefined
    await installWithCopy('desktop', { ...flags, channel: 'stable' })
    const target = await setupTarget({ ...flags, desktop: true })
    return launchAndPoll(target, setupCommand(target), flags)
  }
  if (choice === '2') {
    if (!serverInstalled) {
      if (!await promptConfirm('Install local Beeper Server stable from beeper.com?', true)) return undefined
      await installWithCopy('server', { ...flags, channel: 'stable', 'server-env': 'prod' })
    }
    return setupManaged('server', { ...flags, install: false, server: true, channel: 'stable' })
  }
  const url = await promptText('Desktop API URL: ')
  if (!url) throw usage('Remote URL is required.')
  return setupRemote({ ...flags, remote: url })
}

async function handleBrokenCurrentTarget(target: Target, readiness: Readiness, flags: SetupFlags): Promise<boolean> {
  const serverInstalled = await isServerInstalled()
  process.stdout.write(`Beeper CLI is set up for ${target.name ?? target.id}, but it is not reachable.\n\n`)
  if (readiness.message) process.stdout.write(`${readiness.message}\n\n`)
  process.stdout.write('What do you want to do?\n\n')
  process.stdout.write(`  1. Retry ${target.name ?? target.id}\n`)
  process.stdout.write('  2. Use Beeper Desktop on this device\n')
  process.stdout.write(`  3. ${serverInstalled ? 'Use installed local Beeper Server' : 'Install local Beeper Server'}\n`)
  process.stdout.write('  4. Connect with Desktop API on another device\n\n')
  const choice = await promptChoice('Choose [1]: ', ['1', '2', '3', '4'], { defaultValue: '1' })
  if (choice === '1') return false
  if (choice === '2') {
    const desktop = await createDefaultDesktopTarget()
    await setupDefault(desktop, { ...flags, target: desktop.id })
    return true
  }
  if (choice === '3') {
    if (!serverInstalled) {
      if (!await promptConfirm('Install local Beeper Server stable from beeper.com?', true)) return true
      await installWithCopy('server', { ...flags, channel: 'stable', 'server-env': 'prod' })
    }
    await setupManaged('server', { ...flags, install: false, server: true, channel: 'stable' })
    return true
  }
  const url = await promptText('Desktop API URL: ')
  if (!url) throw usage('Remote URL is required.')
  await setupRemote({ ...flags, remote: url })
  return true
}

async function setupTarget(flags: SetupFlags): Promise<Target> {
  if (flags.target) {
    const target = await readTarget(flags.target)
    if (!target) throw usage(`Unknown Beeper target "${flags.target}". Run \`beeper targets list\`.`)
    return target
  }
  const config = await readConfig()
  if (config.defaultTarget) {
    const target = await readTarget(config.defaultTarget)
    if (target) return target
  }
  const desktop = await readTarget(builtInDesktopTargetID)
  if (desktop) return desktop
  const detected = await findLocalDesktop({ scan: true, timeoutMs: 300 }).catch(() => undefined)
  return createDefaultDesktopTarget(detected?.baseURL)
}

async function prepareLocalDesktopSetup(target: Target, flags: SetupFlags): Promise<PreparedLocalDesktopSetup> {
  if (flags.events) writeEvent('setup_step', { step: 'local-desktop', target: target.id })
  const desktop = await findLocalDesktop({ baseURL: target.baseURL, scan: target.id === builtInDesktopTargetID, timeoutMs: 500 }).catch(() => undefined)
  const resolvedTarget: Target = {
    ...target,
    baseURL: desktop?.baseURL ?? target.baseURL,
    name: target.name ?? 'Beeper Desktop',
    type: 'desktop',
  }
  const session = await findLocalDesktopSession(resolvedTarget)
  const readiness = localDesktopReadiness(session)
  const accounts = await localConnectedAccountSummary(session.dataDir).catch(() => [])
  return { accounts, readiness, session, target: resolvedTarget }
}

async function detectDesktopSetup(target: Target, flags: SetupFlags): Promise<DesktopSetupDetection> {
  printProgress(flags, 'Checking Beeper Desktop')
  const installations = await readInstallations().catch((): Installations => ({}))
  const serverInstalled = await isServerInstalled(installations)
  const appInstalled = Boolean(await findDesktopAppPath(installations))
  printProgress(flags, 'Reading local Desktop session')
  const local = await prepareLocalDesktopSetup(target, flags).catch(error => ({ error }))
  if (!('error' in local)) return { kind: 'session-found', local, serverInstalled }

  printProgress(flags, 'Checking Desktop readiness')
  const desktop = await findLocalDesktop({ baseURL: target.baseURL, scan: target.id === builtInDesktopTargetID, timeoutMs: 500 }).catch(() => undefined)
  if (desktop) {
    const readiness = await evaluateReadiness({ baseURL: desktop.baseURL, target: target.id, token: false })
    if (readiness.state === 'needs-login') return { kind: 'running-signed-out', readiness, serverInstalled }
    return {
      kind: 'session-unreadable',
      reason: local.error instanceof Error ? local.error.message : String(local.error),
      readiness,
      serverInstalled,
    }
  }
  return appInstalled ? { kind: 'installed-not-running', serverInstalled } : { kind: 'not-installed', serverInstalled }
}

async function isServerInstalled(installations?: Installations): Promise<boolean> {
  if (process.env.BEEPER_SERVER_BIN) return true
  const installation = installations ?? await readInstallations().catch((): Installations => ({}))
  return Boolean(installation.server?.path && await access(installation.server.path).then(() => true, () => false))
}

async function commitLocalDesktopSetup(prepared: PreparedLocalDesktopSetup): Promise<SetupLoginResult> {
  await writeTarget({ ...prepared.target, auth: prepared.session.auth })
  await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? prepared.target.id }))
  return {
    accounts: prepared.accounts,
    readiness: prepared.readiness,
    target: publicTarget({ ...prepared.target, auth: prepared.session.auth }),
  }
}

async function setupOAuthTarget(target: Target, flags: SetupFlags): Promise<SetupLoginResult> {
  if (flags.events) writeEvent('setup_step', { step: 'oauth', target: target.id })
  if (!interactive(flags) && !flags.force) throw usage('OAuth setup requires an interactive terminal or --force to open the browser.')
  const auth = authFromToken(await authorizeTarget({
    baseURL: target.baseURL,
    scan: target.type === 'desktop' && target.id === builtInDesktopTargetID,
  }), target.type === 'remote' ? 'remote-oauth' : 'desktop-oauth')
  await writeTarget({ ...target, auth })
  const [readiness, accounts] = await Promise.all([
    evaluateReadiness({ baseURL: target.baseURL, target: target.id, token: auth.accessToken }),
    connectedAccountSummary(target, auth).catch(() => []),
  ])
  return { accounts, readiness, target: publicTarget({ ...target, auth }) }
}

async function setupEmailTarget(target: Target, flags: SetupFlags): Promise<SetupLoginResult> {
  if (flags.events) writeEvent('setup_step', { step: 'email', target: target.id })
  const email = flags.email
  if (!email) throw usage('Email setup requires --email.')
  if (!interactive(flags)) throw usage('Email setup prompts for the verification code. For automation, use `beeper auth email start` and `beeper auth email response`.')
  const start = await startEmailSetup(target, email)
  return finishEmailSetup(target, {
    code: await promptText('Email code: '),
    force: flags.force,
    json: flags.json,
    setupRequestID: start.setupRequestID,
    username: flags.username,
  })
}

function printLocalDesktopPreview(prepared: PreparedLocalDesktopSetup): void {
  process.stdout.write('Found Beeper Desktop on this device.\n\n')
  process.stdout.write(`Status: ${prepared.readiness.state === 'ready' ? 'signed in and ready' : prepared.readiness.state}\n`)
  if (prepared.session.userID) process.stdout.write(`Signed in as: ${prepared.session.userID}\n`)
  if (prepared.accounts.length) process.stdout.write(`Connected accounts: ${prepared.accounts.join(', ')}\n`)
  process.stdout.write('\n')
}

function setupSessionFoundOutput(local: PreparedLocalDesktopSetup, setupCmd: string, serverInstalled: boolean): Record<string, unknown> {
  const availableActions = [
    { id: 'use-desktop-session', command: `${setupCmd} --local` },
    { id: 'desktop-oauth', command: `${setupCmd} --oauth` },
    { id: 'connect-remote', command: 'beeper setup --remote <url>' },
  ]
  if (serverInstalled) availableActions.push(installedServerAction(true))
  return {
    availableActions,
    localDesktop: {
      authSource: local.session.auth.source,
      baseURL: local.target.baseURL,
      connectedAccounts: local.accounts,
      dataDir: local.session.dataDir,
      signedInAs: local.session.userID,
    },
    message: local.readiness.state === 'ready'
      ? 'Beeper Desktop is signed in and ready.'
      : 'Beeper Desktop is signed in, but setup is not finished.',
    readiness: local.readiness,
    recommendedAction: { id: 'use-desktop-session', command: `${setupCmd} --local` },
    state: local.readiness.state === 'ready' ? 'desktop-ready' : 'desktop-session-found',
    target: publicTarget(local.target),
  }
}

function printStatus(title: string, status: string): void {
  process.stdout.write(`${title}\n\n`)
  process.stdout.write(`Status: ${status}\n\n`)
}

function printProgress(flags: SetupFlags, message: string): void {
  if (!interactive(flags)) return
  process.stdout.write(`${message}...\n`)
}

function printInteractiveSetupStatus(message: string, detail?: string): undefined {
  process.stdout.write(`${message}\n`)
  if (detail) process.stdout.write(`${detail}\n`)
  return undefined
}

async function launchAndPoll(target: Target, setupCmd: string, flags: SetupFlags): Promise<unknown> {
  if (flags.events) writeEvent('setup_step', { step: 'launch', target: target.id })
  if (interactive(flags)) process.stdout.write('Opening Beeper Desktop...\n')
  await launchDesktopApp(target)
  const readiness = await pollReadiness(target, 10_000)
  const detail = readiness.state === 'target-unreachable'
    ? `Run \`${setupCmd}\` again after Beeper Desktop finishes starting.`
    : setupDetailForReadiness(readiness)
  if (!interactive(flags)) return { readiness, target: publicTarget(target) }
  process.stdout.write('Launched Beeper Desktop\n')
  if (detail) process.stdout.write(`${detail}\n`)
  if (readiness.state === 'target-unreachable') {
    process.stdout.write('\nNext:\n')
    process.stdout.write(`  ${setupCmd}\n`)
    process.stdout.write('  beeper status\n')
  }
  return undefined
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

async function maybeDriveOnboarding(result: SetupLoginResult, flags: SetupFlags): Promise<SetupLoginResult> {
  if (!interactive(flags)) return result
  if (result.readiness.state !== 'needs-verification' && result.readiness.state !== 'verification-in-progress') return result
  process.stdout.write('Continuing verification...\n\n')
  await driveVerification({ baseURL: result.target.baseURL, target: result.target.id, force: flags.force })
  return {
    ...result,
    readiness: await evaluateReadiness({ baseURL: result.target.baseURL, target: result.target.id }),
    target: result.target,
  }
}

async function installWithCopy(type: ManagedTargetType, flags: SetupFlags): Promise<void> {
  const label = type === 'desktop' ? 'Beeper Desktop' : 'local Beeper Server'
  const channel = flags.channel === 'nightly' ? 'nightly' : 'stable'
  const serverEnv = normalizeServerEnv(flags['server-env'])
  const source = type === 'server' ? new URL(SERVER_ENV_API_BASE_URLS[serverEnv]).host : 'beeper.com'
  if (interactive(flags)) process.stdout.write(`Installing ${label} ${channel} from ${source}...\n`)
  if (type === 'desktop') await installDesktop({ channel, serverEnv })
  else await installServer({ channel, serverEnv })
  if (interactive(flags)) process.stdout.write(`Installed ${label} ${channel}.\n\n`)
}

function interactive(flags: SetupFlags): boolean {
  return !flags.json && process.stdin.isTTY
}

function setupStateOutput(detected: Exclude<DesktopSetupDetection, { kind: 'session-found' }>, target: Target): Record<string, unknown> {
  if (detected.kind === 'installed-not-running') {
    const serverAction = installedServerAction(detected.serverInstalled)
    return setupActionEnvelope({
      availableActions: [
        { id: 'launch-desktop', command: 'beeper setup --desktop --force' },
        { id: 'connect-remote', command: 'beeper setup --remote <url>' },
        serverAction,
      ],
      message: 'Beeper Desktop is installed but not running.',
      recommendedAction: { id: 'launch-desktop', command: 'beeper setup --desktop --force' },
      state: 'desktop-installed-not-running',
      target,
    })
  }
  if (detected.kind === 'running-signed-out') {
    const availableActions = [
      { id: 'open-desktop', command: 'beeper setup --desktop --force' },
      { id: 'connect-remote', command: 'beeper setup --remote <url>' },
    ]
    if (detected.serverInstalled) availableActions.push(installedServerAction(true))
    return setupActionEnvelope({
      availableActions,
      message: 'Beeper Desktop is running but not signed in.',
      readiness: detected.readiness,
      recommendedAction: { id: 'open-desktop', command: 'beeper setup --desktop --force' },
      state: 'desktop-running-signed-out',
      target,
    })
  }
  if (detected.kind === 'session-unreadable') {
    const availableActions = [
      { id: 'desktop-oauth', command: 'beeper setup --oauth --force' },
      { id: 'connect-remote', command: 'beeper setup --remote <url>' },
    ]
    if (detected.serverInstalled) availableActions.push(installedServerAction(true))
    return setupActionEnvelope({
      availableActions,
      detail: detected.reason,
      message: 'Beeper Desktop is running, but CLI could not read the local session.',
      readiness: detected.readiness,
      recommendedAction: { id: 'desktop-oauth', command: 'beeper setup --oauth --force' },
      state: 'desktop-running-session-unreadable',
      target,
    })
  }
  const serverAction = installedServerAction(detected.serverInstalled)
  return setupActionEnvelope({
    availableActions: [
      { id: 'install-desktop', command: 'beeper setup --desktop --install --force' },
      serverAction,
      { id: 'connect-remote', command: 'beeper setup --remote <url>' },
    ],
    message: 'No Beeper Desktop installation was found on this device.',
    recommendedAction: detected.serverInstalled ? serverAction : { id: 'install-desktop', command: 'beeper setup --desktop --install --force' },
    state: 'desktop-not-installed',
    target,
  })
}

function installedServerAction(installed: boolean): SetupAction {
  return installed
    ? { id: 'use-installed-server', command: 'beeper setup --server --force' }
    : { id: 'install-server', command: 'beeper setup --server --install --force' }
}

function currentTargetBrokenOutput(target: Target, readiness: Readiness, serverInstalled: boolean): Record<string, unknown> {
  return {
    availableActions: [
      { id: 'retry-current', command: `beeper setup --target ${target.id}` },
      { id: 'use-desktop', command: 'beeper setup --desktop' },
      installedServerAction(serverInstalled),
      { id: 'connect-remote', command: 'beeper setup --remote <url>' },
    ],
    message: `Beeper CLI is set up for ${target.name ?? target.id}, but it is not reachable.`,
    readiness,
    recommendedAction: { id: 'retry-current', command: `beeper setup --target ${target.id}` },
    state: 'current-target-unreachable',
    target: publicTarget(target),
  }
}

function setupActionEnvelope(options: {
  availableActions: SetupAction[]
  detail?: string
  message: string
  readiness?: Readiness
  recommendedAction: SetupAction
  state: string
  target: Target
}): Record<string, unknown> {
  return {
    availableActions: options.availableActions,
    detail: options.detail,
    message: options.message,
    readiness: options.readiness,
    recommendedAction: options.recommendedAction,
    state: options.state,
    target: publicTarget(options.target),
  }
}

function setupDetailForReadiness(readiness: Readiness): string | undefined {
  if (readiness.state === 'needs-login') return 'Sign in to Beeper Desktop, then run `beeper setup` again.'
  if (readiness.state === 'needs-verification' || readiness.state === 'verification-in-progress') return 'Continue verification to finish setup.'
  if (readiness.state === 'needs-recovery-key' || readiness.state === 'needs-secrets') return 'Finish recovery in Beeper, then run `beeper setup` again.'
  if (readiness.state === 'needs-cross-signing-setup') return 'Finish cross-signing setup in Beeper, then run `beeper setup` again.'
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
  return target.id === builtInDesktopTargetID ? 'beeper setup' : `beeper setup --target ${target.id}`
}

function remoteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-zA-Z0-9._-]/g, '-') || 'remote'
  } catch {
    return 'remote'
  }
}

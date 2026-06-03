#!/usr/bin/env bun
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { commands } from '../src/cli/commands.js'
import { apiItems } from '../src/lib/api-values.js'
import { createProfileTarget, readTarget } from '../src/lib/targets.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await loadEnvFile(process.env.BEEPER_E2E_ENV_FILE || path.join(repoRoot, '.env.e2e'))

const cliBin = process.env.BEEPER_E2E_CLI_BIN || path.join(repoRoot, 'bin/dev.js')
const runID = process.env.BEEPER_E2E_RUN_ID || String(Date.now())
const workDir = process.env.BEEPER_E2E_WORKDIR || path.join(tmpdir(), `beeper-cli-e2e-${runID}`)
const configDir = process.env.BEEPER_E2E_CONFIG_DIR || path.join(workDir, 'cli-config')
process.env.BEEPER_CLI_CONFIG_DIR = configDir
const reportPath = process.env.BEEPER_E2E_REPORT || path.join(workDir, 'report.json')
const emailBase = Number(process.env.BEEPER_E2E_EMAIL_BASE || (900000 + Math.floor(Math.random() * 50000)))
const otp = process.env.BEEPER_E2E_OTP?.trim() || '959729'
const accountCount = Number(process.env.BEEPER_E2E_ACCOUNT_COUNT || 3)
const portStart = Number(process.env.BEEPER_E2E_PORT_START || 24_573)
const desktopCount = Number(process.env.BEEPER_E2E_DESKTOP_TARGETS || 1)
const serverCount = Number(process.env.BEEPER_E2E_SERVER_TARGETS || Math.max(1, accountCount - desktopCount))
const remoteBaseURLs = (process.env.BEEPER_E2E_REMOTE_BASE_URLS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const commandTimeoutMs = Number(process.env.BEEPER_E2E_COMMAND_TIMEOUT_MS || 60_000)
const phases = (process.env.BEEPER_E2E_PHASES || process.argv.slice(2).join(',') || 'plan')
  .split(',')
  .map(phase => phase.trim())
  .filter(Boolean)

if (phases.includes('login') && !otp) {
  console.error('BEEPER_E2E_OTP is required for the login phase. Set it in the environment and rerun the staging E2E harness.')
  process.exit(1)
}

const report = {
  runID,
  workDir,
  configDir,
  reportPath,
  startedAt: new Date().toISOString(),
  phases,
  targets: [],
  commands: [],
  blocked: [],
  failures: [],
  notes: [],
  coverage: {
    commands: [],
    help: [],
    api: [],
    skipped: [],
  },
}

const previousReport = await readPreviousReport()
if (previousReport?.runID === runID) {
  report.targets = previousReport.targets ?? []
  report.commands = previousReport.commands ?? []
  report.blocked = []
  report.failures = []
  report.notes = previousReport.notes ?? []
  report.coverage = previousReport.coverage ?? report.coverage
}

process.on('SIGINT', async () => {
  report.notes.push('Interrupted. Run the cleanup phase to stop local server targets and remove isolated state.')
  await writeReport()
  process.exit(130)
})

await main()

async function main() {
  await mkdir(workDir, { recursive: true })
  await mkdir(configDir, { recursive: true })
  await writeReport()

  if (hasPhase('plan')) await phasePlan()
  if (hasPhase('targets')) await phaseTargets()
  if (hasPhase('install-server')) await phaseInstallServer()
  if (hasPhase('start')) await phaseStart()
  if (hasPhase('login')) await phaseLogin()
  if (hasPhase('readiness')) await phaseReadiness()
  if (hasPhase('messaging')) await phaseMessaging()
  if (hasPhase('surface')) await phaseSurface()
  if (hasPhase('cleanup')) await phaseCleanup()

  report.finishedAt = new Date().toISOString()
  await writeReport()
  console.log(`staging e2e report: ${reportPath}`)
  if (report.failures.length) {
    console.error(`${report.failures.length} staging e2e failure${report.failures.length === 1 ? '' : 's'}; see report for details.`)
    process.exitCode = 1
  } else if (report.blocked.length) {
    console.error(`${report.blocked.length} staging e2e manual block${report.blocked.length === 1 ? '' : 's'}; see report for next actions.`)
    process.exitCode = 2
  }
}

async function phasePlan() {
  const targets = plannedTargets()
  report.targets = targets
  const commands = [
    'bun run --filter beeper-cli build',
    `BEEPER_E2E_ENV_FILE=.env.e2e BEEPER_E2E_PHASES=targets,install-server,start,login,readiness,messaging,surface,cleanup BEEPER_E2E_RUN_ID=${runID} bun packages/cli/test/e2e-staging.ts`,
    `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js targets list --json`,
  ]
  report.commands.push(...commands.map(command => ({ phase: 'plan', command })))
  report.notes.push('Default phase is plan only. Add explicit BEEPER_E2E_PHASES before launching targets.')
  report.notes.push('Put BEEPER_E2E_OTP in .env.e2e or set BEEPER_E2E_ENV_FILE. The report redacts OTPs, access tokens, lead tokens, and setup responses.')
  report.notes.push('The harness uses non-default ports and an isolated BEEPER_CLI_CONFIG_DIR so the default Desktop instance is not used.')
  report.notes.push('install-server downloads Beeper Server. Use that phase only when you intend to download the staging server artifact.')
  printPlan(targets, commands)
}

async function phaseTargets() {
  const targets = plannedTargets()
  report.targets = targets
  for (const target of targets) {
    if (target.kind !== 'remote') {
      await ensureManagedTarget(target)
      await writeReport()
      continue
    }
    const args = ['targets', 'add', target.name, target.baseURL, '--json']
    const result = runCli(args, { allowFailure: true })
    if (result.status !== 0 && !`${result.stderr}${result.stdout}`.includes('already exists')) fail(result, args)
    recordCommand('targets', args, result)
    await writeReport()
  }
  const list = runCli(['targets', 'list', '--json'])
  recordCommand('targets', ['targets', 'list', '--json'], list)
  await writeReport()
}

async function phaseInstallServer() {
  const result = runCli(['install', 'server', '--server-env', 'staging', '--json'])
  recordCommand('install-server', ['install', 'server', '--server-env', 'staging', '--json'], result)
  await writeReport()
}

async function phaseStart() {
  for (const target of plannedTargets()) {
    if (target.kind === 'remote') {
      try {
        await waitForInfo(target)
      } catch (error) {
        recordFailure('start', target, error)
      }
      await writeReport()
      continue
    }
    const args = ['targets', 'runtime', 'start', target.name, '--json']
    const result = runCli(args, { env: serverEnv(), allowFailure: true })
    recordCommand('start', args, result)
    if (result.status !== 0) {
      recordFailure('start', target, result.stderr || result.stdout)
      continue
    }
    try {
      await waitForInfo(target)
    } catch (error) {
      recordFailure('start', target, error)
    }
    await writeReport()
  }
}

async function phaseLogin() {
  for (const target of plannedTargets()) {
    try {
      await waitForInfo(target)
      if (target.kind === 'server' || target.kind === 'remote') {
        if (!await loginServerViaSetupAPI(target)) continue
      } else {
        const args = ['setup', '--target', target.name, '--local', '--json']
        const result = runCli(args, { allowFailure: true })
        recordCommand('login', args, result)
        if (result.status !== 0) {
          recordLoginBlock(target, args, result)
          continue
        }
        const body = parseEnvelope(result.stdout)
        target.matrix = body?.data?.readiness?.app?.matrix
      }
      target.accessToken = await loadTargetAccessToken(target)
      assert(target.accessToken, `setup did not persist an access token for ${target.name}`)
      report.notes.push(`authenticated ${target.name} with ${target.kind === 'desktop' ? 'local Desktop session' : 'setup API'}`)
    } catch (error) {
      recordFailure('login', target, error)
    }
    await writeReport()
  }
}

async function phaseReadiness() {
  for (const target of await plannedTargetsWithAuth()) {
    const env = target.accessToken ? { BEEPER_ACCESS_TOKEN: target.accessToken } : undefined
    for (const args of [
      ['status', '--target', target.name, '--json'],
      ['setup', '--target', target.name, '--json'],
    ]) {
      const result = runCli(args, { env, allowFailure: true })
      recordCommand('readiness', args, result)
    }
  }
}

async function phaseMessaging() {
  const signedInTargets = (await plannedTargetsWithAuth()).filter(target => target.accessToken)
  const sender = signedInTargets[0]
  const receiver = signedInTargets.find(target => target.matrix?.userID && target.matrix.userID !== sender?.matrix?.userID)
  if (!sender || !receiver?.matrix?.userID) {
    recordBlock('messaging', undefined, 'messaging phase needs two signed-in targets with Matrix user IDs.', [
      `BEEPER_E2E_RUN_ID=${runID} BEEPER_E2E_OTP="$QA_OTP" BEEPER_E2E_PHASES=login,readiness bun packages/cli/test/e2e-staging.ts`,
      `BEEPER_E2E_RUN_ID=${runID} BEEPER_E2E_PHASES=messaging bun packages/cli/test/e2e-staging.ts`,
    ])
    return
  }
  const env = { BEEPER_ACCESS_TOKEN: sender.accessToken }
  const startArgs = ['chats', 'start', receiver.matrix.userID, '--target', sender.name, '--account', 'matrix', '--json']
  const start = runCli(startArgs, { env, allowFailure: true })
  recordCommand('messaging', startArgs, start)
  const body = parseEnvelope(start.stdout)
  let chatID = body?.data?.chat?.id ?? body?.data?.id ?? body?.data?.chatID
  if (!chatID) {
    recordBlock('messaging', sender, 'Could not infer a Desktop-indexed chat ID from chats start. Server/local bridge coverage must come from the Desktop API chat surface, not raw Matrix rooms.')
    return
  }
  report.coverage.chatID = chatID
  for (const args of [
    ['send', 'text', '--to', chatID, '--message', `staging e2e ${runID}`, '--target', sender.name, '--json'],
    ['messages', 'list', '--chat', chatID, '--target', sender.name, '--limit', '10', '--json'],
    ['chats', 'show', '--chat', chatID, '--target', sender.name, '--json'],
  ]) {
    const result = runCli(args, { env, allowFailure: true })
    recordCommand('messaging', args, result)
    if (result.status !== 0) recordFailure('messaging', sender, `beeper ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  }
  if (signedInTargets.length >= 3) await phaseGroupMessaging(signedInTargets)
}

async function phaseGroupMessaging(targets) {
  const [sender, ...receivers] = targets.filter(target => target.accessToken && target.matrix?.userID)
  const distinctReceivers = receivers.filter((target, index, list) =>
    target.matrix.userID !== sender?.matrix?.userID &&
    list.findIndex(candidate => candidate.matrix.userID === target.matrix.userID) === index)
  if (!sender || distinctReceivers.length < 2) {
    recordBlock('messaging', undefined, 'group messaging needs three signed-in targets with distinct Matrix user IDs.')
    return
  }

  const startArgs = ['chats', 'start', distinctReceivers[0].matrix.userID, '--target', sender.name, '--account', 'matrix', '--title', `CLI E2E ${runID}`, '--json']
  const start = runCli(startArgs, { env: { BEEPER_ACCESS_TOKEN: sender.accessToken }, allowFailure: true })
  recordCommand('messaging-group', startArgs, start)
  const chatID = parseEnvelope(start.stdout)?.data?.chat?.id ?? parseEnvelope(start.stdout)?.data?.id ?? parseEnvelope(start.stdout)?.data?.chatID
  if (!chatID) {
    recordBlock('messaging-group', sender, 'Could not create a group chat through the Desktop API chat surface. Raw Matrix createRoom/join is intentionally not used.')
    return
  }
  report.coverage.groupChatID = chatID

  const text = `group staging e2e ${runID}`
  const sendArgs = ['send', 'text', '--to', chatID, '--message', text, '--target', sender.name, '--json']
  const send = runCli(sendArgs, { env: { BEEPER_ACCESS_TOKEN: sender.accessToken }, allowFailure: true })
  recordCommand('messaging-group', sendArgs, send)
  await sleep(1000)

  for (const target of [sender, ...distinctReceivers.slice(0, 2)]) {
    const listArgs = ['messages', 'list', '--chat', chatID, '--target', target.name, '--limit', '10', '--json']
    const list = runCli(listArgs, { env: { BEEPER_ACCESS_TOKEN: target.accessToken }, allowFailure: true })
    recordCommand('messaging-group', listArgs, list)
    if (list.status !== 0 && /not in room|M_FORBIDDEN/i.test(`${list.stderr}${list.stdout}`)) {
      recordBlock('messaging-group', target, 'Group room invite was created, but this target has not joined the room yet.')
    } else if (list.status !== 0) {
      recordFailure('messaging-group', target, `group message list failed for ${target.name}`)
    }
  }
}

async function phaseSurface() {
  await phaseHelpSurface()
  await phaseApiSurface()
  await phaseCliSurface()
  await phaseControlSurface()
}

async function phaseHelpSurface() {
  const commands = await registeredCommands()
  for (const command of ['', ...commands]) {
    const args = command ? [...command.split(' '), '--help'] : ['--help']
    const result = runCli(args, { allowFailure: true })
    recordCommand('help-surface', args, result)
    recordCoverage('help', args, result)
    if (result.status !== 0) recordFailure('help-surface', undefined, `beeper ${args.join(' ')} failed with status ${result.status}`)
  }
}

async function phaseApiSurface() {
  const target = (await plannedTargetsWithAuth()).find(item => item.accessToken)
  if (!target) {
    recordBlock('api-surface', undefined, 'API surface coverage needs at least one signed-in target.')
    return
  }

  const env = { BEEPER_ACCESS_TOKEN: target.accessToken }
  for (const args of [
    ['api', 'request', 'GET', '/v1/info', '--target', target.name, '--no-auth', '--json'],
    ['api', 'request', 'GET', '/v1/spec', '--target', target.name, '--no-auth', '--json'],
    ['api', 'request', 'GET', '/v1/app/setup', '--target', target.name, '--json'],
    ['api', 'request', 'GET', '/v1/app/setup/verifications', '--target', target.name, '--json'],
    ['api', 'request', 'GET', '/v1/accounts', '--target', target.name, '--json'],
    ['api', 'request', 'GET', '/v1/chats?limit=10', '--target', target.name, '--json'],
  ]) {
    const result = runCli(args, { env, allowFailure: true })
    recordCommand('api-surface', args, result)
    recordCoverage('api', args, result)
  }

  const specResult = runCli(['api', 'request', 'GET', '/v1/spec', '--target', target.name, '--no-auth', '--json'], { allowFailure: true })
  const spec = parseEnvelope(specResult.stdout)?.data ?? parseEnvelope(specResult.stdout)
  const paths = spec?.paths && typeof spec.paths === 'object' ? Object.keys(spec.paths).sort() : []
  if (paths.length) {
    report.coverage.apiSpecPaths = paths.length
    report.coverage.skipped.push(...paths
      .filter(pathname => !isCoveredByCliSurface(pathname))
      .map(pathname => ({ phase: 'api-surface', path: pathname, reason: 'covered by SDK command, destructive side effect, multipart upload, websocket, or requires test-created resource IDs' })))
  }
}

async function phaseCliSurface() {
  const targets = (await plannedTargetsWithAuth()).filter(item => item.accessToken)
  const target = targets[0]
  if (!target) {
    recordBlock('cli-surface', undefined, 'CLI surface coverage needs at least one signed-in target.')
    return
  }
  const env = { BEEPER_ACCESS_TOKEN: target.accessToken }
  const sdkChatID = await findReusableChatID(target, env)
  const chatID = sdkChatID
  const messageID = chatID ? await findReusableMessageID(target, chatID, env) : undefined
  const reminderAt = new Date(Date.now() + 86_400_000).toISOString()

  const cases = [
    ['version', '--json'],
    ['schema', '--json'],
    ['use', 'target', target.name, '--json'],
    ['status', target.name, '--json'],
    ['accounts', 'list', '--target', target.name, '--json'],
    ['accounts', 'add', '--target', target.name, '--json'],
    ['accounts', 'add', 'local-dummy', '--target', target.name, '--flow', 'password', '--field', 'username=cli-e2e', '--field', `password=${dummyPassword()}`, '--no-input', '--json'],
    ['accounts', 'add', 'local-dummy', '--target', target.name, '--login-id', 'cli-e2e', '--flow', 'password', '--field', 'username=cli-e2e', '--field', `password=${dummyPassword()}`, '--no-input', '--json'],
    ['accounts', 'add', 'local-dummy', '--target', target.name, '--flow', 'cookies', '--cookie', 'username=cli-e2e-cookies', '--cookie', `password=${dummyPassword()}`, '--no-input', '--json'],
    ['accounts', 'add', 'local-dummy', '--target', target.name, '--flow', 'localstorage', '--cookie', 'username=cli-e2e-localstorage', '--cookie', `password=${dummyPassword()}`, '--no-input', '--json'],
    ['accounts', 'add', 'local-dummy', '--target', target.name, '--flow', 'displayandwait', '--no-input', '--json'],
    ['accounts', 'list', '--target', target.name, '--account', 'local-dummy', '--json'],
    ['chats', 'list', '--target', target.name, '--limit', '20', '--json'],
    ['chats', 'list', '--query', runID, '--target', target.name, '--limit', '10', '--json'],
    ['contacts', 'list', '--target', target.name, '--limit', '20', '--json'],
    ['contacts', 'list', '--query', 'staging-user', '--target', target.name, '--json'],
  ]
  if (target.kind !== 'remote') cases.splice(9, 0, ['targets', 'logs', target.name, '--lines', '5'])

  if (chatID) {
    cases.push(
      ['chats', 'show', '--chat', chatID, '--target', target.name, '--json'],
      ['messages', 'list', '--chat', chatID, '--target', target.name, '--limit', '10', '--json'],
      ['send', 'text', '--to', chatID, '--message', `surface ${runID}`, '--target', target.name, '--json'],
    )
  }

  if (sdkChatID) {
    cases.push(
      ['chats', 'pin', '--chat', sdkChatID, '--target', target.name, '--json'],
      ['chats', 'pin', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['chats', 'archive', '--chat', sdkChatID, '--target', target.name, '--json'],
      ['chats', 'archive', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['chats', 'mute', '--chat', sdkChatID, '--target', target.name, '--json'],
      ['chats', 'mute', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['chats', 'read', '--chat', sdkChatID, '--target', target.name, '--json'],
      ['chats', 'read', '--chat', sdkChatID, '--unread', '--target', target.name, '--json'],
      ['chats', 'priority', '--chat', sdkChatID, '--level', 'inbox', '--target', target.name, '--json'],
      ['chats', 'description', '--chat', sdkChatID, '--description', `CLI E2E ${runID}`, '--target', target.name, '--json'],
      ['chats', 'description', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['chats', 'draft', '--chat', sdkChatID, '--text', `draft ${runID}`, '--target', target.name, '--json'],
      ['chats', 'draft', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['chats', 'disappear', '--chat', sdkChatID, '--seconds', 'off', '--target', target.name, '--json'],
      ['chats', 'remind', '--chat', sdkChatID, '--when', reminderAt, '--target', target.name, '--json'],
      ['chats', 'remind', '--chat', sdkChatID, '--clear', '--target', target.name, '--json'],
      ['send', 'presence', '--to', sdkChatID, '--state', 'typing', '--duration', '1', '--target', target.name, '--json'],
      ['messages', 'search', runID, '--chat', sdkChatID, '--target', target.name, '--limit', '10', '--json'],
      ['export', '--chat', sdkChatID, '--target', target.name, '--limit-messages', '10', '--no-attachments', '--out', path.join(workDir, 'exports', 'chat'), '--json'],
    )
  } else {
    for (const command of ['chats description/draft/disappear/remind', 'send presence']) {
      report.coverage.skipped.push({ command, reason: 'No Desktop-indexed chat was available from Beeper Server; raw Matrix rooms do not support Desktop chat mutation APIs.' })
    }
    report.coverage.skipped.push({ command: 'messages search --chat', reason: 'No Desktop-indexed chat was available from Beeper Server; raw Matrix rooms are not searched through Desktop message APIs.' })
    report.coverage.skipped.push({ command: 'export --chat', reason: 'No Desktop-indexed chat was available from Beeper Server; raw Matrix rooms are not exported through Desktop message APIs.' })
  }

  if (sdkChatID && messageID) {
    cases.push(
      ['messages', 'context', '--chat', sdkChatID, '--id', messageID, '--target', target.name, '--before', '2', '--after', '2', '--json'],
      ['send', 'react', '--to', sdkChatID, '--id', messageID, '--reaction', '+1', '--target', target.name, '--json'],
      ['send', 'react', '--to', sdkChatID, '--id', messageID, '--reaction', '+1', '--remove', '--target', target.name, '--json'],
    )
  } else if (!sdkChatID) {
    report.coverage.skipped.push({ command: 'messages context and reaction send', reason: 'No Desktop-indexed chat/message was available from Beeper Server; raw Matrix rooms do not support these Desktop message APIs.' })
  }

  for (const args of cases) {
    const result = runCli(args, { env, allowFailure: true })
    recordCommand('cli-surface', args, result)
    recordCoverage('commands', args, result)
    if (args[0] === 'accounts' && args[1] === 'add' && args.length === 5) {
      report.notes.push('accounts add without a bridge returned the bridge-picker data; local-dummy covers the actual login flow.')
    } else if (result.status !== 0) {
      recordFailure('cli-surface', target, `beeper ${args.join(' ')} failed with status ${result.status}`)
    }
  }

  await phaseLocalDummyAccountSurface(target, env)

}

async function phaseLocalDummyAccountSurface(target, env) {
  const listArgs = ['accounts', 'list', '--target', target.name, '--account', 'local-dummy', '--json']
  const list = runCli(listArgs, { env, allowFailure: true })
  recordCommand('cli-surface', listArgs, list)
  recordCoverage('commands', listArgs, list)
  const accounts = parseEnvelope(list.stdout)?.data
  const accountID = firstField(apiItems(accounts), ['id', 'accountID'])
  if (!accountID) {
    recordFailure('cli-surface', target, 'local-dummy login completed but accounts list did not return a reusable account ID.')
    return
  }
  for (const args of [
    ['accounts', 'list', '--account', accountID, '--target', target.name, '--json'],
    ['use', 'account', accountID, '--target', target.name, '--json'],
    ['accounts', 'list', '--account', accountID, '--target', target.name, '--json'],
  ]) {
    const result = runCli(args, { env, allowFailure: true })
    recordCommand('cli-surface', args, result)
    recordCoverage('commands', args, result)
    if (result.status !== 0) recordFailure('cli-surface', target, `beeper ${args.join(' ')} failed with status ${result.status}`)
  }
}

async function phaseControlSurface() {
  const targets = await plannedTargetsWithAuth()
  const target = targets.find(item => item.accessToken) ?? targets[0]
  if (!target) return

  if (target.kind === 'server') {
    const args = ['targets', 'runtime', 'restart', target.name, '--json']
    const result = runCli(args, { env: serverEnv(), allowFailure: true })
    recordCommand('control-surface', args, result)
    recordCoverage('commands', args, result)
    if (result.status !== 0) recordFailure('control-surface', target, `beeper ${args.join(' ')} failed with status ${result.status}`)
    try {
      await waitForInfo(target)
    } catch (error) {
      recordFailure('control-surface', target, error)
    }
  } else {
    report.coverage.skipped.push({ command: 'targets runtime restart', reason: 'Only local server targets are controlled by the CLI.' })
  }

  const remoteName = `remote-${runID}`
  for (const args of [
    ['targets', 'add', remoteName, 'http://127.0.0.1:9', '--json'],
    ['status', remoteName, '--json'],
    ['remove', 'target', remoteName, '--json'],
  ]) {
    const result = runCli(args, { allowFailure: true })
    recordCommand('control-surface', args, result)
    const expectedUnreachable = args[0] === 'status' && result.status !== 0 && parseEnvelope(result.stdout)?.data
    recordCoverage('commands', args, result, expectedUnreachable ? true : undefined)
    if (args[0] === 'status' && result.status !== 0 && parseEnvelope(result.stdout)?.data) {
      report.notes.push('remote target status returned non-zero because the test URL is intentionally unreachable; JSON diagnostics were still returned.')
    } else if (result.status !== 0) {
      recordFailure('control-surface', target, `beeper ${args.join(' ')} failed with status ${result.status}`)
    }
  }

  const logoutTarget = targets.filter(item => item.accessToken).at(-1)
  if (logoutTarget) {
    for (const args of [
      ['auth', 'logout', '--target', logoutTarget.name, '--json'],
      ['status', logoutTarget.name, '--json'],
    ]) {
      const result = runCli(args, { allowFailure: true })
      recordCommand('control-surface', args, result)
      recordCoverage('commands', args, result)
      if (result.status !== 0) recordFailure('control-surface', logoutTarget, `beeper ${args.join(' ')} failed with status ${result.status}`)
    }
  }
}

async function phaseCleanup() {
  for (const target of plannedTargets()) {
    if (target.kind === 'server') {
      const stop = runCli(['targets', 'runtime', 'stop', target.name, '--json'], { allowFailure: true })
      recordCommand('cleanup', ['targets', 'runtime', 'stop', target.name, '--json'], stop)
    } else if (target.kind === 'remote') {
      report.notes.push(`Remote Server target ${target.name} was not controlled by the harness.`)
    } else {
      report.notes.push(`Desktop target ${target.name} may need manual quit if it was launched through the app.`)
    }
  }
  if (process.env.BEEPER_E2E_REMOVE_STATE === '1') await rm(workDir, { recursive: true, force: true })
}

function plannedTargets() {
  if (report.targets?.length) return report.targets
  if (remoteBaseURLs.length) {
    return remoteBaseURLs.slice(0, accountCount).map((baseURL, index) => targetPlan('remote', index, index, baseURL))
  }
  const targets = []
  for (let i = 0; i < desktopCount; i++) {
    targets.push(targetPlan('desktop', i, targets.length))
  }
  for (let i = 0; i < serverCount; i++) {
    targets.push(targetPlan('server', i, targets.length))
  }
  return targets.slice(0, accountCount)
}

async function plannedTargetsWithAuth() {
  const targets = plannedTargets()
  for (const target of targets) {
    if (!target.accessToken || target.accessToken === '[redacted]') {
      try {
        target.accessToken = await loadTargetAccessToken(target)
      } catch {
        // target has not reached login yet
      }
    }
  }
  return targets
}

function targetPlan(kind, index, ordinal, baseURL) {
  const email = process.env[`BEEPER_E2E_EMAIL_${ordinal + 1}`] || `qatest+${emailBase + ordinal}@beeper.com`
  const port = Number(process.env[`BEEPER_E2E_PORT_${ordinal + 1}`] || (portStart + ordinal))
  return {
    kind,
    index,
    ordinal,
    name: process.env[`BEEPER_E2E_TARGET_${ordinal + 1}`] || `${kind}-${runID}-${index + 1}`,
    email,
    port,
    baseURL: baseURL || `http://127.0.0.1:${port}`,
  }
}

async function ensureManagedTarget(target) {
  const existing = await readTarget(target.name)
  if (!existing) await createProfileTarget(target.kind, target.name, { port: target.port, serverEnv: 'staging' })
  report.commands.push({
    phase: 'targets',
    command: `prepare local ${target.kind} target ${target.name}`,
    status: 0,
    stdout: existing ? 'target already exists' : `created ${target.baseURL}`,
    stderr: '',
  })
}

async function readPreviousReport() {
  try {
    return JSON.parse(await readFile(reportPath, 'utf8'))
  } catch {
    return undefined
  }
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: commandTimeoutMs,
    env: {
      ...process.env,
      ...options.env,
      BEEPER_CLI_CONFIG_DIR: configDir,
    },
  })
  if (!options.allowFailure && result.status !== 0) fail(result, args)
  return result
}

function fail(result, args) {
  throw new Error(`beeper ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
}

function recordCommand(phase, args, result) {
  report.commands.push({
    phase,
    command: redactCommandOutput(`beeper ${args.join(' ')}`),
    status: result.status,
    stdout: redactCommandOutput(result.stdout).slice(0, 4000),
    stderr: redactCommandOutput(result.stderr).slice(0, 4000),
  })
}

function recordFailure(phase, target, error) {
  const message = error instanceof Error ? error.message : String(error)
  const failure = { phase, target: target?.name, message }
  report.failures.push(failure)
  report.notes.push(`${phase} failed${target?.name ? ` for ${target.name}` : ''}: ${message}`)
}

function redactCommandOutput(value) {
  let redacted = String(value)
    .replace(/"accessToken"\s*:\s*"[^"]+"/g, '"accessToken":"[redacted]"')
    .replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token":"[redacted]"')
    .replace(/"leadToken"\s*:\s*"[^"]+"/g, '"leadToken":"[redacted]"')
    .replace(/"response"\s*:\s*"[^"]+"/g, '"response":"[redacted]"')
  if (otp) redacted = redacted.split(otp).join('[redacted]')
  return redacted
}

function recordBlock(phase, target, message, actions = []) {
  const block = { phase, target: target?.name, message, actions }
  report.blocked.push(block)
  report.notes.push(`${phase} blocked${target?.name ? ` for ${target.name}` : ''}: ${message}`)
}

function recordLoginBlock(target, args, result) {
  const output = `${result.stderr}${result.stdout}`
  const command = `beeper ${args.join(' ')}`
  if (target.kind === 'desktop' && /signed-in local Beeper Desktop session|missing access_token/i.test(output)) {
    recordBlock('login', target, 'Sign in to the isolated Desktop target, then rerun the login/readiness phases.', [
      `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js targets runtime start ${target.name} --json`,
      `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js setup --target ${target.name} --local --json`,
      `BEEPER_E2E_RUN_ID=${runID} BEEPER_E2E_OTP="$QA_OTP" BEEPER_E2E_PHASES=login,readiness bun packages/cli/test/e2e-staging.ts`,
    ])
    return
  }
  if ((target.kind === 'server' || target.kind === 'remote') && /OAuth authorization failed|needs-login|server_error/i.test(output)) {
    recordBlock('login', target, 'Complete Server setup sign-in, then rerun the login/readiness phases.', [
      `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js targets runtime start ${target.name} --json`,
      `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js auth email start --target ${target.name} --email ${target.email} --json`,
      `BEEPER_CLI_CONFIG_DIR=${configDir} bun packages/cli/bin/dev.js auth email response --target ${target.name} --setup-request-id "$SETUP_REQUEST_ID" --code "$QA_OTP" --username "$QA_USERNAME" --force --json`,
      `BEEPER_E2E_RUN_ID=${runID} BEEPER_E2E_OTP="$QA_OTP" BEEPER_E2E_PHASES=login,readiness bun packages/cli/test/e2e-staging.ts`,
    ])
    return
  }
  recordFailure('login', target, new Error(`${command} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`))
}

async function loginServerViaSetupAPI(target) {
  const startArgs = ['auth', 'email', 'start', '--target', target.name, '--email', target.email, '--json']
  const start = runCli(startArgs, { allowFailure: true })
  recordCommand('login', startArgs, start)
  if (start.status !== 0) {
    recordLoginBlock(target, startArgs, start)
    return false
  }
  const setupRequestID = parseEnvelope(start.stdout)?.data?.setupRequestID
  if (!setupRequestID) {
    recordFailure('login', target, `auth email start did not return setupRequestID for ${target.name}`)
    return false
  }

  const responseArgs = ['auth', 'email', 'response', '--target', target.name, '--setup-request-id', setupRequestID, '--code', otp, '--username', usernameForEmail(target.email), '--force', '--json']
  const response = runCli(responseArgs, { allowFailure: true })
  recordCommand('login', responseArgs, response)
  if (response.status !== 0) {
    recordLoginBlock(target, responseArgs, response)
    return false
  }

  const body = parseEnvelope(response.stdout)?.data
  const token = await loadTargetAccessToken(target)
  if (!token) {
    recordFailure('login', target, `setup did not persist a Matrix access token for ${target.name}`)
    return false
  }
  target.accessToken = token
  target.matrix = body?.readiness?.app?.matrix
  return true
}

function usernameForEmail(email) {
  const localPart = email.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  return localPart || `staging-user-${Date.now()}`
}

function dummyPassword() {
  return process.env.BEEPER_E2E_DUMMY_PASSWORD || 'example-password'
}

async function waitForInfo(target) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/v1/info', target.baseURL), { signal: AbortSignal.timeout(1000) })
      if (response.ok) return response.json()
    } catch {
      // keep waiting
    }
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for ${target.name} on ${target.baseURL}`)
}

async function loadTargetAccessToken(target) {
  const targetPath = path.join(configDir, 'targets', `${target.name}.json`)
  const current = JSON.parse(await readFile(targetPath, 'utf8'))
  return current.auth?.accessToken
}

function parseEnvelope(stdout) {
  try {
    return JSON.parse(stdout)
  } catch {
    return undefined
  }
}

async function findReusableChatID(target, env) {
  const result = runCli(['chats', 'list', '--target', target.name, '--limit', '20', '--json'], { env, allowFailure: true })
  recordCommand('surface-setup', ['chats', 'list', '--target', target.name, '--limit', '20', '--json'], result)
  const items = parseEnvelope(result.stdout)?.data
  const chatID = firstField(apiItems(items), ['localChatID', 'id', 'chatID'])
  if (!chatID) {
    report.coverage.skipped.push({ command: 'Desktop-indexed chat mutation surface', reason: 'No reusable Desktop-indexed chat was returned by chats list.' })
    return undefined
  }
  return chatID
}

async function findReusableMessageID(target, chatID, env) {
  const result = runCli(['messages', 'list', '--chat', chatID, '--target', target.name, '--limit', '20', '--json'], { env, allowFailure: true })
  recordCommand('surface-setup', ['messages', 'list', '--chat', chatID, '--target', target.name, '--limit', '20', '--json'], result)
  const items = parseEnvelope(result.stdout)?.data
  const messageID = firstField(apiItems(items), ['id', 'messageID', 'eventID', 'event_id'])
  if (!messageID) {
    report.coverage.skipped.push({ command: 'message-specific Desktop surface', reason: 'No reusable message ID was returned by messages list.' })
    return undefined
  }
  return messageID
}

function firstField(items, fields) {
  for (const item of items) {
    for (const field of fields) {
      if (item[field]) return String(item[field])
    }
  }
  return undefined
}

function recordCoverage(type, args, result, ok = result.status === 0) {
  report.coverage[type] ??= []
  report.coverage[type].push({
    command: `beeper ${redactCommandOutput(args.join(' '))}`,
    status: result.status,
    ok,
  })
}

async function registeredCommands() {
  return commands
    .map(command => command.path.join(' '))
    .sort()
}

function isCoveredByCliSurface(pathname) {
  return [
    '/v1/info',
    '/v1/spec',
    '/v1/app/setup',
    '/v1/app/setup/verifications',
    '/v1/accounts',
    '/v1/chats',
    '/v1/contacts',
    '/v1/messages',
    '/v1/assets',
  ].some(prefix => pathname.startsWith(prefix))
}

function serverEnv() {
  const env = {}
  if (process.env.BEEPER_SERVER_BIN) env.BEEPER_SERVER_BIN = process.env.BEEPER_SERVER_BIN
  return env
}

function hasPhase(name) {
  return phases.includes(name) || phases.includes('all')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function writeReport() {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(redactReport(report), null, 2)}\n`)
}

function redactReport(value) {
  return JSON.parse(JSON.stringify(value, (key, innerValue) => {
    if (key === 'accessToken' || key === 'access_token' || key === 'leadToken') return '[redacted]'
    if (key === 'response' && innerValue === otp) return '[redacted]'
    return innerValue
  }))
}

async function loadEnvFile(envPath) {
  if (!envPath) return
  let text
  try {
    text = await readFile(envPath, 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = unquoteEnvValue(rawValue)
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function printPlan(targets, commands) {
  console.log(`Run ID: ${runID}`)
  console.log(`Workdir: ${workDir}`)
  console.log(`Config: ${configDir}`)
  console.log('Targets:')
  for (const target of targets) console.log(`- ${target.name}: ${target.kind} ${target.baseURL} ${target.email}`)
  console.log('Next commands:')
  for (const command of commands) console.log(`- ${command}`)
}

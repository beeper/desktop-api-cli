import { createDecipheriv } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { constants as fsConstants } from 'node:fs'
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { homedir, platform } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { clearTargetAuth, resolveTarget, saveTargetAuth, type Target } from '../targets.js'
import { authRequired } from '../errors.js'
import { isNoInput } from '../command.js'
import { isSupported, loadBridgeCatalog, templateName, type BridgeCatalog } from './catalog.js'
import { renderBridgeTemplate } from './go-template.js'

export type BridgeEnv = {
  accessToken: string
  catalog: BridgeCatalog
  domain: string
  envName: string
  target: Target
}

export type BridgeTargetEnv = {
  domain: string
  envName: string
  target: Target
}

export type BridgeFlags = {
  env?: string
  'base-url'?: string
  target?: string
}

export type WhoamiResponse = {
  user: {
    asmuxData?: { login_token?: string }
    bridges?: Record<string, WhoamiBridge>
    hungryserv?: WhoamiBridge
  }
  userInfo: {
    isAdmin?: boolean
    isFree?: boolean
    username: string
    channel?: string
    createdAt?: string
    email?: string
    fullName?: string
    bridgeClusterId?: string
    supportRoomId?: string
  }
}

export type WhoamiBridge = {
  version?: string
  remoteState?: Record<string, {
    remoteID?: string
    remoteName?: string
    stateEvent?: string
  }>
  bridgeState?: {
    bridgeType?: string
    isSelfHosted?: boolean
    stateEvent?: string
  }
}

export type AppserviceRegistration = {
  id: string
  url?: string
  as_token: string
  hs_token: string
  sender_localpart: string
  namespaces?: {
    users?: Array<{ exclusive: boolean; regex: string }>
    aliases?: Array<{ exclusive: boolean; regex: string }>
    rooms?: Array<{ exclusive: boolean; regex: string }>
  }
  protocols?: string[]
  rate_limited?: boolean
  receive_ephemeral?: boolean
  'de.sorunome.msc2409.push_ephemeral'?: boolean
  'org.matrix.msc3202'?: boolean
  'io.element.msc4190'?: boolean
}

export type RegisterJSON = {
  registration: AppserviceRegistration
  homeserver_url: string
  homeserver_domain: string
  your_user_id: string
}

export type GeneratedBridgeConfig = RegisterJSON & {
  bridgeType: string
  config?: string
}

export async function prepareBridgeEnv(flags: BridgeFlags): Promise<BridgeEnv> {
  const targetEnv = await prepareBridgeTargetEnv(flags)
  const { target } = targetEnv
  const accessToken = process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken
  if (!accessToken) throw authRequired('beeper bridges requires the selected target to have a Matrix access token.')
  if (!/^(syt|bat)_/.test(accessToken)) {
    throw authRequired('beeper bridges requires a Matrix/Beeper access token (syt_ or bat_), not a Desktop API token.')
  }
  return { ...targetEnv, accessToken, catalog: await loadBridgeCatalog() }
}

export async function prepareBridgeTargetEnv(flags: BridgeFlags): Promise<BridgeTargetEnv> {
  const target = await resolveTarget({ target: flags.target, baseURL: flags['base-url'] })
  const envName = flags.env || process.env.BEEPER_BRIDGE_ENV || target.serverEnv || 'prod'
  return {
    domain: resolveDomain(envName),
    envName,
    target,
  }
}

export async function loginWithEmail(env: BridgeTargetEnv, email: string, codeProvider: (requestID: string) => Promise<string>): Promise<{ accessToken: string; userID: string; whoami: WhoamiResponse | undefined }> {
  const start = await beeperPublicAPI<{ request: string }>(env.domain, 'POST', '/user/login', {})
  await beeperPublicAPI(env.domain, 'POST', '/user/login/email', {
    request: start.request,
    email,
    appType: 'bbctl',
    onlyExistingAccounts: true,
  })
  for (;;) {
    const code = await codeProvider(start.request)
    try {
      const response = await beeperPublicAPI<{ token: string; whoami?: WhoamiResponse }>(env.domain, 'POST', '/user/login/response', {
        request: start.request,
        response: code,
        appType: 'bbctl',
        onlyExistingAccounts: true,
      })
      const login = await matrixLogin(env.domain, {
        type: 'org.matrix.login.jwt',
        token: response.token,
        initial_device_display_name: 'github.com/beeper/bridge-manager',
      })
      await saveTargetAuth(env.target, { accessToken: login.access_token, source: 'manual', tokenType: 'Bearer' })
      return { accessToken: login.access_token, userID: login.user_id, whoami: response.whoami }
    } catch (error) {
      if (!String((error as Error).message).includes('invalid login code')) throw error
      process.stderr.write(`${(error as Error).message}\n`)
    }
  }
}

export async function loginWithPassword(env: BridgeTargetEnv, username: string, password: string): Promise<{ accessToken: string; userID: string }> {
  const login = await matrixLogin(env.domain, {
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: username },
    password,
    initial_device_display_name: 'github.com/beeper/bridge-manager',
  })
  await saveTargetAuth(env.target, { accessToken: login.access_token, source: 'manual', tokenType: 'Bearer' })
  return { accessToken: login.access_token, userID: login.user_id }
}

export async function logoutBridgeTarget(env: BridgeEnv, force: boolean): Promise<void> {
  try {
    await matrixAPI(env.domain, env.accessToken, 'POST', '/_matrix/client/v3/logout', {})
  } catch (error) {
    if (!force) throw new Error(`error logging out: ${(error as Error).message}`)
  }
  if (env.target.auth?.accessToken) {
    await clearTargetAuth(env.target)
  } else if (process.env.BEEPER_ACCESS_TOKEN) {
    throw new Error('Logged out on the server, but BEEPER_ACCESS_TOKEN cannot be cleared from this process.')
  }
}

export async function whoami(env: BridgeEnv): Promise<WhoamiResponse> {
  return beeperAPI(env, 'GET', '/whoami') as Promise<WhoamiResponse>
}

export async function registerBridge(
  env: BridgeEnv,
  bridge: string,
  options: { address?: string; bridgeType?: string; force?: boolean; get?: boolean; noState?: boolean },
): Promise<RegisterJSON> {
  const info = await whoami(env)
  const username = info.userInfo.username
  const bridgeInfo = info.user.bridges?.[bridge]
  if (bridgeInfo && !bridgeInfo.bridgeState?.isSelfHosted && !options.force) {
    throw new Error(`Your ${bridge} bridge is not self-hosted.`)
  }

  const req = options.address
    ? { address: options.address, push: true, self_hosted: true }
    : { push: false, self_hosted: true }
  if (options.get && options.address) throw new Error("You can't use --get with --address")

  const registration = await hungryAPI<AppserviceRegistration>(
    env,
    username,
    options.get ? 'GET' : 'PUT',
    `/_matrix/asmux/mxauth/appservice/${encodeURIComponent(username)}/${encodeURIComponent(bridge)}`,
    options.get ? undefined : req,
  )
  registration.namespaces = registration.namespaces ?? {}
  if (registration.namespaces.users?.length) registration.namespaces.users = registration.namespaces.users.slice(0, 1)

  const state = (options.bridgeType && options.bridgeType !== 'heisenbridge') || ['androidsms', 'imessagecloud', 'imessage'].includes(bridge)
    ? 'STARTING'
    : 'RUNNING'
  if (!options.noState) {
    await postBridgeState(env, username, bridge, registration.as_token, {
      stateEvent: state,
      reason: 'SELF_HOST_REGISTERED',
      isSelfHosted: true,
      bridgeType: options.bridgeType || undefined,
    })
  }

  return {
    registration,
    homeserver_url: hungryURL(env.domain, username),
    homeserver_domain: 'beeper.local',
    your_user_id: `@${username}:${env.domain}`,
  }
}

export async function deleteBridge(env: BridgeEnv, bridge: string): Promise<void> {
  await beeperAPI(env, 'DELETE', `/bridge/${encodeURIComponent(bridge)}`)
}

export async function generateBridgeConfig(
  env: BridgeEnv,
  bridge: string,
  options: { force?: boolean; noState?: boolean; params?: string[]; type?: string },
): Promise<GeneratedBridgeConfig> {
  validateBridgeName(bridge, Boolean(options.force))
  const info = await whoami(env)
  const existingType = info.user.bridges?.[bridge]?.bridgeState?.bridgeType
  const bridgeType = existingType || await guessOrAskBridgeType(env.catalog, bridge, options.type)
  const extraParams = parseParams(options.params)
  const cliParams = new Set(Object.keys(extraParams))
  await applyBridgeParamDefaults(bridge, bridgeType, extraParams)
  const addedParams = Object.entries(extraParams).filter(([key]) => !cliParams.has(key))
  if (addedParams.length && !isNoInput()) {
    process.stderr.write(`To run without specifying parameters interactively, add ${addedParams.map(([key, value]) => `--param '${key}=${value}'`).join(' ')} next time\n`)
  }

  const reg = await registerBridge(env, bridge, { bridgeType, force: options.force, noState: options.noState })
  const websocket = Boolean(env.catalog.websocketBridges[bridgeType])
  let listenAddr = ''
  let listenPort = 0
  if (!websocket) {
    const proxy = getBridgeWebsocketProxyConfig(env.catalog, bridge, bridgeType)
    listenAddr = proxy.listenAddr
    listenPort = proxy.listenPort
    reg.registration.url = proxy.url
  }

  const databasePrefix = process.env.BEEPER_BRIDGE_DATABASE_DIR ? join(process.env.BEEPER_BRIDGE_DATABASE_DIR, `${bridge}-`) : ''
  const params = {
    HungryAddress: reg.homeserver_url,
    BeeperDomain: env.domain,
    Websocket: websocket,
    ListenAddr: listenAddr,
    ListenPort: listenPort,
    AppserviceID: reg.registration.id,
    ASToken: reg.registration.as_token,
    HSToken: reg.registration.hs_token,
    BridgeName: bridge,
    Username: localpart(reg.your_user_id),
    UserID: reg.your_user_id,
    ProvisioningSecret: info.user.asmuxData?.login_token ?? '',
    DatabasePrefix: databasePrefix,
    Params: extraParams,
  }

  return {
    ...reg,
    bridgeType,
    config: renderBridgeTemplate(env.catalog, templateName(bridgeType), params),
  }
}

export function validateBridgeName(bridge: string, force = false): void {
  if (!/^[a-z0-9-]{1,32}$/.test(bridge)) throw new Error('Invalid bridge name. Names must consist of 1-32 lowercase ASCII letters, digits and -.')
  if (!bridge.startsWith('sh-')) {
    if (!force) throw new Error('Self-hosted bridge names should start with sh-')
    process.stderr.write('Self-hosted bridge names should start with sh-\n')
  }
}

export function validateBridgeID(bridge: string): void {
  if (!/^[a-z0-9-]{1,32}$/.test(bridge)) throw new Error('Invalid bridge name')
}

export async function outputFile(name: string, data: string, outputPath: string): Promise<void> {
  if (outputPath === '-') {
    process.stderr.write(`${name} file:\n`)
    process.stdout.write(`${data.trimEnd()}\n`)
    return
  }
  await writeFile(outputPath, data, { mode: 0o600 })
  process.stderr.write(`Wrote ${name.toLowerCase()} file to ${outputPath}\n`)
}

export async function writeRegistrationJSON(output: RegisterJSON): Promise<void> {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

export function registrationToYAML(registration: AppserviceRegistration): string {
  return yamlValue({
    id: registration.id,
    url: registration.url ?? '',
    as_token: registration.as_token,
    hs_token: registration.hs_token,
    sender_localpart: registration.sender_localpart,
    rate_limited: registration.rate_limited,
    namespaces: registration.namespaces ?? {},
    protocols: registration.protocols,
    'de.sorunome.msc2409.push_ephemeral': registration['de.sorunome.msc2409.push_ephemeral'],
    receive_ephemeral: registration.receive_ephemeral,
    'org.matrix.msc3202': registration['org.matrix.msc3202'],
    'io.element.msc4190': registration['io.element.msc4190'],
  })
}

export function parseRegistration(data: string): AppserviceRegistration {
  const trimmed = data.trim()
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as AppserviceRegistration
  const reg: Record<string, unknown> = {}
  const lines = data.split(/\r?\n/)
  let section: string | undefined
  let namespace: string | undefined
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const indent = line.match(/^ */)?.[0].length ?? 0
    const trimmedLine = line.trim()
    if (indent === 0) {
      const [key, ...rest] = trimmedLine.split(':')
      section = key
      namespace = undefined
      if (rest.join(':').trim()) reg[key!] = parseScalar(rest.join(':').trim())
      else if (key === 'namespaces') reg.namespaces = {}
    } else if (section === 'namespaces' && indent === 2) {
      namespace = trimmedLine.slice(0, -1)
      ;((reg.namespaces as Record<string, unknown[]>)[namespace] = [])
    } else if (section === 'namespaces' && namespace && trimmedLine.startsWith('- ')) {
      const keyValue = trimmedLine.slice(2)
      const [key, ...rest] = keyValue.split(':')
      ;((reg.namespaces as Record<string, unknown[]>)[namespace] ??= []).push({ [key!]: parseScalar(rest.join(':').trim()) })
    } else if (section === 'namespaces' && namespace && indent >= 6) {
      const list = (reg.namespaces as Record<string, Array<Record<string, unknown>>>)[namespace]
      const item = list?.at(-1)
      const [key, ...rest] = trimmedLine.split(':')
      if (item && key) item[key] = parseScalar(rest.join(':').trim())
    }
  }
  return reg as AppserviceRegistration
}

export function bridgeDataDir(envName: string): string {
  const dataHome = process.env.BBCTL_DATA_HOME
    || (platform() === 'win32' || platform() === 'darwin' ? userConfigDir() : process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'))
  return join(dataHome, 'bbctl', envName)
}

export function getBridgeWebsocketProxyConfig(catalog: BridgeCatalog, bridgeName: string, bridgeType: string): { listenAddr: string; listenPort: number; url: string } {
  const suffix = catalog.bridgeIPSuffix[bridgeType] || '1'
  const listenAddr = platform() === 'darwin' ? '127.0.0.1' : `127.29.3.${suffix}`
  const listenPort = 30_000 + (crc32(Buffer.from(bridgeName)) % 30_000)
  return { listenAddr, listenPort, url: `http://${listenAddr}:${listenPort}` }
}

export async function updateGoBridge(binaryPath: string, bridgeType: string, noUpdate: boolean): Promise<void> {
  await mkdir(dirname(binaryPath), { recursive: true, mode: 0o700 })
  let currentCommit = ''
  if (await exists(binaryPath)) {
    try {
      const version = JSON.parse(await runCapture(binaryPath, ['--version-json'], dirname(binaryPath)))
      currentCommit = version.Commit ?? version.commit ?? ''
    } catch (error) {
      process.stderr.write(`Failed to get current bridge version: ${(error as Error).message} - reinstalling\n`)
    }
  }
  await downloadMautrixBridgeBinary(bridgeType, binaryPath, noUpdate, currentCommit)
}

export async function compileGoBridge(buildDir: string, binaryPath: string, bridgeType: string, noUpdate: boolean): Promise<void> {
  await mkdir(dirname(buildDir), { recursive: true, mode: 0o700 })
  if (!await exists(buildDir)) {
    const repo = bridgeType === 'imessagego' ? 'https://github.com/beeper/imessage.git' : `https://github.com/mautrix/${bridgeType}.git`
    process.stderr.write(`Cloning ${repo} to ${buildDir}\n`)
    await runCommand('git', ['clone', repo, buildDir], dirname(buildDir))
  } else {
    if (await exists(binaryPath)) {
      try {
        await runCapture(binaryPath, ['--version-json'], buildDir)
        if (noUpdate) {
          process.stderr.write('Not updating bridge because --no-update was specified\n')
          return
        }
      } catch (error) {
        process.stderr.write(`Failed to get current bridge version: ${(error as Error).message} - reinstalling\n`)
      }
    }
    process.stderr.write(`Pulling ${buildDir}\n`)
    await runCommand('git', ['pull'], buildDir)
  }
  process.stderr.write('Compiling bridge with ./build.sh\n')
  await runCommand('./build.sh', [], buildDir)
}

export async function setupPythonVenv(bridgeDir: string, bridgeType: string, localDev: boolean): Promise<string> {
  let installPackage: string
  let localRequirements = ['-r', 'requirements.txt']
  if (bridgeType === 'heisenbridge') installPackage = 'heisenbridge'
  else if (bridgeType === 'googlechat') {
    installPackage = 'mautrix-googlechat[all]'
    localRequirements = [...localRequirements, '-r', 'optional-requirements.txt']
  } else {
    throw new Error(`unknown python bridge type ${bridgeType}`)
  }
  const venvPath = join(bridgeDir, localDev ? '.venv' : 'venv')
  const venvArgs = ['-m', 'venv', ...(process.env.SYSTEM_SITE_PACKAGES === 'true' ? ['--system-site-packages'] : []), venvPath]
  process.stderr.write(`Creating Python virtualenv at ${venvPath}\n`)
  await runCommand('python3', venvArgs, bridgeDir)
  const packages = localDev ? localRequirements : [installPackage]
  process.stderr.write(`Installing ${packages.join(' ')} into virtualenv\n`)
  await runCommand(join(venvPath, 'bin', 'pip3'), ['install', '--upgrade', ...packages], bridgeDir)
  return venvPath
}

export async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  const child = spawn(command, args, { cwd, stdio: 'inherit' })
  const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null]
  if (code !== 0) throw new Error(`${command} exited with ${signal ?? code}`)
}

async function downloadMautrixBridgeBinary(bridge: string, binaryPath: string, noUpdate: boolean, currentCommit: string): Promise<void> {
  const repo = `mautrix/${bridge}`
  const ref = bridge === 'imessage' ? 'master' : 'main'
  const job = getJobFromBridge(bridge)
  const fileName = basename(binaryPath)
  process.stderr.write(`${currentCommit ? 'Checking for updates to' : 'Finding latest version of'} ${fileName} from mau.dev\n`)
  const build = await getLastBuild('mau.dev', repo, ref, job)
  if (build.commit === currentCommit) {
    process.stderr.write(`${fileName} is up to date (${currentCommit.slice(0, 8)})\n`)
    return
  }
  if (currentCommit && noUpdate) {
    process.stderr.write(`${fileName} is out of date, latest commit is ${build.commit.slice(0, 8)}\n`)
    return
  }
  const artifactURL = `https://mau.dev${build.jobURL}/artifacts/raw/${fileName}`
  await downloadFile(artifactURL, binaryPath)
  if (platform() === 'darwin' && needsLibolmDylib(bridge)) {
    const libolmPath = join(dirname(binaryPath), 'libolm.3.dylib')
    if (!await exists(libolmPath)) await downloadFile(`https://mau.dev${build.jobURL}/artifacts/raw/libolm.3.dylib`, libolmPath)
  }
  process.stderr.write(`Successfully installed ${fileName} commit ${build.commit.slice(0, 8)}\n`)
}

async function getLastBuild(domain: string, repo: string, ref: string, job: string): Promise<{ commit: string; jobURL: string }> {
  const query = `query($repo: ID!, $ref: String!, $job: String!) {
  project(fullPath: $repo) {
    pipelines(status: SUCCESS, ref: $ref, first: 1) {
      nodes { sha job(name: $job) { webPath } }
    }
  }
}`
  const response = await fetch(`https://${domain}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'beeper-cli bridge-manager-ts' },
    body: JSON.stringify({ query, variables: { repo, ref, job } }),
  })
  if (!response.ok) throw new Error(`GitLab GraphQL returned HTTP ${response.status}: ${await response.text()}`)
  const json = await response.json() as { data?: { project?: { pipelines?: { nodes?: Array<{ sha: string; job?: { webPath?: string } }> } } } }
  const node = json.data?.project?.pipelines?.nodes?.[0]
  if (!node?.sha || !node.job?.webPath) throw new Error('did not get pipeline info in response')
  return { commit: node.sha, jobURL: node.job.webPath }
}

function getJobFromBridge(bridge: string): string {
  const osAndArch = `${platform()}/${process.arch}`
  if (osAndArch === 'linux/x64') return 'build amd64'
  if (osAndArch === 'linux/arm64') return 'build arm64'
  if (osAndArch === 'linux/arm') {
    if (bridge === 'signal') throw new Error('mautrix-signal binaries for 32-bit arm are not built in the CI')
    return 'build arm'
  }
  if (osAndArch === 'darwin/arm64') return bridge === 'imessage' ? 'build universal' : 'build macos arm64'
  if (bridge === 'imessage') return 'build universal'
  throw new Error(`binaries for ${osAndArch} are not built in the CI`)
}

async function downloadFile(url: string, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`failed to download ${url}: HTTP ${response.status}`)
  const tmp = join(dirname(path), `tmp-${basename(path)}-${Date.now()}`)
  await pipeline(Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>), createWriteStream(tmp))
  await chmod(tmp, 0o755)
  await rm(path, { force: true })
  await import('node:fs/promises').then(fs => fs.rename(tmp, path))
}

function needsLibolmDylib(bridge: string): boolean {
  return ['imessage', 'whatsapp', 'discord', 'slack', 'gmessages', 'gvoice', 'signal', 'imessagego', 'meta', 'twitter', 'bluesky', 'linkedin', 'telegram'].includes(bridge)
}

async function beeperAPI(env: BridgeEnv, method: string, path: string, body?: unknown): Promise<unknown> {
  return requestJSON(`https://api.${env.domain}${path}`, method, env.accessToken, body)
}

async function beeperPublicAPI<T>(domain: string, method: string, path: string, body?: unknown): Promise<T> {
  return requestJSON(`https://api.${domain}${path}`, method, 'BEEPER-PRIVATE-API-PLEASE-DONT-USE', body) as Promise<T>
}

async function hungryAPI<T>(env: BridgeEnv, username: string, method: string, path: string, body?: unknown): Promise<T> {
  return requestJSON(`${hungryURL(env.domain, username)}${path}`, method, env.accessToken, body) as Promise<T>
}

async function postBridgeState(env: BridgeEnv, username: string, bridge: string, asToken: string, body: Record<string, unknown>): Promise<void> {
  await requestJSON(`https://api.${env.domain}/bridgebox/${encodeURIComponent(username)}/bridge/${encodeURIComponent(bridge)}/bridge_state`, 'POST', asToken, body)
}

async function matrixLogin(domain: string, body: Record<string, unknown>): Promise<{ access_token: string; user_id: string }> {
  return requestJSON(`https://matrix.${domain}/_matrix/client/v3/login`, 'POST', '', body) as Promise<{ access_token: string; user_id: string }>
}

async function matrixAPI(domain: string, token: string, method: string, path: string, body?: unknown): Promise<unknown> {
  return requestJSON(`https://matrix.${domain}${path}`, method, token, body)
}

async function requestJSON(url: string, method: string, token: string, body?: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      'User-Agent': 'beeper-cli bridge-manager-ts',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string; errcode?: string }
      message = parsed.error || parsed.errcode || text
    } catch {}
    throw new Error(`server returned error (HTTP ${response.status}): ${message}`)
  }
  if (response.status === 204) return undefined
  return response.json()
}

function resolveDomain(value: string): string {
  const envs: Record<string, string> = {
    prod: 'beeper.com',
    production: 'beeper.com',
    staging: 'beeper-staging.com',
    dev: 'beeper-dev.com',
    local: 'beeper.localtest.me',
  }
  return envs[value] ?? value
}

async function guessOrAskBridgeType(catalog: BridgeCatalog, bridge: string, bridgeType?: string): Promise<string> {
  if (!bridgeType) {
    outer:
    for (const item of catalog.officialBridges) {
      for (const name of item.names) {
        if (bridge.includes(name)) {
          bridgeType = item.typeName
          break outer
        }
      }
    }
  }
  if (bridgeType && isSupported(catalog, bridgeType)) return bridgeType
  process.stderr.write(`Unsupported bridge type ${bridgeType ?? ''}\n`)
  if (isNoInput() || !process.stdin.isTTY) throw new Error('Pass --type with one of: ' + catalog.supportedBridges.join(', '))
  return promptSelect('Select bridge type:', catalog.supportedBridges)
}

async function applyBridgeParamDefaults(bridgeName: string, bridgeType: string, params: Record<string, string>): Promise<void> {
  if (bridgeType === 'telegram') {
    params.api_id ??= '26417019'
    params.api_hash ??= decryptTelegramAPIHash()
  } else if (bridgeType === 'meta') {
    let metaPlatform = params.meta_platform
    if (!metaPlatform) {
      if (bridgeName.includes('facebook-tor') || bridgeName.includes('facebooktor')) metaPlatform = 'facebook-tor'
      else if (bridgeName.includes('facebook')) metaPlatform = 'facebook'
      else if (bridgeName.includes('messenger')) metaPlatform = 'messenger'
      else if (bridgeName.includes('instagram')) metaPlatform = 'instagram'
      else metaPlatform = ''
      params.meta_platform = metaPlatform
    }
    if (metaPlatform && !['instagram', 'facebook', 'facebook-tor', 'messenger', 'messenger-lite'].includes(metaPlatform)) {
      throw new Error('Invalid Meta platform specified')
    }
    if (metaPlatform === 'facebook-tor' && !params.proxy) params.proxy = await promptInput('Enter Tor proxy address', 'socks5://localhost:1080')
  } else if (bridgeType === 'imessagego') {
    if (!params.nac_token) params.nac_token = await promptInput('Enter iMessage registration code')
  } else if (bridgeType === 'imessage') {
    await applyIMessageParams(params)
  }
}

async function applyIMessageParams(params: Record<string, string>): Promise<void> {
  if (platform() !== 'darwin' && !params.imessage_platform) params.imessage_platform = 'bluebubbles'
  if (!params.imessage_platform) {
    params.imessage_platform = await promptSelect('Select iMessage connector:', ['mac', 'mac-nosip', 'bluebubbles'])
  }
  if (params.imessage_platform === 'mac-nosip' && !params.barcelona_path) {
    params.barcelona_path = await promptInput('Enter Barcelona executable path:', 'darwin-barcelona-mautrix')
  }
  if (params.imessage_platform === 'bluebubbles') {
    if (!params.bluebubbles_url) params.bluebubbles_url = await promptInput('Enter BlueBubbles API address:')
    if (!params.bluebubbles_password) params.bluebubbles_password = await promptInput('Enter BlueBubbles password:')
  }
}

function parseParams(values: string[] | undefined): Record<string, string> {
  const params: Record<string, string> = {}
  for (const item of values ?? []) {
    const index = item.indexOf('=')
    if (index <= 0) throw new Error(`Invalid param ${item}`)
    params[item.slice(0, index).toLowerCase()] = item.slice(index + 1)
  }
  return params
}

async function promptInput(message: string, defaultValue = ''): Promise<string> {
  if (isNoInput() || !process.stdin.isTTY) {
    if (defaultValue) return defaultValue
    throw new Error(`${message} is required. Pass it with --param.`)
  }
  const rl = createInterface({ input, output })
  try {
    const suffix = defaultValue ? ` (${defaultValue})` : ''
    return (await rl.question(`${message}${suffix}: `)).trim() || defaultValue
  } finally {
    rl.close()
  }
}

async function promptSelect(message: string, options: string[]): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    process.stdout.write(`${message}\n`)
    options.forEach((option, index) => process.stdout.write(`  ${index + 1}. ${option}\n`))
    for (;;) {
      const answer = (await rl.question('Select: ')).trim()
      const selected = Number.parseInt(answer, 10)
      if (Number.isInteger(selected) && selected >= 1 && selected <= options.length) return options[selected - 1]!
      if (options.includes(answer)) return answer
      process.stdout.write('Choose one of the listed options.\n')
    }
  } finally {
    rl.close()
  }
}

function decryptTelegramAPIHash(): string {
  const key = Buffer.from('qDP2pQ1LogRjxUYrFUDjDw', 'base64url')
  const data = Buffer.from('B9VMuZeZlFk0pkbLcfSDDQ', 'base64url')
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  decipher.setAutoPadding(false)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('hex')
}

function localpart(userID: string): string {
  return userID.startsWith('@') ? userID.slice(1).split(':')[0] ?? userID : userID
}

export function hungryURL(domain: string, username: string): string {
  return `https://matrix.${domain}/_hungryserv/${encodeURIComponent(username)}`
}

function yamlValue(value: unknown, indent = 0): string {
  if (Array.isArray(value)) {
    return value.map(item => `${' '.repeat(indent)}- ${yamlInline(item, indent + 2)}`).join('')
  }
  if (!value || typeof value !== 'object') return `${yamlScalar(value)}\n`
  let out = ''
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child === undefined) continue
    if (child && typeof child === 'object') out += `${' '.repeat(indent)}${key}:\n${yamlValue(child, indent + 2)}`
    else out += `${' '.repeat(indent)}${key}: ${yamlScalar(child)}\n`
  }
  return out
}

function yamlInline(value: unknown, indent: number): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return yamlScalar(value) + '\n'
  const entries = Object.entries(value as Record<string, unknown>)
  const [first, ...rest] = entries
  if (!first) return '{}\n'
  return `${first[0]}: ${yamlScalar(first[1])}\n${rest.map(([key, child]) => `${' '.repeat(indent)}${key}: ${yamlScalar(child)}\n`).join('')}`
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (!text || /[:\n{}[\],&*#?|\-<>=!%@`]/.test(text) || /^\s|\s$/.test(text)) return JSON.stringify(text)
  return text
}

function parseScalar(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1)
  return value
}

async function runCapture(command: string, args: string[], cwd: string): Promise<string> {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => stdout += String(chunk))
  child.stderr.on('data', chunk => stderr += String(chunk))
  const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null]
  if (code !== 0) throw new Error(stderr.trim() || `${command} exited with ${signal ?? code}`)
  return stdout
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

function userConfigDir(): string {
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support')
  if (platform() === 'win32') return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

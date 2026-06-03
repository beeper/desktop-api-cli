import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify } from 'node:util'
import { beeperDir, type Target } from './targets.js'
import { readInstallations, type Installations } from './installations.js'

const execFileAsync = promisify(execFile)

type ProfileRun = {
  id: string
  pid: number
  startedAt: string
  log: string
  errorLog: string
}

const profileRunDir = () => join(beeperDir(), 'run', 'profiles')
const profileLogDir = () => join(beeperDir(), 'logs', 'profiles')
const profileRunPath = (id: string) => join(profileRunDir(), `${id}.json`)
export const profileLogPath = (id: string) => join(profileLogDir(), `${id}.log`)
export const profileErrorLogPath = (id: string) => join(profileLogDir(), `${id}.err.log`)

function assertProfile(target: Target): void {
  if (!target.dataDir) throw new Error(`Target "${target.id}" is not a local profile.`)
}

function defaultDesktopDataDir(profile?: string): string {
  const appName = `BeeperTexts${profile ? `-${profile}` : ''}`
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName)
  if (process.platform === 'win32') return process.env.APPDATA ? join(process.env.APPDATA, appName) : join(homedir(), appName)
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName)
}

export function desktopLogDir(target?: Target): string {
  return join(target?.dataDir ?? defaultDesktopDataDir(target?.profile), 'logs')
}

export async function startProfile(target: Target): Promise<ProfileRun | { id: string; startedAt: string }> {
  assertProfile(target)
  if (target.type === 'desktop') return launchDesktopApp(target)
  return startServerProfile(target)
}

export async function launchDesktopApp(target?: Target): Promise<{ id: string; startedAt: string }> {
  const appPath = await findDesktopAppPath()
  const args = appPath ? ['-n', appPath, '--args'] : ['-n', '-a', 'Beeper', '--args']
  args.push('--no-enforce-app-location')
  if (target?.port) args.push(`--pas-port=${target.port}`)
  if (target?.serverEnv) args.push(`--server-env=${target.serverEnv}`)
  const env = target?.dataDir
    ? {
        ...process.env,
        ALLOW_MULTIPLE_INSTANCES: 'true',
        BEEPER_PROFILE: target.profile ?? target.id,
        BEEPER_USER_DATA_DIR: target.dataDir,
      }
    : process.env
  spawn('open', args, { detached: true, stdio: 'ignore', env }).unref()
  return { id: target?.id ?? 'desktop', startedAt: new Date().toISOString() }
}

export async function findDesktopAppPath(installations?: Installations): Promise<string | undefined> {
  installations ??= await readInstallations().catch(() => ({}))
  if (installations.desktop?.path && await isBeeperDesktopApp(installations.desktop.path)) return installations.desktop.path

  if (process.platform === 'darwin') {
    for (const path of [
      '/Applications/Beeper.app',
      '/Applications/Beeper Nightly.app',
    ]) {
      if (await isBeeperDesktopApp(path)) return path
    }
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const candidates = [
      join(localAppData, 'Programs', 'Beeper', 'Beeper.exe'),
      join(localAppData, 'Programs', 'Beeper Nightly', 'Beeper Nightly.exe'),
    ]
    for (const path of candidates) {
      if (await access(path).then(() => true, () => false)) return path
    }
  }

  if (process.platform === 'linux') {
    for (const path of ['/usr/bin/beeper', '/usr/local/bin/beeper']) {
      if (await access(path).then(() => true, () => false)) return path
    }
  }

  return undefined
}

async function isBeeperDesktopApp(path: string): Promise<boolean> {
  if (!await access(path).then(() => true, () => false)) return false
  if (process.platform !== 'darwin') return true
  const bundleID = await readBundleID(path)
  return bundleID === 'com.automattic.beeper.desktop' || bundleID === 'com.automattic.beeper.desktop.nightly'
}

async function readBundleID(appPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('/usr/libexec/PlistBuddy', [
      '-c',
      'Print CFBundleIdentifier',
      join(appPath, 'Contents', 'Info.plist'),
    ])
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

export async function stopProfile(target: Target): Promise<void> {
  assertProfile(target)
  if (target.type === 'desktop') throw new Error('Quit Beeper Desktop from the app.')
  const run = await readRun(target.id)
  if (!run) throw new Error(`Profile "${target.id}" is not running.`)
  if (!isRunning(run.pid)) {
    await rm(profileRunPath(target.id), { force: true })
    throw new Error(`Profile "${target.id}" is not running.`)
  }
  try {
    process.kill(run.pid, 'SIGTERM')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
  if (!await waitForExit(run.pid, 5_000)) {
    process.kill(run.pid, 'SIGKILL')
    await waitForExit(run.pid, 2_000)
  }
  await rm(profileRunPath(target.id), { force: true })
}

async function readRun(id: string): Promise<ProfileRun | undefined> {
  try {
    return JSON.parse(await readFile(profileRunPath(id), 'utf8')) as ProfileRun
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function startServerProfile(target: Target): Promise<ProfileRun> {
  const current = await readRun(target.id)
  if (current) {
    if (isRunning(current.pid) && await isReachable(target)) return current
    await rm(profileRunPath(target.id), { force: true })
  }
  if (await isReachable(target)) throw new Error(`Profile "${target.id}" is already reachable at ${target.baseURL}.`)
  const installations = await readInstallations()
  const binary = process.env.BEEPER_SERVER_BIN || installations.server?.path
  if (!binary) throw new Error('Beeper Server is not installed. Run: beeper install server')
  await mkdir(profileRunDir(), { recursive: true })
  await mkdir(profileLogDir(), { recursive: true })
  const log = profileLogPath(target.id)
  const errorLog = profileErrorLogPath(target.id)
  const outFd = openSync(log, 'a')
  const errFd = openSync(errorLog, 'a')
  let child
  try {
    child = spawn(binary, serverArgs(target), {
      detached: true,
      stdio: ['ignore', outFd, errFd],
      env: { ...process.env, BEEPER_SERVER_DATA_DIR: target.dataDir! },
    })
  } finally {
    closeSync(outFd)
    closeSync(errFd)
  }
  child.unref()
  const run = { id: target.id, pid: child.pid!, startedAt: new Date().toISOString(), log, errorLog }
  await writeFile(profileRunPath(target.id), `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 })
  try {
    await waitUntilReachable(target, 15_000)
  } catch (error) {
    await rm(profileRunPath(target.id), { force: true })
    throw error
  }
  return run
}

function serverArgs(target: Target): string[] {
  const args = [
    '--host=127.0.0.1',
    `--port=${target.port ?? new URL(target.baseURL).port}`,
    `--data-dir=${target.dataDir}`,
  ]
  if (target.serverEnv) args.push(`--server-env=${target.serverEnv}`)
  return args
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function isReachable(target: Target): Promise<boolean> {
  return fetch(new URL('/v1/info', target.baseURL), { signal: AbortSignal.timeout(1000) })
    .then(response => response.ok)
    .catch(() => false)
}

async function waitUntilReachable(target: Target, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(target)) return
    await sleep(250)
  }
  throw new Error(`Profile "${target.id}" did not become ready at ${target.baseURL}. Check logs: ${profileErrorLogPath(target.id)}`)
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!isRunning(pid)) return true
    await sleep(100)
  }
  return false
}

import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { closeSync, openSync, existsSync } from 'node:fs'
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { beeperDir, type Target } from './targets.js'
import { readInstallations } from './installations.js'
import { usageError } from './errors.js'

const execFileAsync = promisify(execFile)

export type ProfileRun = {
  id: string
  pid: number
  startedAt: string
  log: string
  errorLog: string
}

export const profileRunDir = () => join(beeperDir(), 'run', 'profiles')
export const profileLogDir = () => join(beeperDir(), 'logs', 'profiles')
export const profileRunPath = (id: string) => join(profileRunDir(), `${id}.json`)
export const profileLogPath = (id: string) => join(profileLogDir(), `${id}.log`)
export const profileErrorLogPath = (id: string) => join(profileLogDir(), `${id}.err.log`)

export function assertProfile(target: Target): void {
  if (!target.managed || !target.dataDir) throw new Error(`Target "${target.id}" is not a local profile.`)
}

export function assertServerProfile(target: Target): void {
  if (!target.managed || !target.dataDir || target.type !== 'server') {
    throw usageError(`Target "${target.id}" is not a local Beeper Server install.`)
  }
}

export function defaultDesktopDataDir(profile?: string): string {
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
  if (target.type === 'desktop') return startDesktopProfile(target)
  return startServerProfile(target)
}

export async function launchDesktopApp(target?: Target): Promise<{ id: string; startedAt: string }> {
  const installations = await readInstallations().catch(() => ({ desktop: undefined }))

  const appPath = installations.desktop?.path && existsSync(installations.desktop.path) ? installations.desktop.path : await findDesktopAppPath()

  if (process.platform === 'darwin') {
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
  }

  if (process.platform === 'linux' || process.platform === 'win32') {
    if (!appPath) throw new Error("Beeper Desktop not found. Please install beeper using 'beeper install --desktop' or add Beeper Desktop to the PATH")
    const args = ['--no-enforce-app-location']
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
    spawn(appPath, args, { detached: true, stdio: 'ignore', env }).unref()
  }
  return { id: target?.id ?? 'desktop', startedAt: new Date().toISOString() }
}
export async function findDesktopAppPath(): Promise<string | undefined> {
  const installations = await readInstallations().catch(() => ({ desktop: undefined }))
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
      if (await pathExists(path)) return path
    }
  }

  if (process.platform === 'linux') {
    // 1. Check ~/.beeper/apps/desktop directory for AppImage first
    const desktopAppDir = join(homedir(), '.beeper', 'apps', 'desktop');
    try {
      const files = await readdir(desktopAppDir);
      for (const file of files) {
        const filePath = join(desktopAppDir, file);
        if (file.match(/^Beeper-.*\.AppImage$/i) && await pathExists(filePath)) {
          return filePath;
        }
      }
    } catch {
      // Directory doesn't exist or cannot be read, continue to next strategy
    }

    // 2. Look for Beeper.desktop file and extract the executable from that
    const desktopDirs = [
      join(homedir(), '.local', 'share', 'applications'),
      '/usr/share/applications',
    ];

    for (const dir of desktopDirs) {
      try {
        const desktopFilePath = join(dir, 'Beeper.desktop');
        if (await pathExists(desktopFilePath)) {
          const content = await readFile(desktopFilePath, 'utf8');
          const execLine = content
            .split('\n')
            .find(line => line.startsWith('Exec='));

          if (execLine) {
            const exec = execLine.slice(5).trim();
            const match = exec.match(/^"([^"]+)"|^([^\s]+)/);
            const executable = match?.[1] ?? match?.[2];

            if (executable && await pathExists(executable)) {
              return executable;
            }
          }
        }
      } catch {
        // Ignore unreadable files, continue to next strategy
      }
    }

    // 3. Search PATH environment variable for AppImage
    const pathEnv = process.env.PATH || '';
    for (const dir of pathEnv.split(':')) {
      if (dir) {
        try {
          const files = await readdir(dir);
          for (const file of files) {
            if (file.match(/^Beeper-.*\.AppImage$/i)) {
              const filePath = join(dir, file);
              if (await pathExists(filePath)) {
                return filePath;
              }
            }
          }
        } catch {
          // Directory doesn't exist or cannot be read, continue to next
        }
      }
    }
  }

  return undefined
}

async function isBeeperDesktopApp(path: string): Promise<boolean> {
  if (!await pathExists(path)) return false
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

export async function profileStatus(target: Target): Promise<Record<string, unknown>> {
  assertProfile(target)
  const run = await readRun(target.id)
  const reachable = await fetch(new URL('/v1/info', target.baseURL), { signal: AbortSignal.timeout(1000) })
    .then(response => response.ok)
    .catch(() => false)
  return {
    id: target.id,
    type: target.type,
    url: target.baseURL,
    running: reachable || !!run && isRunning(run.pid),
    pid: run?.pid,
    startedAt: run?.startedAt,
    log: run?.log,
    errorLog: run?.errorLog,
  }
}

export async function enableProfile(target: Target): Promise<string> {
  assertProfile(target)
  if (target.type !== 'server') throw new Error('Manage Desktop start at launch in Beeper Desktop.')
  if (process.platform === 'darwin') return enableLaunchAgent(target)
  if (process.platform === 'linux') return enableSystemdUnit(target)
  throw new Error('Beeper Server is not available on Windows.')
}

export async function disableProfile(target: Target): Promise<string> {
  assertProfile(target)
  if (target.type !== 'server') throw new Error('Manage Desktop start at launch in Beeper Desktop.')
  if (process.platform === 'darwin') {
    const path = join(process.env.HOME ?? beeperDir(), 'Library', 'LaunchAgents', launchAgentName(target))
    await execFileAsync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 501}`, path]).catch(() => undefined)
    await execFileAsync('launchctl', ['disable', `gui/${process.getuid?.() ?? 501}/${launchAgentLabel(target)}`]).catch(() => undefined)
    await rm(path, { force: true })
    return path
  }
  if (process.platform === 'linux') {
    const path = join(process.env.HOME ?? beeperDir(), '.config', 'systemd', 'user', systemdUnitName(target))
    await execFileAsync('systemctl', ['--user', 'disable', '--now', systemdUnitName(target)]).catch(() => undefined)
    await execFileAsync('systemctl', ['--user', 'daemon-reload']).catch(() => undefined)
    await rm(path, { force: true })
    return path
  }
  throw new Error('Beeper Server is not available on Windows.')
}

export async function readRun(id: string): Promise<ProfileRun | undefined> {
  try {
    return JSON.parse(await readFile(profileRunPath(id), 'utf8')) as ProfileRun
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function startDesktopProfile(target: Target): Promise<{ id: string; startedAt: string }> {
  return launchDesktopApp(target)
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

async function writeLaunchAgent(target: Target): Promise<string> {
  const installations = await readInstallations()
  const binary = process.env.BEEPER_SERVER_BIN || installations.server?.path
  if (!binary) throw new Error('Beeper Server is not installed. Run: beeper install server')
  const dir = join(process.env.HOME ?? beeperDir(), 'Library', 'LaunchAgents')
  await mkdir(dir, { recursive: true })
  const path = join(dir, launchAgentName(target))
  await writeFile(path, launchAgentPlist(target, binary), 'utf8')
  return path
}

async function enableLaunchAgent(target: Target): Promise<string> {
  const path = await writeLaunchAgent(target)
  await mkdir(profileLogDir(), { recursive: true })
  const service = `gui/${process.getuid?.() ?? 501}`
  await execFileAsync('launchctl', ['bootout', service, path]).catch(() => undefined)
  await execFileAsync('launchctl', ['bootstrap', service, path])
  await execFileAsync('launchctl', ['enable', `${service}/${launchAgentLabel(target)}`])
  await execFileAsync('launchctl', ['kickstart', '-k', `${service}/${launchAgentLabel(target)}`]).catch(() => undefined)
  return path
}

async function enableSystemdUnit(target: Target): Promise<string> {
  const path = await writeSystemdUnit(target)
  await mkdir(profileLogDir(), { recursive: true })
  await execFileAsync('systemctl', ['--user', 'daemon-reload'])
  await execFileAsync('systemctl', ['--user', 'enable', '--now', systemdUnitName(target)])
  return path
}

async function writeSystemdUnit(target: Target): Promise<string> {
  const installations = await readInstallations()
  const binary = process.env.BEEPER_SERVER_BIN || installations.server?.path
  if (!binary) throw new Error('Beeper Server is not installed. Run: beeper install server')
  const dir = join(process.env.HOME ?? beeperDir(), '.config', 'systemd', 'user')
  await mkdir(dir, { recursive: true })
  const path = join(dir, systemdUnitName(target))
  await writeFile(path, systemdUnit(target, binary), 'utf8')
  return path
}

function launchAgentName(target: Target): string {
  return `${launchAgentLabel(target)}.plist`
}

function launchAgentLabel(target: Target): string {
  return `com.beeper.cli.profile.${target.id}`
}

function systemdUnitName(target: Target): string {
  return `beeper-profile-${target.id}.service`
}

function launchAgentPlist(target: Target, binary: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${escapeXML(launchAgentLabel(target))}</string>
<key>ProgramArguments</key><array>${[binary, ...serverArgs(target)].map(arg => `<string>${escapeXML(arg)}</string>`).join('')}</array>
<key>EnvironmentVariables</key><dict><key>BEEPER_SERVER_DATA_DIR</key><string>${escapeXML(target.dataDir!)}</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${escapeXML(profileLogPath(target.id))}</string>
<key>StandardErrorPath</key><string>${escapeXML(profileErrorLogPath(target.id))}</string>
</dict></plist>
`
}

function systemdUnit(target: Target, binary: string): string {
  return `[Unit]
Description=Beeper profile ${target.id}

[Service]
ExecStart=${[binary, ...serverArgs(target)].map(systemdQuote).join(' ')}
Restart=always
Environment=BEEPER_SERVER_DATA_DIR=${systemdQuote(target.dataDir!)}
StandardOutput=append:${profileLogPath(target.id)}
StandardError=append:${profileErrorLogPath(target.id)}

[Install]
WantedBy=default.target
`
}

function escapeXML(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function systemdQuote(value: string): string {
  return value.includes(' ') ? `"${value.replaceAll('"', '\\"')}"` : value
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

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

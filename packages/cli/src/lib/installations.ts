import { createWriteStream } from 'node:fs'
import { chmod, cp, mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { beeperDir, type ManagedTargetType } from './targets.js'
import { SERVER_ENV_API_BASE_URLS, normalizeServerEnv, type ServerEnv } from './server-env.js'

const execFileAsync = promisify(execFile)

type InstallChannel = 'stable' | 'nightly'
type Installation = {
  kind: ManagedTargetType
  channel: InstallChannel
  serverEnv: ServerEnv
  bundleID: string
  version?: string
  path: string
  feedURL: string
  downloadURL: string
  installedAt: string
  updatedAt: string
}

export type Installations = Partial<Record<ManagedTargetType, Installation>>

type UpdateInfo = {
  available: boolean
  latestVersion?: string
}

type FeedInfo = {
  version?: string
  url?: string
  raw: unknown
}

type InstallRequest = {
  kind: ManagedTargetType
  channel: InstallChannel
  serverEnv: ServerEnv
  platform: 'macos' | 'windows' | 'linux'
  feedPlatform: 'darwin' | 'win32' | 'linux'
  arch: 'x64' | 'arm64'
  bundleID: string
  apiBaseURL: string
}

const installationsPath = () => join(beeperDir(), 'installations.json')
const appsDir = () => join(beeperDir(), 'apps')
const binDir = () => join(beeperDir(), 'bin')
const desktopInstallDir = () => join(appsDir(), 'desktop')
const serverInstallRoot = () => join(appsDir(), 'server')
const serverBinPath = () => join(binDir(), 'beeper-server')

export async function readInstallations(): Promise<Installations> {
  try {
    return JSON.parse(await readFile(installationsPath(), 'utf8')) as Installations
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

async function writeInstallations(installations: Installations): Promise<void> {
  await mkdir(dirname(installationsPath()), { recursive: true })
  await writeFile(installationsPath(), `${JSON.stringify(installations, null, 2)}\n`, { mode: 0o600 })
}

async function saveInstallation(installation: Installation): Promise<Installation> {
  const current = await readInstallations()
  await writeInstallations({ ...current, [installation.kind]: installation })
  return installation
}

function normalizeInstallRequest(options: {
  kind: ManagedTargetType
  channel?: InstallChannel
  serverEnv?: string
  platform?: NodeJS.Platform
  arch?: string
}): InstallRequest {
  const serverEnv = normalizeServerEnv(options.serverEnv)
  const channel = options.channel ?? 'stable'
  const platform = normalizeDownloadPlatform(options.platform ?? process.platform)
  const feedPlatform = normalizeFeedPlatform(options.platform ?? process.platform)
  const arch = normalizeArch(options.arch ?? process.arch)
  const bundleID = bundleIDFor(options.kind, channel)
  return {
    kind: options.kind,
    channel,
    serverEnv,
    platform,
    feedPlatform,
    arch,
    bundleID,
    apiBaseURL: SERVER_ENV_API_BASE_URLS[serverEnv],
  }
}

function feedURLFor(options: InstallRequest): string {
  const url = new URL('/desktop/update-feed.json', options.apiBaseURL)
  url.searchParams.set('bundleID', options.bundleID)
  url.searchParams.set('platform', options.feedPlatform)
  url.searchParams.set('channel', options.channel)
  url.searchParams.set('arch', options.arch)
  return url.toString()
}

function downloadURLFor(options: InstallRequest): string {
  return `${options.apiBaseURL}/desktop/download/${options.platform}/${options.arch}/${options.channel}/${options.bundleID}`
}

async function fetchFeed(feedURL: string): Promise<FeedInfo> {
  const response = await fetch(feedURL, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Update feed returned ${response.status} ${response.statusText}`)
  const raw = await response.json() as unknown
  return {
    raw,
    version: stringField(raw, ['version', 'name']),
    url: stringField(raw, ['url', 'downloadURL', 'downloadUrl']),
  }
}

export async function checkInstallationUpdate(installation: Installation): Promise<UpdateInfo> {
  const feed = await fetchFeed(installation.feedURL)
  const latestVersion = feed.version
  return {
    available: !!latestVersion && latestVersion !== installation.version,
    latestVersion,
  }
}

export async function installDesktop(options: { channel?: InstallChannel; serverEnv?: string } = {}): Promise<Installation> {
  const request = normalizeInstallRequest({ kind: 'desktop', channel: options.channel, serverEnv: options.serverEnv })
  const feedRequest = request.serverEnv === 'prod'
    ? request
    : { ...request, serverEnv: 'prod' as const, apiBaseURL: SERVER_ENV_API_BASE_URLS.prod }
  if (request.serverEnv !== feedRequest.serverEnv) {
    process.stderr.write(`Desktop ${request.serverEnv} installs use the production update feed; the app will still launch against ${request.serverEnv}.\n`)
  }
  const feedURL = feedURLFor(feedRequest)
  const feed = await fetchFeed(feedURL)
  const downloadURL = feed.url
  if (!downloadURL) throw new Error('Desktop update feed did not include a download URL.')
  const stageDir = join(appsDir(), `desktop-${request.channel}-${Date.now()}`)
  await mkdir(stageDir, { recursive: true })
  const artifactPath = await downloadArtifact(downloadURL, stageDir)
  await rm(desktopInstallDir(), { recursive: true, force: true })
  await mkdir(desktopInstallDir(), { recursive: true })
  const appPath = await extractDesktopArtifact(artifactPath, desktopInstallDir())
  await rm(stageDir, { recursive: true, force: true })
  const now = new Date().toISOString()
  return saveInstallation({
    kind: 'desktop',
    channel: request.channel,
    serverEnv: request.serverEnv,
    bundleID: request.bundleID,
    version: feed.version,
    path: appPath,
    feedURL,
    downloadURL,
    installedAt: now,
    updatedAt: now,
  })
}

export async function installServer(options: { channel?: InstallChannel; serverEnv?: string } = {}): Promise<Installation> {
  if (process.platform === 'win32') throw new Error('Beeper Server install is not available on Windows.')
  const request = normalizeInstallRequest({ kind: 'server', channel: options.channel, serverEnv: options.serverEnv })
  const feedURL = feedURLFor(request)
  const downloadURL = downloadURLFor(request)
  const feed = await fetchFeed(feedURL).catch(() => ({ raw: undefined, version: undefined }))
  const version = feed.version ?? 'unknown'
  const stageDir = join(serverInstallRoot(), `${request.channel}-${version}-${Date.now()}`)
  await mkdir(stageDir, { recursive: true })
  const artifactPath = await downloadArtifact(downloadURL, stageDir)
  const executable = await extractServerArtifact(artifactPath, stageDir)
  await mkdir(binDir(), { recursive: true })
  await rm(serverBinPath(), { force: true })
  await symlink(executable, serverBinPath())
  const now = new Date().toISOString()
  return saveInstallation({
    kind: 'server',
    channel: request.channel,
    serverEnv: request.serverEnv,
    bundleID: request.bundleID,
    version: feed.version,
    path: serverBinPath(),
    feedURL,
    downloadURL,
    installedAt: now,
    updatedAt: now,
  })
}

async function downloadArtifact(url: string, destinationDir: string): Promise<string> {
  await mkdir(destinationDir, { recursive: true })
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  if (!response.ok || !response.body) throw new Error(`Download returned ${response.status} ${response.statusText}`)
  const filename = filenameFromResponse(response) ?? (basename(new URL(response.url).pathname) || `beeper-download-${Date.now()}`)
  const finalPath = join(destinationDir, filename)
  const tmpPath = join(tmpdir(), `${filename}.${process.pid}.${Date.now()}.tmp`)
  await writeResponseToFile(response, tmpPath)
  await rename(tmpPath, finalPath)
  return finalPath
}

async function extractServerArtifact(artifactPath: string, destinationDir: string): Promise<string> {
  const extractDir = join(destinationDir, 'extract')
  await rm(extractDir, { recursive: true, force: true })
  await mkdir(extractDir, { recursive: true })

  if (artifactPath.endsWith('.tar.gz') || artifactPath.endsWith('.tgz')) {
    await execFileAsync('tar', ['-xzf', artifactPath, '-C', extractDir])
  } else if (artifactPath.endsWith('.zip')) {
    if (process.platform === 'darwin') await execFileAsync('/usr/bin/ditto', ['-x', '-k', artifactPath, extractDir])
    else await execFileAsync('unzip', ['-q', artifactPath, '-d', extractDir])
  } else {
    const executable = join(destinationDir, 'beeper-server')
    await rename(artifactPath, executable)
    await chmod(executable, 0o755)
    return executable
  }

  const executable = await findServerExecutable(extractDir)
  const finalPath = join(destinationDir, 'beeper-server')
  await rename(executable, finalPath)
  await chmod(finalPath, 0o755)
  return finalPath
}

async function extractDesktopArtifact(artifactPath: string, destinationDir: string): Promise<string> {
  if (artifactPath.endsWith('.dmg')) {
    if (process.platform !== 'darwin') return artifactPath
    const mountPoint = await attachDMG(artifactPath)
    try {
      const app = await findAppBundle(mountPoint)
      const finalPath = join(destinationDir, basename(app))
      await copyPath(app, finalPath)
      return finalPath
    } finally {
      await execFileAsync('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet']).catch(() => undefined)
    }
  }

  if (artifactPath.endsWith('.zip')) {
    const extractDir = join(destinationDir, 'extract')
    await rm(extractDir, { recursive: true, force: true })
    await mkdir(extractDir, { recursive: true })
    if (process.platform === 'darwin') await execFileAsync('/usr/bin/ditto', ['-x', '-k', artifactPath, extractDir])
    else await execFileAsync('unzip', ['-q', artifactPath, '-d', extractDir])
    const app = await findAppBundle(extractDir)
    const finalPath = join(destinationDir, basename(app))
    await copyPath(app, finalPath)
    await rm(extractDir, { recursive: true, force: true })
    return finalPath
  }

  return artifactPath
}

async function attachDMG(artifactPath: string): Promise<string> {
  const { stdout } = await execFileAsync('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', artifactPath])
  const mountPoint = stdout
    .split('\n')
    .map(line => line.match(/(\/Volumes\/.+)$/)?.[1])
    .find(Boolean)
  if (!mountPoint) throw new Error(`Could not find mounted volume for ${artifactPath}`)
  return mountPoint
}

async function copyPath(source: string, destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true })
  if (process.platform === 'darwin') {
    await execFileAsync('/usr/bin/ditto', [source, destination])
    return
  }
  await cp(source, destination, { recursive: true })
}

async function findAppBundle(dir: string): Promise<string> {
  const entries = await readdir(dir)
  for (const entry of entries) {
    const path = join(dir, entry)
    const info = await stat(path)
    if (info.isDirectory() && entry.endsWith('.app')) return path
    if (info.isDirectory()) {
      const found = await findAppBundle(path).catch(() => undefined)
      if (found) return found
    }
  }
  throw new Error('Downloaded Beeper Desktop artifact did not contain an app bundle.')
}

async function findServerExecutable(dir: string): Promise<string> {
  const entries = await readdir(dir)
  for (const entry of entries) {
    const path = join(dir, entry)
    const info = await stat(path)
    if (info.isDirectory()) {
      const found = await findServerExecutable(path).catch(() => undefined)
      if (found) return found
    } else if (entry === 'beeper-server' || entry === 'beeper-server.exe') {
      return path
    }
  }
  throw new Error('Downloaded Beeper Server artifact did not contain a beeper-server executable.')
}

function normalizeDownloadPlatform(platform: NodeJS.Platform): 'macos' | 'windows' | 'linux' {
  if (platform === 'darwin') return 'macos'
  if (platform === 'win32') return 'windows'
  if (platform === 'linux') return 'linux'
  throw new Error(`Unsupported platform "${platform}".`)
}

function normalizeFeedPlatform(platform: NodeJS.Platform): 'darwin' | 'win32' | 'linux' {
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') return platform
  throw new Error(`Unsupported platform "${platform}".`)
}

function normalizeArch(arch: string): 'x64' | 'arm64' {
  if (arch === 'x64' || arch === 'arm64') return arch
  throw new Error(`Unsupported architecture "${arch}".`)
}

function bundleIDFor(kind: ManagedTargetType, channel: InstallChannel): string {
  const base = kind === 'desktop' ? 'com.automattic.beeper.desktop' : 'com.automattic.beeper.server'
  return channel === 'nightly' ? `${base}.nightly` : base
}

function stringField(value: unknown, fields: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const field of fields) {
    const candidate = record[field]
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

async function writeResponseToFile(response: Response, path: string): Promise<void> {
  if (!response.body) throw new Error('Download response did not include a body.')

  await pipeline(Readable.fromWeb(response.body as unknown as ReadableStream), createWriteStream(path))
}

function filenameFromResponse(response: Response): string | undefined {
  const contentDisposition = response.headers.get('content-disposition')
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i)
  if (match?.[1]) return match[1]
  const pathname = new URL(response.url).pathname
  const name = basename(pathname)
  if (name && extname(name)) return name
  return undefined
}

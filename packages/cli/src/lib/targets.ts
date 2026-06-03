import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { AbortError, ExitCodes } from './errors.js'
import { normalizeServerEnv } from './server-env.js'

export type AuthSource = 'desktop-db' | 'desktop-oauth' | 'email' | 'remote-oauth'

export type StoredAuth = {
  accessToken: string
  clientID?: string
  expiresAt?: string
  scope?: string
  source?: AuthSource
  tokenType: 'Bearer'
}

export type ManagedTargetType = 'desktop' | 'server'

export type Target = {
  id: string
  type: ManagedTargetType | 'remote'
  name?: string
  baseURL: string
  auth?: StoredAuth
  dataDir?: string
  profile?: string
  serverEnv?: string
  port?: number
}

export type PublicTarget = Omit<Target, 'auth'> & { auth?: Pick<StoredAuth, 'source' | 'tokenType'> }

export type Config = {
  defaultTarget?: string
  defaultAccount?: string
}

export const defaultDesktopPort = 23_373
export const defaultDesktopBaseURL = `http://127.0.0.1:${defaultDesktopPort}`
export const builtInDesktopTargetID = 'desktop'
const customTargetID = 'custom'

export function beeperDir(): string {
  return process.env.BEEPER_CLI_CONFIG_DIR ?? join(homedir(), '.beeper')
}

export const configPath = () => join(beeperDir(), 'config.json')
const targetsDir = () => join(beeperDir(), 'targets')
const profileDataDir = (type: ManagedTargetType, id: string) => join(beeperDir(), 'profiles', type, id)

export async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8')) as Config
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

async function writeConfig(config: Config): Promise<void> {
  await mkdir(dirname(configPath()), { recursive: true })
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

export async function updateConfig(update: (config: Config) => Config | Promise<Config>): Promise<Config> {
  const next = await update(await readConfig())
  await writeConfig(next)
  return next
}

export async function listTargets(): Promise<Target[]> {
  const files = await readdir(targetsDir()).catch(() => [])
  const targets = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
    try {
      return JSON.parse(await readFile(join(targetsDir(), file), 'utf8')) as Target
    } catch {
      return undefined
    }
  }))
  return targets.filter((target): target is Target => !!target).map(normalizeLocalTarget).sort((a, b) => a.id.localeCompare(b.id))
}

export async function readTarget(id: string): Promise<Target | undefined> {
  try {
    return normalizeLocalTarget(JSON.parse(await readFile(targetPath(id), 'utf8')) as Target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export async function writeTarget(target: Target): Promise<void> {
  await mkdir(targetsDir(), { recursive: true })
  await writeFile(targetPath(target.id), `${JSON.stringify(target, null, 2)}\n`, { mode: 0o600 })
}

export async function removeTarget(id: string): Promise<void> {
  await rm(targetPath(id), { force: true })
  await updateConfig(config => {
    return config.defaultTarget === id ? { ...config, defaultTarget: undefined } : config
  })
}

export async function resolveTarget(options: { target?: string; baseURL?: string } = {}): Promise<Target> {
  if (options.baseURL) return { id: customTargetID, type: 'desktop', baseURL: options.baseURL }
  const config = await readConfig()
  const targetID = options.target ?? config.defaultTarget
  if (targetID) {
    const target = await readTarget(targetID)
    if (!target && targetID === builtInDesktopTargetID) return builtInDesktopTarget()
    if (!target) {
      throw new AbortError(`Unknown Beeper target "${targetID}". Run \`beeper targets list\`.`, ExitCodes.NotFound, undefined, 'not_found')
    }
    return target
  }
  const targets = await listTargets()
  if (targets.length === 1 && targets[0]) return targets[0]
  const desktopTarget = await readTarget(builtInDesktopTargetID)
  if (desktopTarget) return desktopTarget
  return builtInDesktopTarget()
}

export async function createDefaultDesktopTarget(baseURL = defaultDesktopBaseURL): Promise<Target> {
  const target = builtInDesktopTarget(baseURL)
  await writeTarget(target)
  await updateConfig(config => ({ ...config, defaultTarget: config.defaultTarget ?? target.id }))
  return target
}

function builtInDesktopTarget(baseURL = defaultDesktopBaseURL): Target {
  return {
    id: builtInDesktopTargetID,
    type: 'desktop',
    name: 'Beeper Desktop',
    baseURL,
  }
}

function normalizeLocalTarget(target: Target): Target {
  if (!target.dataDir || target.type === 'remote') return target
  return target.port ? { ...target, baseURL: `http://127.0.0.1:${target.port}` } : target
}

export async function createProfileTarget(type: ManagedTargetType, id: string, options: { serverEnv?: string; port?: number } = {}): Promise<Target> {
  const serverEnv = normalizeServerEnv(options.serverEnv)
  const port = options.port ?? await nextPort()
  const dataDir = profileDataDir(type, id)
  const target: Target = {
    id,
    type,
    name: id,
    baseURL: `http://127.0.0.1:${port}`,
    dataDir,
    profile: id,
    serverEnv,
    port,
  }
  await mkdir(dataDir, { recursive: true })
  await writeTarget(target)
  return target
}

export function publicTarget(target: Target): PublicTarget {
  const { auth, ...rest } = target
  return { ...rest, auth: auth ? { source: auth.source, tokenType: auth.tokenType } : undefined }
}

function targetPath(id: string): string {
  return join(targetsDir(), `${id}.json`)
}

async function nextPort(): Promise<number> {
  const used = new Set((await listTargets()).map(target => target.port).filter((port): port is number => typeof port === 'number'))
  for (let port = defaultDesktopPort + 1; port < defaultDesktopPort + 200; port++) {
    if (!used.has(port)) return port
  }
  throw new Error('No available default port for a new Beeper target.')
}

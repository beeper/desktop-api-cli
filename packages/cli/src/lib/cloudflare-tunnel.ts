import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, chmod, mkdir, rename, rm } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { fileURLToPath } from 'node:url'

const currentCloudflaredVersion = '2024.8.2'

const downloadBaseURL = `https://github.com/cloudflare/cloudflared/releases/download/${currentCloudflaredVersion}/`
const downloads: Record<string, Record<string, string>> = {
  darwin: { arm64: 'cloudflared-darwin-arm64.tgz', x64: 'cloudflared-darwin-amd64.tgz' },
  linux: { arm: 'cloudflared-linux-arm', arm64: 'cloudflared-linux-arm64', ia32: 'cloudflared-linux-386', x64: 'cloudflared-linux-amd64' },
  win32: { arm64: 'cloudflared-windows-amd64.exe', ia32: 'cloudflared-windows-386.exe', x64: 'cloudflared-windows-amd64.exe' },
}

type StartTunnelOptions = {
  cloudflaredPath?: string
  debug?: boolean
  install?: boolean
  retries?: number
  timeoutMs?: number
  url: string
}

export type StartedTunnel = {
  cloudflaredPath: string
  done: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  process: ChildProcess
  stop: () => void
  tryMessage: string
  url: string
}

function cloudflaredPath(explicit?: string): string {
  return explicit ?? process.env.BEEPER_CLOUDFLARED_PATH ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared')
}

export async function startCloudflareTunnel(options: StartTunnelOptions): Promise<StartedTunnel> {
  const bin = await ensureCloudflared(options)
  const retries = options.retries ?? 5
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await runCloudflared(bin, options)
    } catch (error) {
      lastError = error as Error
      if (attempt >= retries) break
      if (options.debug) process.stderr.write(`cloudflared crashed before connecting; retrying (${attempt + 1}/${retries})\n`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw new Error(`Could not start Cloudflare Tunnel: max retries reached.${lastError ? `\n${lastError.message}` : ''}\n${whatToTry()}`)
}

async function ensureCloudflared(options: { cloudflaredPath?: string; debug?: boolean; install?: boolean }): Promise<string> {
  const target = cloudflaredPath(options.cloudflaredPath)
  if (truthy(process.env.BEEPER_IGNORE_CLOUDFLARED)) return target
  if (await isUsableCloudflared(target)) return target
  if (!options.install) throw new Error(`cloudflared not found at ${target}. Install it or rerun with --install.\n${whatToTry()}`)
  await installCloudflared(target)
  return target
}

async function installCloudflared(target: string): Promise<void> {
  const url = downloadURL()
  await mkdir(dirname(target), { recursive: true })
  const temporary = url.endsWith('.tgz') ? `${target}.tgz` : `${target}.download`
  await downloadFile(url, temporary)

  if (url.endsWith('.tgz')) {
    execFileSync('tar', ['-xzf', basename(temporary)], { cwd: dirname(target), stdio: 'ignore' })
    await rm(temporary, { force: true })
    await rename(join(dirname(target), 'cloudflared'), target)
  } else {
    await rename(temporary, target)
  }

  if (platform() !== 'win32') await chmod(target, 0o755)
}

async function runCloudflared(bin: string, options: StartTunnelOptions): Promise<StartedTunnel> {
  const child = spawn(bin, ['tunnel', '--url', options.url, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'] })
  const errors: string[] = []
  let connected = false
  let publicURL: string | undefined
  let resolved = false
  let stopped = false
  let exitResolve!: (value: { code: number | null; signal: NodeJS.Signals | null }) => void
  const done = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    exitResolve = resolve
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${lastTunnelError(errors) ?? 'Could not start Cloudflare Tunnel: timed out waiting for a public URL.'}\n${whatToTry()}`))
    }, options.timeoutMs ?? 40_000)

    const cleanup = () => clearTimeout(timeout)
    const onData = (data: Buffer) => {
      const chunk = data.toString()
      if (options.debug) process.stderr.write(chunk)
      publicURL ??= findTunnelURL(chunk)
      connected ||= /(INF Registered tunnel connection|INF Connection)/.test(chunk)
      const error = findKnownError(chunk)
      if (error) errors.push(error)

      if (connected && publicURL) {
        resolved = true
        cleanup()
        resolve({
          cloudflaredPath: bin,
          done,
          process: child,
          stop() {
            stopped = true
            child.kill('SIGTERM')
          },
          tryMessage: whatToTry(),
          url: publicURL,
        })
      }
    }

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', error => {
      cleanup()
      reject(error)
    })
    child.once('exit', (code, signal) => {
      exitResolve({ code, signal })
      if (resolved || stopped) return
      cleanup()
      reject(new Error(`${lastTunnelError(errors) ?? `cloudflared exited before connecting${code === null ? '' : ` with code ${code}`}.`}\n${whatToTry()}`))
    })
  })
}

async function isUsableCloudflared(path: string): Promise<boolean> {
  try {
    await access(path)
    const version = execFileSync(path, ['--version'], { encoding: 'utf8' }).split(' ')[2] ?? '0.0.0'
    return !versionIsGreaterThan(currentCloudflaredVersion, version)
  } catch {
    return false
  }
}

function downloadURL(system = platform(), cpu = arch()): string {
  const file = downloads[system]?.[cpu]
  if (!file) throw new Error(`Unsupported system platform or architecture: ${system}/${cpu}`)
  return downloadBaseURL + file
}

async function downloadFile(url: string, to: string): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`)
  await pipeline(Readable.fromWeb(response.body as unknown as ReadableStream), createWriteStream(to))
}

export function findTunnelURL(data: string, domain = cloudflaredDomain()): string | undefined {
  return data.match(new RegExp(`https:\\/\\/[^\\s]+\\.${escapeRegExp(domain)}`))?.[0]
}

export function findKnownError(data: string): string | undefined {
  const knownErrors = [
    /failed to request quick Tunnel/i,
    /failed to unmarshal quick Tunnel/i,
    /failed to parse quick Tunnel ID/i,
    /failed to provision routing/i,
    /ERR Couldn't start tunnel/i,
    /ERR Failed to serve quic connection/i,
    /ERR Failed to create new quic connection error/i,
  ]
  if (!knownErrors.some(error => error.test(data))) return undefined
  return `Could not start Cloudflare Tunnel: ${data.replace(/^[0-9TZ:-]+ (ERR )?/g, '').replace(/connIndex.*/g, '').trim()}`
}

export function cloudflaredDomain(): string {
  return process.env.BEEPER_CLOUDFLARED_DOMAIN ?? 'trycloudflare.com'
}

export function whatToTry(): string {
  return [
    'Try running the command again.',
    'If cloudflared is already installed, set BEEPER_CLOUDFLARED_PATH or pass --cloudflared-path.',
    'If the bundled binary is missing, rerun with --install.',
    'For a stable hostname, configure a named Cloudflare Tunnel and route the Beeper target outside this quick-tunnel command.',
  ].join(' ')
}

export function versionIsGreaterThan(versionA: string, versionB: string): boolean {
  const [majorA = 0, minorA = 0, patchA = 0] = versionA.split('.').map(Number)
  const [majorB = 0, minorB = 0, patchB = 0] = versionB.split('.').map(Number)
  if (majorA !== majorB) return majorA > majorB
  if (minorA !== minorB) return minorA > minorB
  return patchA > patchB
}

function lastTunnelError(errors: string[]): string | undefined {
  return [...new Set(errors)].slice(-5).join('\n') || undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, match => `\\${match}`)
}

function truthy(value: string | undefined): boolean {
  return ['1', 'on', 'true', 'yes'].includes(String(value ?? '').toLowerCase())
}

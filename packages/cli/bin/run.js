#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rm } from 'node:fs/promises'
import { move } from 'fs-extra'
import { get } from 'node:https'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
const version = pkg.version
const platform = normalizePlatform(process.platform)
const arch = normalizeArch(process.arch)
const releaseTag = process.env.BEEPER_CLI_RELEASE_TAG || `v${version}`
const releaseRepository = process.env.GITHUB_REPOSITORY || 'beeper/cli'
const releaseBaseURL = (process.env.BEEPER_CLI_RELEASE_BASE_URL || `https://github.com/${releaseRepository}/releases/download/${releaseTag}`).replace(/\/$/, '')
const cacheRoot = process.env.BEEPER_CLI_BINARY_CACHE_DIR || join(homedir(), '.cache', 'beeper-cli')
const cacheDir = join(cacheRoot, version, `${platform}-${arch}`)
const cachedExecutable = join(cacheDir, platform === 'windows' ? 'beeper.exe' : 'beeper')

try {
  const executable = await ensureExecutable()
  const child = spawn(executable, process.argv.slice(2), {
    env: process.env,
    stdio: 'inherit',
  })
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
  child.once('error', error => {
    console.error(`beeper-cli: failed to start downloaded binary: ${error.message}`)
    process.exit(1)
  })
} catch (error) {
  console.error(`beeper-cli: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

async function ensureExecutable() {
  if (existsSync(cachedExecutable)) return cachedExecutable

  const artifact = await fetchArtifact()
  const tmpDir = join(tmpdir(), `beeper-cli-${version}-${process.pid}-${Date.now()}`)
  const tmpPath = join(tmpDir, artifact.file)
  const url = `${releaseBaseURL}/${artifact.file}`
  console.error(`beeper-cli: downloading ${url}`)
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
  await download(url, tmpPath)

  const actualHash = await sha256(tmpPath)
  if (actualHash !== artifact.sha256) {
    await rm(tmpDir, { recursive: true, force: true })
    throw new Error(`downloaded archive checksum mismatch for ${artifact.file}`)
  }

  await extract(tmpPath, tmpDir)
  const extractedExecutable = join(tmpDir, 'bin', platform === 'windows' ? 'beeper.exe' : 'beeper')
  if (platform !== 'windows') await chmod(extractedExecutable, 0o755)
  await rm(cacheDir, { recursive: true, force: true })
  await mkdir(cacheDir, { recursive: true })
  await move(extractedExecutable, cachedExecutable)
  await rm(tmpDir, { recursive: true, force: true })
  return cachedExecutable
}

function normalizePlatform(value) {
  if (value === 'darwin') return 'darwin'
  if (value === 'linux') return 'linux'
  if (value === 'win32') return 'windows'
  throw new Error(`unsupported platform: ${value}`)
}

function normalizeArch(value) {
  if (value === 'x64') return 'x64'
  if (value === 'arm64') return 'arm64'
  throw new Error(`unsupported architecture: ${value}`)
}

async function fetchArtifact() {
  const manifestURL = `${releaseBaseURL}/binaries.json`
  const manifestPath = join(tmpdir(), `beeper-cli-binaries-${version}-${process.pid}-${Date.now()}.json`)
  try {
    await download(manifestURL, manifestPath, { quiet: true })
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const artifact = manifest.artifacts?.find(artifact => artifact.platform === `${platform}-${arch}`)
    if (!artifact) throw new Error(`no release archive found for ${platform}-${arch}`)
    return artifact
  } finally {
    await rm(manifestPath, { force: true })
  }
}

async function download(url, destination, options = {}, redirectCount = 0) {
  if (redirectCount > 10) throw new Error(`too many redirects while downloading ${basename(url)}`)
  await mkdir(dirname(destination), { recursive: true })
  await new Promise((resolve, reject) => {
    const request = get(url, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(new URL(response.headers.location, url).toString(), destination, options, redirectCount + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`download failed for ${basename(url)}: HTTP ${response.statusCode}`))
        return
      }
      pipeline(response, createWriteStream(destination)).then(resolve, reject)
    })
    request.once('error', reject)
    request.setTimeout(120_000, () => request.destroy(new Error(`download timed out: ${url}`)))
  })
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function extract(archivePath, destination) {
  if (archivePath.endsWith('.zip')) {
    await run('/usr/bin/ditto', ['-x', '-k', archivePath, destination])
    return
  }
  if (archivePath.endsWith('.tar.gz')) {
    await run('tar', ['-xzf', archivePath, '-C', destination])
    return
  }
  throw new Error(`unsupported release archive: ${basename(archivePath)}`)
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

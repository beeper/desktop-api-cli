import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { launchDesktopApp } from '../src/lib/profiles.js'
import { type Target } from '../src/lib/targets.js'

let root: string
let oldConfigDir: string | undefined
let oldCapture: string | undefined
let oldPath: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beeper-headless-launch-'))
  oldConfigDir = process.env.BEEPER_CLI_CONFIG_DIR
  oldCapture = process.env.BEEPER_LAUNCH_CAPTURE
  oldPath = process.env.PATH
  process.env.BEEPER_CLI_CONFIG_DIR = join(root, 'config')
  process.env.BEEPER_LAUNCH_CAPTURE = join(root, 'launch.txt')

  const binDir = join(root, 'bin')
  mkdirSync(binDir, { recursive: true })
  const captureScript = '#!/bin/sh\nprintf "%s\\n" "$@" > "$BEEPER_LAUNCH_CAPTURE"\n'
  for (const name of ['open', 'beeper-desktop']) {
    const path = join(binDir, name)
    writeFileSync(path, captureScript)
    chmodSync(path, 0o755)
  }
  process.env.PATH = `${binDir}:${oldPath}`

  mkdirSync(process.env.BEEPER_CLI_CONFIG_DIR, { recursive: true })
  writeFileSync(
    join(process.env.BEEPER_CLI_CONFIG_DIR, 'installations.json'),
    JSON.stringify({
      desktop: { path: join(binDir, 'beeper-desktop') },
    }),
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  restoreEnv('BEEPER_CLI_CONFIG_DIR', oldConfigDir)
  restoreEnv('BEEPER_LAUNCH_CAPTURE', oldCapture)
  restoreEnv('PATH', oldPath)
})

describe('headless Desktop launch', () => {
  it('seeds a missing startupThreadIDs value before launch', async () => {
    const target = headlessTarget()
    mkdirSync(target.dataDir!, { recursive: true })
    withDatabase(target, (db) => db.run('CREATE TABLE key_values (key TEXT PRIMARY KEY, value TEXT NOT NULL)'))

    await launchDesktopApp(target)

    const value = readStartupThreadIDs(target)
    expect(value).toBe('[]')
  })

  it('repairs a non-array startupThreadIDs value before launch', async () => {
    const target = headlessTarget()
    mkdirSync(target.dataDir!, { recursive: true })
    withDatabase(target, (db) => {
      db.run('CREATE TABLE key_values (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
      db.run("INSERT INTO key_values VALUES ('startupThreadIDs', 'null')")
    })

    await launchDesktopApp(target)

    const value = readStartupThreadIDs(target)
    expect(value).toBe('[]')
  })

  it('preserves an existing startupThreadIDs array', async () => {
    const target = headlessTarget()
    mkdirSync(target.dataDir!, { recursive: true })
    withDatabase(target, (db) => {
      db.run('CREATE TABLE key_values (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
      db.run(`INSERT INTO key_values VALUES ('startupThreadIDs', '["thread-1"]')`)
    })

    await launchDesktopApp(target)

    const value = readStartupThreadIDs(target)
    expect(value).toBe('["thread-1"]')
  })

  it('repairs and restarts once when the first launch creates a fresh database', async () => {
    const target = headlessTarget()
    const appPath = join(root, 'bin', 'fresh-headless-desktop')
    writeFileSync(appPath, `#!/usr/bin/env bun
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'

mkdirSync(process.env.BEEPER_USER_DATA_DIR, { recursive: true })
const db = new Database(join(process.env.BEEPER_USER_DATA_DIR, 'index.db'))
db.run('CREATE TABLE IF NOT EXISTS key_values (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
const row = db.query("SELECT value FROM key_values WHERE key = 'startupThreadIDs'").get()
appendFileSync(process.env.BEEPER_LAUNCH_CAPTURE, (row?.value ?? 'missing') + '\\n')
db.close()
if (!row?.value) await Bun.sleep(30_000)
`)
    chmodSync(appPath, 0o755)
    writeFileSync(join(process.env.BEEPER_CLI_CONFIG_DIR!, 'installations.json'), JSON.stringify({ desktop: { path: appPath } }))

    await launchDesktopApp(target)

    expect(await waitForCapture(process.env.BEEPER_LAUNCH_CAPTURE!, 2)).toEqual(['missing', '[]'])
    expect(readStartupThreadIDs(target)).toBe('[]')
  })

  it('uses SwiftShader flags instead of disabling GPU access', async () => {
    const target = headlessTarget()
    mkdirSync(target.dataDir!, { recursive: true })
    withDatabase(target, db => {
      db.run('CREATE TABLE key_values (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
      db.run("INSERT INTO key_values VALUES ('startupThreadIDs', '[]')")
    })

    await launchDesktopApp(target)
    const args = await waitForCapture(process.env.BEEPER_LAUNCH_CAPTURE!)

    expect(args).toContain('--use-gl=angle')
    expect(args).toContain('--use-angle=swiftshader')
    expect(args).toContain('--enable-unsafe-swiftshader')
    expect(args).not.toContain('--disable-gpu')
    expect(args).not.toContain('--disable-software-rasterizer')
  })
})

function headlessTarget(): Target & { headless: true } {
  return {
    id: 'headless',
    type: 'desktop',
    baseURL: 'http://127.0.0.1:23374',
    managed: true,
    dataDir: join(root, 'profile'),
    profile: 'headless',
    port: 23_374,
    serverEnv: 'production',
    headless: true,
  }
}

function withDatabase(target: Target, callback: (db: Database) => void): void {
  const db = new Database(join(target.dataDir!, 'index.db'))
  try {
    callback(db)
  } finally {
    db.close()
  }
}

function readStartupThreadIDs(target: Target): string {
  let value = ''
  withDatabase(target, (db) => {
    value = (db.query("SELECT value FROM key_values WHERE key = 'startupThreadIDs'").get() as { value: string }).value
  })
  return value
}

async function waitForCapture(path: string, minimumLines = 1): Promise<string[]> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const lines = readFileSync(path, 'utf8').trim().split('\n')
      if (lines.length >= minimumLines) return lines
    } catch {
      // The detached process has not created its capture file yet.
    }
    await Bun.sleep(10)
  }
  throw new Error('Desktop launch was not captured')
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { startProfile, stopProfile } from '../src/lib/profiles.js'

let root = ''
let dataDir = ''
let serverBin = ''
let target: {
  id: string
  type: 'server'
  baseURL: string
  managed: true
  dataDir: string
  port: number
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'beeper-cli-server-bootstrap-'))
  dataDir = join(root, 'data')
  mkdirSync(dataDir)
  serverBin = join(root, 'fake-server.mjs')
  writeFileSync(serverBin, `#!${process.execPath}
import { appendFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'

const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice('--port='.length))
const dataDir = process.argv.find(arg => arg.startsWith('--data-dir='))?.slice('--data-dir='.length)
if (process.env.BEEPER_FAKE_SERVER_BOOTSTRAP === '1') {
  const countPath = process.env.BEEPER_FAKE_SERVER_COUNT
  if (dataDir) mkdirSync(dataDir, { recursive: true })
  const db = new Database(join(dataDir, 'index.db'))
  db.run('CREATE TABLE IF NOT EXISTS key_values (key TEXT PRIMARY KEY, value TEXT)')
  const value = db.query("SELECT value FROM key_values WHERE key = 'startupThreadIDs' LIMIT 1").get()?.value
  if (countPath) appendFileSync(countPath, 'launch:' + (value ?? 'missing') + '\\n')
  db.close()
  let valid = false
  try { valid = Array.isArray(JSON.parse(value ?? '')) } catch {}
  if (!valid && process.env.BEEPER_FAKE_SERVER_EXIT_ON_INVALID !== '0') process.exit(1)
}
const server = createServer((request, response) => {
  if (request.url === '/v1/info') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
    return
  }
  response.writeHead(404)
  response.end()
})
server.listen(port, '127.0.0.1')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
`)
  chmodSync(serverBin, 0o755)

  const port = await availablePort()
  process.env.BEEPER_CLI_CONFIG_DIR = join(root, 'config')
  process.env.BEEPER_SERVER_BIN = serverBin
  target = {
    id: 'server',
    type: 'server',
    baseURL: `http://127.0.0.1:${port}`,
    managed: true,
    dataDir,
    port,
  }
})

afterEach(async () => {
  await stopProfile(target).catch(() => {})
  rmSync(root, { recursive: true, force: true })
  delete process.env.BEEPER_CLI_CONFIG_DIR
  delete process.env.BEEPER_SERVER_BIN
  delete process.env.BEEPER_FAKE_SERVER_BOOTSTRAP
  delete process.env.BEEPER_FAKE_SERVER_COUNT
  delete process.env.BEEPER_FAKE_SERVER_EXIT_ON_INVALID
})

describe('managed server startup bootstrap', () => {
  it('seeds a missing startupThreadIDs value before starting the server', async () => {
    createKeyValuesDatabase()

    await startProfile(target)

    expect(readStartupThreadIDs()).toEqual([])
  })

  it('preserves an existing valid startupThreadIDs array', async () => {
    createKeyValuesDatabase(JSON.stringify(['thread-1', 'thread-2']))

    await startProfile(target)

    expect(readStartupThreadIDs()).toEqual(['thread-1', 'thread-2'])
  })

  it('repairs a non-array startupThreadIDs value before starting the server', async () => {
    createKeyValuesDatabase('null')

    await startProfile(target)

    expect(readStartupThreadIDs()).toEqual([])
  })

  it('repairs malformed startupThreadIDs JSON before starting the server', async () => {
    createKeyValuesDatabase('not-json')

    await startProfile(target)

    expect(readStartupThreadIDs()).toEqual([])
  })

  it('repairs a database created by a failed first launch and retries once', async () => {
    process.env.BEEPER_FAKE_SERVER_BOOTSTRAP = '1'
    process.env.BEEPER_FAKE_SERVER_COUNT = join(root, 'launches')

    await startProfile(target)
    expect(readStartupThreadIDs()).toEqual([])
    expect(readFileSync(join(root, 'launches'), 'utf8').trim().split('\n')).toHaveLength(2)
  }, 20_000)

  it('repairs a database created by a healthy first launch and retries once', async () => {
    process.env.BEEPER_FAKE_SERVER_BOOTSTRAP = '1'
    process.env.BEEPER_FAKE_SERVER_EXIT_ON_INVALID = '0'
    process.env.BEEPER_FAKE_SERVER_COUNT = join(root, 'launches')

    await startProfile(target)

    expect(readStartupThreadIDs()).toEqual([])
    expect(readFileSync(join(root, 'launches'), 'utf8').trim().split('\n')).toEqual(['launch:missing', 'launch:[]'])
  }, 20_000)

  it('does not create or fail on a missing database or schema', async () => {
    await startProfile(target)
    expect(existsSync(join(dataDir, 'index.db'))).toBe(false)

    await stopProfile(target)
    withDatabase(() => {})
    await startProfile(target)
    expect(readStartupThreadIDs()).toBeUndefined()
  }, 40_000)
})

function createKeyValuesDatabase(value?: string): void {
  withDatabase(db => {
    db.run('CREATE TABLE key_values (key TEXT PRIMARY KEY, value TEXT)')
    if (value !== undefined) db.run('INSERT INTO key_values (key, value) VALUES (?, ?)', ['startupThreadIDs', value])
  })
}

function readStartupThreadIDs(): unknown {
  const dbPath = join(dataDir, 'index.db')
  if (!existsSync(dbPath)) return undefined
  let value: unknown
  const db = new Database(dbPath)
  try {
    const table = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'key_values' LIMIT 1").get()
    if (!table) return undefined
    value = (db.query("SELECT value FROM key_values WHERE key = 'startupThreadIDs' LIMIT 1").get() as { value?: string } | null)?.value
  } catch {
    return undefined
  } finally {
    db.close()
  }

  if (value === undefined) return undefined
  try {
    return JSON.parse(String(value))
  } catch {
    return value
  }
}

function withDatabase(callback: (db: Database) => void): void {
  const db = new Database(join(dataDir, 'index.db'))
  try {
    callback(db)
  } finally {
    db.close()
  }
}

async function availablePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not allocate a test port.')
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error)
      else resolve()
    })
  })
  return address.port
}

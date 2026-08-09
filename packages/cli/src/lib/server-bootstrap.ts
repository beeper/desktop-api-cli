import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'

const startupThreadIDsKey = 'startupThreadIDs'

export type StartupThreadIDsState = 'missing-database' | 'missing-schema' | 'missing' | 'invalid' | 'valid' | 'unavailable'
export type StartupThreadIDsRepair = 'repaired' | 'preserved' | 'skipped'

/**
 * Read the bootstrap value without changing a running server database.
 */
export async function inspectStartupThreadIDs(dataDir: string): Promise<StartupThreadIDsState> {
  const dbPath = join(dataDir, 'index.db')
  if (!await pathExists(dbPath)) return 'missing-database'

  let db: Database
  try {
    db = new Database(dbPath, { readonly: true })
  } catch {
    return 'unavailable'
  }

  try {
    const table = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'key_values' LIMIT 1").get()
    if (!table) return 'missing-schema'

    const row = db.query(`SELECT value FROM key_values WHERE key = '${startupThreadIDsKey}' LIMIT 1`).get() as { value?: unknown } | null
    if (!row) return 'missing'
    return isArrayJSON(row.value) ? 'valid' : 'invalid'
  } catch {
    return 'unavailable'
  } finally {
    db.close()
  }
}

/**
 * Ensure the server's startup bootstrap sees an array when a local profile
 * database has no usable value. A managed server is stopped at this point in
 * its lifecycle, so this is safe to do before spawning it. Any unavailable or
 * incompatible database is left untouched and does not block startup.
 */
export async function ensureStartupThreadIDs(dataDir: string): Promise<StartupThreadIDsRepair> {
  const state = await inspectStartupThreadIDs(dataDir)
  if (state === 'valid') return 'preserved'
  if (state !== 'missing' && state !== 'invalid') return 'skipped'

  const dbPath = join(dataDir, 'index.db')
  let db: Database
  try {
    db = new Database(dbPath)
  } catch {
    return 'skipped'
  }

  try {
    const table = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'key_values' LIMIT 1").get()
    if (!table) return 'skipped'
    const row = db.query(`SELECT value FROM key_values WHERE key = '${startupThreadIDsKey}' LIMIT 1`).get() as { value?: unknown } | null
    if (row && isArrayJSON(row.value)) return 'preserved'

    if (row) {
      db.run(`UPDATE key_values SET value = '[]' WHERE key = '${startupThreadIDsKey}'`)
    } else {
      db.run(`INSERT INTO key_values (key, value) VALUES ('${startupThreadIDsKey}', '[]')`)
    }
    return 'repaired'
  } catch {
    // A missing table or read-only database is not a reason to prevent the server from starting.
    return 'skipped'
  } finally {
    db.close()
  }
}

function isArrayJSON(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

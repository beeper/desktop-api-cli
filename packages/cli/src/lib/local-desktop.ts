import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { BeeperDesktop } from '@beeper/desktop-api'
import { apiItems, apiRecord } from './api-values.js'
import type { Readiness } from './app-state.js'
import type { StoredAuth, Target } from './targets.js'

const execFileAsync = promisify(execFile)

export type LocalDesktopSession = {
  auth: StoredAuth
  dataDir: string
  deviceID?: string
  firstSyncDone?: boolean
  homeserver?: string
  state: Record<string, unknown>
  userID?: string
}

export async function findLocalDesktopSession(target?: Target): Promise<LocalDesktopSession> {
  const dirs = target?.dataDir ? [target.dataDir] : await localDesktopDataDirs()
  const errors: string[] = []
  for (const dataDir of dirs) {
    try {
      const state = await readBeeperState(dataDir)
      const accessToken = stringValue(state.access_token)
      if (!accessToken) throw new Error('missing access_token')
      return {
        auth: { accessToken, source: 'desktop-db', tokenType: 'Bearer' },
        dataDir,
        deviceID: stringValue(state.device_id),
        firstSyncDone: booleanValue(state.first_sync_done),
        homeserver: stringValue(state.homeserver),
        state,
        userID: stringValue(state.user_id),
      }
    } catch (error) {
      errors.push(`${dataDir}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`Could not find a signed-in local Beeper Desktop session. ${errors.join('; ')}`)
}

export function localDesktopReadiness(session: LocalDesktopSession): Readiness {
  const secrets = apiRecord(session.state.secrets)
  const e2ee = {
    initialized: booleanValue(session.state.initialized) ?? false,
    secretStorage: booleanValue(session.state.secret_storage) ?? false,
    crossSigning: booleanValue(session.state.cross_signing) ?? false,
    verified: booleanValue(session.state.verified) ?? false,
    secrets: {
      masterKey: booleanValue(secrets.master_key) ?? false,
      selfSigningKey: booleanValue(secrets.self_signing_key) ?? false,
      userSigningKey: booleanValue(secrets.user_signing_key) ?? false,
      megolmBackupKey: booleanValue(secrets.megolm_backup_key) ?? false,
      recoveryKey: booleanValue(secrets.recovery_code) ?? false,
    },
    keyBackup: booleanValue(session.state.key_backup) ?? false,
    firstSyncDone: session.firstSyncDone ?? false,
    hasBackedUpRecoveryKey: booleanValue(session.state.has_backed_up_code) ?? false,
  }
  const ready = e2ee.firstSyncDone
    && e2ee.initialized
    && e2ee.secretStorage
    && e2ee.crossSigning
    && e2ee.verified
    && e2ee.keyBackup
    && e2ee.hasBackedUpRecoveryKey
    && e2ee.secrets.masterKey
    && e2ee.secrets.selfSigningKey
    && e2ee.secrets.userSigningKey
    && e2ee.secrets.megolmBackupKey
    && e2ee.secrets.recoveryKey
  const state = ready ? 'ready' : 'needs-first-sync'

  return {
    state,
    app: {
      state,
      matrix: {
        userID: session.userID ?? '',
        deviceID: session.deviceID ?? '',
        homeserver: session.homeserver ?? '',
      },
      e2ee,
    },
    actions: state === 'ready' ? ['chats list', 'messages list', 'send text'] : ['setup', 'status'],
    message: state === 'ready' ? undefined : 'Waiting for local Desktop first sync and encryption setup.',
  }
}

export async function connectedAccountSummary(target: Target, auth?: StoredAuth): Promise<string[]> {
  const token = auth?.accessToken ?? target.auth?.accessToken
  if (!token) return []
  const client = new BeeperDesktop({ baseURL: target.baseURL, accessToken: token })
  return apiItems(await client.accounts.list())
    .map(item => accountName(item))
    .filter((name): name is string => Boolean(name))
    .slice(0, 8)
}

export async function localConnectedAccountSummary(dataDir: string): Promise<string[]> {
  const bridgeAccounts = await readKeyValue(dataDir, 'bridgeAccounts').catch(() => undefined)
  const names = apiItems(bridgeAccounts)
    .map(item => accountName(item))
    .filter((name): name is string => Boolean(name))
  return [...new Set(names)].slice(0, 8)
}

async function localDesktopDataDirs(): Promise<string[]> {
  const candidates = new Set<string>()
  if (process.env.BEEPER_USER_DATA_DIR) return [process.env.BEEPER_USER_DATA_DIR]
  if (process.platform === 'darwin') {
    const appSupport = join(homedir(), 'Library', 'Application Support')
    candidates.add(join(appSupport, 'BeeperTexts'))
    for (const name of await readdir(appSupport).catch(() => [])) {
      if (name.startsWith('BeeperTexts-')) candidates.add(join(appSupport, name))
    }
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? homedir()
    candidates.add(join(appData, 'BeeperTexts'))
  } else {
    const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
    candidates.add(join(configHome, 'BeeperTexts'))
  }
  return [...candidates]
}

async function readBeeperState(dataDir: string): Promise<Record<string, unknown>> {
  const parsed = await readKeyValue(dataDir, 'beeperState')
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid beeperState')
  return parsed as Record<string, unknown>
}

async function readKeyValue(dataDir: string, key: string): Promise<unknown> {
  const dbPath = join(dataDir, 'index.db')
  const { stdout } = await execFileAsync('sqlite3', [
    '-json',
    dbPath,
    `SELECT value FROM key_values WHERE key = '${sqlString(key)}' LIMIT 1`,
  ])
  const rows = JSON.parse(stdout || '[]') as Array<{ value?: string }>
  const value = rows[0]?.value
  if (!value) throw new Error(`missing ${key}`)
  return JSON.parse(value)
}

function accountName(item: unknown): string | undefined {
  const record = apiRecord(item)
  const bridge = apiRecord(record.bridge)
  const network = apiRecord(record.network)
  return stringValue(record.network)
    ?? stringValue(network.displayName)
    ?? stringValue(network.name)
    ?? stringValue(record.displayName)
    ?? stringValue(record.name)
    ?? stringValue(bridge.type)
    ?? stringValue(record.accountID)
    ?? stringValue(record.id)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function sqlString(value: string): string {
  return value.replaceAll("'", "''")
}

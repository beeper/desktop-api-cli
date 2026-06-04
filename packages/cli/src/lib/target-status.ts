import type { ManagedTargetType, Target } from './targets.js'
import { checkInstallationUpdate, readInstallations } from './installations.js'

type TargetLiveStatus = {
  reachable: boolean
  version?: string
  bundleID?: string
  actualType?: ManagedTargetType
  error?: string
  update?: {
    available: boolean
    latestVersion?: string
    action: string
  }
}

export async function targetLiveStatus(target: Pick<Target, 'type' | 'baseURL' | 'dataDir'>): Promise<TargetLiveStatus> {
  try {
    const response = await fetch(new URL('/v1/info', target.baseURL), { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return { reachable: false, error: `${response.status} ${response.statusText}` }
    const info = await response.json() as {
      app?: { version?: string; bundle_id?: string }
      server?: { hostname?: string; remote_access?: boolean }
    }
    const version = info.app?.version
    const bundleID = info.app?.bundle_id
    const actualType = typeFromInfo(info, target)

    if (target.type !== 'remote' && actualType && actualType !== target.type) {
      return {
        reachable: false,
        version,
        bundleID,
        actualType,
        error: `Expected ${target.type} target but ${target.baseURL} is ${actualType}.`,
      }
    }

    const installations = target.type === 'remote' ? undefined : await readInstallations()
    const installation = target.type === 'server' ? installations?.server : target.type === 'desktop' ? installations?.desktop : undefined
    const update = installation
      ? await checkInstallationUpdate({ ...installation, version: version ?? installation.version }).catch(() => undefined)
      : undefined
    return {
      reachable: true,
      version,
      bundleID,
      actualType,
      update: update ? {
        available: update.available,
        latestVersion: update.latestVersion,
        action: target.type === 'desktop'
          ? 'Update Beeper Desktop in the app.'
          : update.available ? 'Run: beeper install server' : 'Beeper Server is up to date.',
      } : undefined,
    }
  } catch {
    return { reachable: false, error: `Could not reach ${target.baseURL}` }
  }
}

function typeFromInfo(
  info: { app?: { bundle_id?: string }; server?: { hostname?: string; remote_access?: boolean } },
  target: Pick<Target, 'type' | 'dataDir'>,
): ManagedTargetType | undefined {
  if (target.type === 'server' && target.dataDir && info.server?.hostname === '127.0.0.1' && info.server.remote_access === false) return 'server'
  return typeFromBundleID(info.app?.bundle_id)
}

function typeFromBundleID(bundleID?: string): ManagedTargetType | undefined {
  if (!bundleID) return undefined
  if (bundleID.includes('.server')) return 'server'
  if (bundleID.includes('.desktop')) return 'desktop'
  return undefined
}

import { AbortError, ExitCodes } from './errors.js'
import { loginWithPKCE, type TokenResponse } from './oauth.js'
import { defaultDesktopBaseURL, defaultDesktopPort, type AuthSource, type StoredAuth } from './targets.js'

type DesktopAppStatus = {
  state?: string
}

type DesktopProbe = {
  baseURL: string
  status?: DesktopAppStatus
}

const scanPorts = Array.from({ length: 20 }, (_, index) => defaultDesktopPort + index)

export async function findLocalDesktop(options: { baseURL?: string; scan?: boolean; timeoutMs?: number } = {}): Promise<DesktopProbe> {
  const preferred = options.baseURL ?? defaultDesktopBaseURL
  const candidates = candidateBaseURLs(preferred, options.scan ?? true)
  const timeoutMs = options.timeoutMs ?? 500

  const preferredProbe = await probeDesktop(preferred, timeoutMs)
  if (preferredProbe) return preferredProbe

  const rest = candidates.filter(url => url !== preferred)
  if (rest.length) {
    try {
      return await Promise.any(rest.map(async url => {
        const probe = await probeDesktop(url, timeoutMs)
        if (!probe) throw new Error('not found')
        return probe
      }))
    } catch { /* fall through */ }
  }

  throw new AbortError(`Could not find a running Beeper Desktop API on ${candidates.join(', ')}.`, ExitCodes.NotReady, undefined, 'not_ready')
}

type AuthorizedTargetToken = TokenResponse & { clientID: string }

export async function authorizeTarget(options: {
  baseURL?: string
  clientName?: string
  openBrowser?: boolean
  scan?: boolean
  scope?: string
} = {}): Promise<AuthorizedTargetToken> {
  const desktop = await findLocalDesktop({ baseURL: options.baseURL, scan: options.scan })
  if (desktop.status?.state === 'needs-login') {
    throw new AbortError('Beeper Desktop is not signed in. Open Beeper Desktop and sign in, then rerun this command.', ExitCodes.AuthRequired, undefined, 'auth_required')
  }

  return loginWithPKCE({
    baseURL: desktop.baseURL,
    clientName: options.clientName ?? 'Beeper CLI',
    openBrowser: options.openBrowser ?? true,
    scope: options.scope ?? 'read write',
  })
}

export function authFromToken(token: AuthorizedTargetToken, source: AuthSource): StoredAuth {
  return {
    accessToken: token.access_token,
    clientID: token.clientID,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    scope: token.scope,
    source,
    tokenType: token.token_type,
  }
}

async function getDesktopAppStatus(baseURL: string): Promise<DesktopAppStatus | undefined> {
  const response = await fetchWithTimeout(new URL('/v1/app/setup', baseURL), {}, 2_000)
  if (response.status === 401 || response.status === 403 || response.status === 404) return undefined
  if (!response.ok) throw new Error(`GET /v1/app/setup failed: ${response.status} ${await response.text()}`)
  return response.json() as Promise<DesktopAppStatus>
}

function candidateBaseURLs(preferred: string, scan: boolean): string[] {
  const urls = new Set<string>([preferred])
  if (!scan) return [...urls]
  for (const port of scanPorts) {
    urls.add(`http://127.0.0.1:${port}`)
    urls.add(`http://localhost:${port}`)
  }
  return [...urls]
}

async function probeDesktop(baseURL: string, timeoutMs: number): Promise<DesktopProbe | undefined> {
  try {
    const info = await fetchWithTimeout(new URL('/v1/info', baseURL), {}, timeoutMs)
    if (!info.ok) return undefined
    return { baseURL, status: await getDesktopAppStatus(baseURL) }
  } catch {
    return undefined
  }
}

async function fetchWithTimeout(url: URL, init: RequestInit = {}, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

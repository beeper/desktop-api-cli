import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { AddressInfo } from 'node:net'
import { spawn } from 'node:child_process'

type OAuthLoginOptions = {
  baseURL: string
  clientName: string
  openBrowser: boolean
  scope: string
  timeoutMs?: number
}

type PKCEPair = {
  codeChallenge: string
  codeVerifier: string
}

type RegisterResponse = {
  authorization_endpoint?: string
  client_id: string
  token_endpoint?: string
}

export type TokenResponse = {
  access_token: string
  expires_in?: number
  scope?: string
  token_type: 'Bearer'
}

export async function loginWithPKCE(options: OAuthLoginOptions): Promise<TokenResponse & { clientID: string }> {
  const callback = await createCallbackServer(options.timeoutMs ?? 120_000)
  try {
    const redirectURI = `http://127.0.0.1:${callback.port}/callback`
    const registered = await registerClient(options.baseURL, options.clientName, redirectURI, options.scope)
    const pkce = createPKCEPair()
    const state = createState()
    const authorizeURL = new URL(registered.authorization_endpoint ?? '/oauth/authorize', options.baseURL)
    authorizeURL.searchParams.set('client_id', registered.client_id)
    authorizeURL.searchParams.set('redirect_uri', redirectURI)
    authorizeURL.searchParams.set('response_type', 'code')
    authorizeURL.searchParams.set('scope', options.scope)
    authorizeURL.searchParams.set('state', state)
    authorizeURL.searchParams.set('code_challenge', pkce.codeChallenge)
    authorizeURL.searchParams.set('code_challenge_method', 'S256')

    if (options.openBrowser) openExternal(authorizeURL.toString())
    else process.stderr.write(`Open this URL to authenticate:\n${authorizeURL.toString()}\n`)

    const result = await callback.waitForCode
    if (result.state !== state) throw new Error('OAuth state mismatch.')
    if (result.error) throw new Error(`OAuth authorization failed: ${result.error}`)
    if (!result.code) throw new Error('OAuth callback did not include an authorization code.')

    const token = await exchangeToken(
      registered.token_endpoint ?? new URL('/oauth/token', options.baseURL).toString(),
      registered.client_id,
      result.code,
      pkce.codeVerifier,
      redirectURI,
    )

    return { ...token, clientID: registered.client_id }
  } finally {
    await callback.close()
  }
}

function createPKCEPair(): PKCEPair {
  const codeVerifier = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeChallenge, codeVerifier }
}

function createState(): string {
  return randomBytes(24).toString('base64url')
}

async function registerClient(baseURL: string, clientName: string, redirectURI: string, scope: string): Promise<RegisterResponse> {
  const response = await fetch(new URL('/oauth/register', baseURL), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      redirect_uris: [redirectURI],
      scope,
      token_endpoint_auth_method: 'none',
    }),
  })
  if (!response.ok) throw new Error(`OAuth client registration failed: ${response.status} ${await response.text()}`)
  return response.json() as Promise<RegisterResponse>
}

async function exchangeToken(tokenEndpoint: string, clientID: string, code: string, codeVerifier: string, redirectURI: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientID,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectURI,
  })
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(`OAuth token exchange failed: ${response.status} ${await response.text()}`)
  return response.json() as Promise<TokenResponse>
}

function openExternal(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

function createCallbackServer(timeoutMs: number): Promise<{
  close: () => Promise<void>
  port: number
  waitForCode: Promise<{ code?: string; error?: string; state?: string }>
}> {
  return new Promise((resolve, reject) => {
    let settle!: (value: { code?: string; error?: string; state?: string }) => void
    let fail!: (error: Error) => void
    const waitForCode = new Promise<{ code?: string; error?: string; state?: string }>((res, rej) => {
      settle = res
      fail = rej
    })

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (url.pathname !== '/callback') {
          res.writeHead(404).end('Not found')
          return
        }
        const code = url.searchParams.get('code') ?? undefined
        const error = url.searchParams.get('error') ?? undefined
        const state = url.searchParams.get('state') ?? undefined
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end('<!doctype html><title>Beeper CLI</title><p>You can close this tab and return to the terminal.</p>')
        settle({ code, error, state })
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    })

    const timeout = setTimeout(() => fail(new Error('Timed out waiting for OAuth callback.')), timeoutMs)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({
        close: () =>
          new Promise(closeResolve => {
            clearTimeout(timeout)
            server.close(() => closeResolve())
          }),
        port: address.port,
        waitForCode,
      })
    })
  })
}

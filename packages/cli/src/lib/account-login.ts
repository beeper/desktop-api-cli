import { createInterface } from 'node:readline/promises'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stdin as input, stderr as output } from 'node:process'
import QRCode from 'qrcode'
import type { LoginSession } from '@beeper/desktop-api/resources/bridges.js'
import type { BeeperDesktop } from '@beeper/desktop-api'

export type AccountLoginStep = LoginSession

export type AccountLoginOptions = {
  cookies?: Record<string, string>
  fields?: Record<string, string>
  nonInteractive?: boolean
  webview?: boolean
  webviewBackend?: 'auto' | 'chrome' | 'webkit'
  webviewBrowserPath?: string
  webviewTimeoutMs?: number
}

export async function printAccountLoginStep(session: AccountLoginStep): Promise<void> {
  const step = session.currentStep
  output.write(`status: ${session.status}\n`)
  if (session.loginID) output.write(`login_id: ${session.loginID}\n`)
  if (!step) return

  output.write(`step: ${step.type}\n`)
  if ('instructions' in step && step.instructions) output.write(`${step.instructions}\n`)
  if ('stepID' in step) output.write(`step_id: ${step.stepID}\n`)

  if (step.type === 'display_and_wait') {
    const display = step.display as { type: string; data?: string; imageURL?: string }
    output.write(`display: ${step.display.type}\n`)
    if (display.type === 'qr' && display.data) output.write(`${await renderTerminalQRCode(display.data)}\n`)
    if (display.type === 'emoji' && display.imageURL) output.write(`image: ${display.imageURL}\n`)
    if (display.type === 'code' && display.data) output.write(`${display.data}\n`)
  } else if (step.type === 'user_input') {
    for (const field of step.fields) {
      const details = [field.type, field.placeholder].filter(Boolean).join(' | ')
      output.write(`field ${field.id}: ${field.label ?? field.id}${details ? ` (${details})` : ''}\n`)
    }
  } else if (step.type === 'cookies') {
    output.write(`url: ${step.url}\n`)
    if (step.userAgent) output.write(`user_agent: ${step.userAgent}\n`)
    if (step.expectedFinalURLRegex) output.write(`expected_final_url_regex: ${step.expectedFinalURLRegex}\n`)
    for (const field of step.fields) output.write(`cookie field ${field.id}: ${field.type ?? 'cookie'}\n`)
    if (step.extractJS) output.write(`extract_js:\n${step.extractJS}\n`)
  } else if (step.type === 'complete') {
    output.write(`complete: ${step.login?.loginID ?? session.loginID ?? 'yes'}\n`)
  }
}

export async function runGuidedAccountLogin(client: BeeperDesktop, bridgeID: string, initialStep: AccountLoginStep, options: AccountLoginOptions = {}): Promise<AccountLoginStep> {
  let session = initialStep
  for (;;) {
    await printAccountLoginStep(session)
    if (session.status === 'complete' || session.status === 'cancelled' || session.status === 'failed') return session

    const step = session.currentStep
    if (!step || !('stepID' in step)) throw new Error('Account login session did not include a current step.')

    if (step.type === 'display_and_wait') {
      if (options.nonInteractive) return session
      output.write('waiting for this step to complete...\n')
      session = await client.bridges.loginSessions.steps.submit(step.stepID, { bridgeID, loginSessionID: session.loginSessionID, type: 'display_and_wait' })
      continue
    }

    if (step.type === 'user_input') {
      const fields: Record<string, string> = {}
      for (const field of step.fields) {
        if (options.fields?.[field.id] !== undefined) {
          fields[field.id] = options.fields[field.id]!
          continue
        }

        if (options.nonInteractive) {
          if (field.initialValue !== undefined) {
            fields[field.id] = field.initialValue
            continue
          }

          throw new Error(`Missing required field ${field.id}. Pass --field ${field.id}=... or run without --non-interactive.`)
        }

        const fallback = field.initialValue ? ` [${field.initialValue}]` : ''
        const value = await promptText(`${field.label ?? field.id}${fallback}: `)
        fields[field.id] = value || field.initialValue || ''
      }
      session = await client.bridges.loginSessions.steps.submit(step.stepID, { bridgeID, loginSessionID: session.loginSessionID, type: 'user_input', fields })
      continue
    }

    if (step.type === 'cookies') {
      const fields: Record<string, string> = {}
      let usedWebView = false
      if (options.webview) {
        try {
          const webviewFields = await collectCookieFieldsWithWebView(step, options)
          usedWebView = Object.keys(webviewFields).length > 0
          Object.assign(fields, webviewFields)
        } catch (error) {
          if (options.nonInteractive) throw error
          output.write(`webview: ${error instanceof Error ? error.message : String(error)}\n`)
        }
      }

      for (const field of step.fields) {
        const id = field.id
        if (fields[id] !== undefined) continue
        if (options.cookies?.[id] !== undefined) {
          fields[id] = options.cookies[id]!
          continue
        }

        if (options.nonInteractive) throw new Error(`Missing required cookie ${id}. Pass --cookie ${id}=... or run without --non-interactive.`)
        fields[id] = await promptSecret(`${id}: `)
      }
      session = await client.bridges.loginSessions.steps.submit(step.stepID, { bridgeID, loginSessionID: session.loginSessionID, type: 'cookies', fields, source: usedWebView ? 'webview' : 'api' })
      continue
    }

    throw new Error(`Unsupported account login step: ${step.type}`)
  }
}

async function renderTerminalQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toString(data, {
      errorCorrectionLevel: 'M',
      small: true,
      type: 'terminal',
    })
  } catch {
    return data
  }
}

type CookieLoginStep = NonNullable<AccountLoginStep['currentStep']> & {
  type: 'cookies'
}

type CookieField = CookieLoginStep['fields'][number] & {
  required?: boolean
  pattern?: string
  sources?: CookieFieldSource[]
}

type NormalizedCookieField = CookieField & {
  required: boolean
  sources: CookieFieldSource[]
}

type CookieFieldSource =
  | { type: 'cookie'; name: string; cookieDomain?: string }
  | { type: 'request_header'; name: string; requestURLRegex?: string }
  | { type: 'local_storage'; name: string }
  | { type: 'special'; name: string }

type WebViewConstructor = new (options?: Record<string, unknown>) => {
  url: string
  close(): void
  navigate(url: string): Promise<void>
  evaluate(script: string): Promise<unknown>
  cdp?(method: string, params?: Record<string, unknown>): Promise<unknown>
  addEventListener?(type: string, listener: (event: Event & { data?: unknown }) => void): void
  onNavigated?: ((url: string, title: string) => void) | null
}

const EXTRACT_JS_KEY = '__BEEP_BEEP_AUTH_RESULTS__'
let webViewConstructorOverride: WebViewConstructor | undefined

export function setWebViewConstructorForTest(constructor: WebViewConstructor | undefined): void {
  webViewConstructorOverride = constructor
}

async function collectCookieFieldsWithWebView(step: CookieLoginStep, options: AccountLoginOptions): Promise<Record<string, string>> {
  const BunRuntime = (globalThis as { Bun?: { WebView?: WebViewConstructor; which?(name: string): string | null } }).Bun
  const WebView = webViewConstructorOverride ?? BunRuntime?.WebView
  if (!WebView) throw new Error('Bun.WebView is not available in this Bun runtime.')

  const backend = options.webviewBackend && options.webviewBackend !== 'auto' ? options.webviewBackend : undefined
  if (options.webviewBrowserPath && backend === 'webkit') throw new Error('--webview-browser-path requires the chrome backend.')
  const browserPath = !options.nonInteractive && (backend === 'chrome' || (!backend && process.platform !== 'darwin'))
    ? options.webviewBrowserPath ?? findChromiumBrowser(BunRuntime?.which)
    : undefined
  const browser = browserPath ? await launchVisibleBrowser(browserPath) : undefined
  const usesChrome = backend === 'chrome' || Boolean(browser)
  let view: InstanceType<WebViewConstructor>
  try {
    view = new WebView(browser ? { backend: { type: 'chrome', url: browser.url } } : backend ? { backend } : undefined)
  } catch (error) {
    await browser?.close()
    throw error
  }
  const found: Record<string, string> = {}
  const fields = normalizeCookieFields(step.fields)
  const headerFields = fields.filter(field => field.sources.some(source => source.type === 'request_header'))
  let lastURL = ''
  let extractJSURL: string | undefined
  view.onNavigated = url => {
    lastURL = url
  }

  try {
    if ((step.userAgent || headerFields.length > 0 || fields.some(field => field.sources.some(source => source.type === 'cookie' && source.cookieDomain))) && usesChrome && view.cdp) {
      await view.navigate('about:blank')
      if (step.userAgent) await view.cdp('Emulation.setUserAgentOverride', { userAgent: step.userAgent })
      await setupChromeNetworkCapture(view, headerFields, found)
    } else if (step.userAgent) {
      output.write('webview: this cookie step suggests a user agent; pass --webview-backend chrome to apply it.\n')
    }

    output.write(`webview: opening ${step.url}\n`)
    if (browser) {
      output.write('webview: complete sign-in in the opened browser window.\n')
    } else if (backend === 'chrome') {
      output.write('webview: complete sign-in in the opened Chrome tab. If no tab appears, enable Chrome remote debugging and retry.\n')
    } else {
      output.write('webview: running in headless mode; cookie fields will be collected if the page can complete without manual input.\n')
    }

    await view.navigate(step.url)
    lastURL = view.url || lastURL

    const deadline = Date.now() + (options.webviewTimeoutMs ?? 120_000)
    const finalURLRegex = step.expectedFinalURLRegex ? new RegExp(step.expectedFinalURLRegex) : undefined
    while (Date.now() < deadline) {
      Object.assign(found, await collectBrowserStorageFields(view, fields))
      if (view.cdp) Object.assign(found, await collectChromeCookies(view, fields))
      if (step.extractJS && extractJSURL !== (lastURL || view.url)) {
        extractJSURL = lastURL || view.url
        await runDesktopExtractJS(view, step.extractJS)
      }
      if (step.extractJS) Object.assign(found, await collectSpecialFields(view, fields))

      const hasFields = fields.every(field => !field.required || found[field.id] !== undefined)
      const hasFinalURL = !finalURLRegex || finalURLRegex.test(lastURL || view.url)
      if (hasFields && hasFinalURL) return found
      await sleep(500)
    }

    const missing = fields.filter(field => field.required && found[field.id] === undefined).map(field => field.id)
    throw new Error(`Timed out waiting for cookie fields${missing.length ? `: ${missing.join(', ')}` : ''}.`)
  } finally {
    if (browser && view.cdp) await view.cdp('Browser.close').catch(() => undefined)
    view.close()
    await browser?.close()
  }
}

function findChromiumBrowser(which: ((name: string) => string | null) | undefined): string | undefined {
  return process.env.BUN_CHROME_PATH || [
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
    'brave-browser', 'microsoft-edge', 'opera-gx', 'opera', 'vivaldi',
  ].map(name => which?.(name)).find((path): path is string => Boolean(path))
}

async function launchVisibleBrowser(path: string): Promise<{ url: string; close(): Promise<void> }> {
  const profile = await mkdtemp(join(tmpdir(), 'beeper-webview-'))
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = server.port
  await server.stop(true)
  const process = spawn(path, [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
  let launchError: Error | undefined
  process.once('error', error => { launchError = error })

  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError
      if (process.exitCode !== null) throw new Error(`Browser exited with code ${process.exitCode}.`)
      const endpoint = await fetch(`http://127.0.0.1:${port}/json/version`).then(response => response.json() as Promise<{ webSocketDebuggerUrl?: string }>).catch(() => undefined)
      if (endpoint?.webSocketDebuggerUrl) return {
        url: endpoint.webSocketDebuggerUrl,
        close: async () => {
          process.kill()
          await Promise.race([new Promise<void>(resolve => process.once('exit', () => resolve())), sleep(1000)])
          await rm(profile, { recursive: true, force: true })
        },
      }
      await sleep(100)
    }
    throw new Error(`Timed out starting browser ${path}.`)
  } catch (error) {
    process.kill()
    await rm(profile, { recursive: true, force: true })
    throw error
  }
}

async function collectBrowserStorageFields(view: InstanceType<WebViewConstructor>, fields: NormalizedCookieField[]): Promise<Record<string, string>> {
  const serializableFields = fields.map(field => ({
    id: field.id,
    pattern: field.pattern,
    sources: field.sources.filter(source => source.type === 'cookie' || source.type === 'local_storage'),
  }))
  const result = await view.evaluate(`(() => {
    const fields = ${JSON.stringify(serializableFields)};
    const cookies = Object.fromEntries(document.cookie.split(';').map(part => {
      const index = part.indexOf('=');
      if (index < 0) return undefined;
      return [decodeURIComponent(part.slice(0, index).trim()), decodeURIComponent(part.slice(index + 1))];
    }).filter(Boolean));
    const found = {};
    for (const field of fields) {
      for (const source of field.sources) {
        let value;
        if (source.type === 'local_storage') value = localStorage.getItem(source.name);
        else if (source.type === 'cookie' && !source.cookieDomain) value = cookies[source.name];
        if (value === null || value === undefined) continue;
        if (field.pattern && !(new RegExp(field.pattern)).test(value)) continue;
        found[field.id] = value;
        break;
      }
    }
    return found;
  })()`)
  return stringRecord(result)
}

async function collectChromeCookies(view: InstanceType<WebViewConstructor>, fields: NormalizedCookieField[]): Promise<Record<string, string>> {
  if (!view.cdp) return {}
  const cookieFields = fields.filter(field => field.sources.some(source => source.type === 'cookie'))
  if (cookieFields.length === 0) return {}

  const response = await view.cdp('Network.getAllCookies').catch(() => undefined)
  const cookies = Array.isArray((response as { cookies?: unknown[] } | undefined)?.cookies) ? (response as { cookies: Array<Record<string, unknown>> }).cookies : []
  const found: Record<string, string> = {}
  for (const field of cookieFields) {
    for (const source of field.sources) {
      if (source.type !== 'cookie') continue
      const cookie = cookies.find(candidate => {
        if (candidate.name !== source.name || typeof candidate.value !== 'string') return false
        return !source.cookieDomain || matchesCookieDomain(String(candidate.domain ?? ''), source.cookieDomain)
      })
      if (typeof cookie?.value !== 'string') continue
      const value = decodeURIComponent(cookie.value)
      if (!matchesPattern(value, field.pattern)) continue
      found[field.id] = value
      break
    }
  }

  return found
}

async function setupChromeNetworkCapture(view: InstanceType<WebViewConstructor>, fields: NormalizedCookieField[], found: Record<string, string>): Promise<void> {
  if (!view.cdp || !view.addEventListener || fields.length === 0) return
  await view.cdp('Network.enable')
  view.addEventListener('Network.requestWillBeSent', event => {
    const data = event.data as { request?: { url?: string; headers?: Record<string, unknown> } } | undefined
    const url = data?.request?.url ?? ''
    const headers = data?.request?.headers ?? {}
    const lowerHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), typeof value === 'string' ? value : String(value)]))
    for (const field of fields) {
      for (const source of field.sources) {
        if (source.type !== 'request_header') continue
        if (source.requestURLRegex && !matchesPattern(url, source.requestURLRegex)) continue
        const value = lowerHeaders.get(source.name.toLowerCase())
        if (value === undefined || !matchesPattern(value, field.pattern)) continue
        found[field.id] = value
        break
      }
    }
  })
}

async function runDesktopExtractJS(view: InstanceType<WebViewConstructor>, extractJS: string): Promise<void> {
  const script = extractJS.replace(/\\n/g, '\n').replace(/\\t/g, '\t').trim()
  if (!script) return
  await view.evaluate(`(async () => {
    try {
      const result = await (${script});
      if (result) globalThis[${JSON.stringify(EXTRACT_JS_KEY)}] = result;
    } catch {}
  })()`).catch(() => undefined)
}

async function collectSpecialFields(view: InstanceType<WebViewConstructor>, fields: NormalizedCookieField[]): Promise<Record<string, string>> {
  const specialFields = fields.filter(field => field.sources.some(source => source.type === 'special'))
  if (specialFields.length === 0) return {}
  const result = await view.evaluate(`globalThis[${JSON.stringify(EXTRACT_JS_KEY)}] || {}`)
  const record = stringRecord(result)
  const found: Record<string, string> = {}
  for (const field of specialFields) {
    for (const source of field.sources) {
      if (source.type !== 'special') continue
      const value = record[field.id] ?? record[source.name]
      if (value === undefined || !matchesPattern(value, field.pattern)) continue
      found[field.id] = value
      break
    }
  }

  return found
}

function normalizeCookieFields(fields: CookieLoginStep['fields']): NormalizedCookieField[] {
  return fields.map(field => {
    const rich = field as CookieField
    const sources = rich.sources?.length ? rich.sources : legacySourcesForField(rich)
    const required = rich.required ?? true
    return { ...rich, sources, required }
  })
}

function legacySourcesForField(field: CookieField): CookieFieldSource[] {
  const name = field.name ?? field.id
  if (field.type === 'header') return [{ type: 'request_header', name }]
  if (field.type === 'local_storage') return [{ type: 'local_storage', name }]
  return [{ type: 'cookie', name }]
}

function matchesCookieDomain(actual: string, expected: string): boolean {
  const normalizedActual = actual.replace(/^\./, '').toLowerCase()
  const normalizedExpected = expected.replace(/^\./, '').toLowerCase()
  return normalizedActual === normalizedExpected || normalizedActual.endsWith(`.${normalizedExpected}`)
}

function matchesPattern(value: string, pattern: string | undefined): boolean {
  if (!pattern) return true
  try {
    return new RegExp(pattern).test(value)
  } catch {
    return true
  }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') out[key] = raw
  }
  return out
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function promptText(label: string): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    return (await rl.question(label)).trim()
  } finally {
    rl.close()
  }
}

async function promptSecret(label: string): Promise<string> {
  if (!input.isTTY) return promptText(label)
  try {
    execFileSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] })
    return await promptText(label)
  } finally {
    execFileSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'ignore'] })
    output.write('\n')
  }
}

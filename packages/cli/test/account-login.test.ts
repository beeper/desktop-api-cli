import { describe, expect, it, mock } from 'bun:test'
import { runGuidedAccountLogin } from '../src/lib/account-login.js'

type Session = Parameters<typeof runGuidedAccountLogin>[2]
type SubmitStep = (stepID: string, body: unknown) => Promise<Session>

describe('runGuidedAccountLogin', () => {
  it('submits display steps interactively and returns the completed session', async () => {
    const displayStep = session({
      currentStep: {
        type: 'display_and_wait',
        stepID: 'step-display',
        display: { type: 'qr', data: 'beeper://login' },
      },
    })
    const complete = session({ status: 'complete', currentStep: { type: 'complete', login: { loginID: 'login-1' } } })
    const submit = mock(async () => complete)
    const client = fakeClient(submit)

    const result = await runGuidedAccountLogin(client, 'local-whatsapp', displayStep)

    expect(result).toBe(complete)
    expect(submit).toHaveBeenCalledWith('step-display', {
      bridgeID: 'local-whatsapp',
      loginSessionID: 'session-1',
      type: 'display_and_wait',
    })
  })

  it('returns display steps without blocking in non-interactive mode', async () => {
    const displayStep = session({
      currentStep: {
        type: 'display_and_wait',
        stepID: 'step-display',
        display: { type: 'code', data: '123456' },
      },
    })
    const submit = mock(async () => session({ status: 'complete' }))

    const result = await runGuidedAccountLogin(fakeClient(submit), 'telegram', displayStep, { nonInteractive: true })

    expect(result).toBe(displayStep)
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits user-input fields from flags and initial values in non-interactive mode', async () => {
    const userInputStep = session({
      currentStep: {
        type: 'user_input',
        stepID: 'step-user-input',
        fields: [
          { id: 'phone', label: 'Phone number', type: 'phone' },
          { id: 'country', label: 'Country', type: 'text', initialValue: 'US' },
        ],
      },
    })
    const complete = session({ status: 'complete', currentStep: { type: 'complete', login: { loginID: 'telegram' } } })
    const submit = mock(async () => complete)

    const result = await runGuidedAccountLogin(fakeClient(submit), 'telegram', userInputStep, {
      fields: { phone: '+15551234567' },
      nonInteractive: true,
    })

    expect(result).toBe(complete)
    expect(submit).toHaveBeenCalledWith('step-user-input', {
      bridgeID: 'telegram',
      loginSessionID: 'session-1',
      type: 'user_input',
      fields: { phone: '+15551234567', country: 'US' },
    })
  })

  it('submits manual cookie values in non-interactive mode', async () => {
    const cookieStep = session({
      currentStep: {
        type: 'cookies',
        stepID: 'step-cookies',
        url: 'https://discord.com/login',
        fields: [{ id: 'sessiontoken', type: 'cookie' }],
      },
    })
    const complete = session({ status: 'complete', currentStep: { type: 'complete', login: { loginID: 'discord' } } })
    const submit = mock(async () => complete)

    const result = await runGuidedAccountLogin(fakeClient(submit), 'discord', cookieStep, {
      cookies: { sessiontoken: 'manual-cookie' },
      nonInteractive: true,
    })

    expect(result).toBe(complete)
    expect(submit).toHaveBeenCalledWith('step-cookies', {
      bridgeID: 'discord',
      loginSessionID: 'session-1',
      type: 'cookies',
      fields: { sessiontoken: 'manual-cookie' },
      source: 'api',
    })
  })

  it('collects rich cookie fields from Bun.WebView sources', async () => {
    const listeners = new Map<string, (event: Event & { data?: unknown }) => void>()
    class FakeWebView {
      url = ''
      onNavigated?: (url: string, title: string) => void
      closed = false

      async navigate(url: string): Promise<void> {
        this.url = url
        this.onNavigated?.(url, '')
        listeners.get('Network.requestWillBeSent')?.({
          data: {
            request: {
              headers: { Authorization: 'Bearer header-token' },
              url: 'https://example.com/auth/callback',
            },
          },
        } as Event & { data?: unknown })
      }

      async evaluate(script: string): Promise<unknown> {
        if (script.includes('document.cookie')) return { localField: 'local-token' }
        if (script.includes('__BEEP_BEEP_AUTH_RESULTS__') && script.includes('|| {}')) return { specialField: 'special-token' }
        return undefined
      }

      async cdp(method: string): Promise<unknown> {
        if (method === 'Network.getAllCookies') {
          return { cookies: [{ domain: '.example.com', name: 'SID', value: 'cookie-token' }] }
        }
        return {}
      }

      addEventListener(type: string, listener: (event: Event & { data?: unknown }) => void): void {
        listeners.set(type, listener)
      }

      close(): void {
        this.closed = true
      }
    }

    const cookieStep = session({
      currentStep: {
        type: 'cookies',
        stepID: 'step-webview-cookies',
        url: 'https://example.com/done',
        expectedFinalURLRegex: 'done$',
        extractJS: '(() => ({ specialField: "special-token" }))()',
        fields: [
          { id: 'cookieField', required: true, pattern: '^cookie-', sources: [{ type: 'cookie', name: 'SID', cookieDomain: '.example.com' }] },
          { id: 'headerField', required: true, pattern: '^Bearer ', sources: [{ type: 'request_header', name: 'authorization', requestURLRegex: '/auth/' }] },
          { id: 'localField', required: true, pattern: '^local-', sources: [{ type: 'local_storage', name: 'localToken' }] },
          { id: 'specialField', required: true, pattern: '^special-', sources: [{ type: 'special', name: 'specialField' }] },
        ],
      },
    })
    const complete = session({ status: 'complete', currentStep: { type: 'complete', login: { loginID: 'webview-login' } } })
    const submit = mock(async () => complete)

    const result = await runGuidedAccountLogin(fakeClient(submit), 'googlechat', cookieStep, {
      nonInteractive: true,
      webViewConstructor: FakeWebView,
      webview: true,
      webviewBackend: 'chrome',
      webviewTimeoutMs: 100,
    })

    expect(result).toBe(complete)
    expect(submit).toHaveBeenCalledWith('step-webview-cookies', {
      bridgeID: 'googlechat',
      loginSessionID: 'session-1',
      type: 'cookies',
      fields: {
        cookieField: 'cookie-token',
        headerField: 'Bearer header-token',
        localField: 'local-token',
        specialField: 'special-token',
      },
      source: 'webview',
    })
  })
})

function session(overrides: Partial<Session> = {}): Session {
  return {
    currentStep: { type: 'complete' },
    loginSessionID: 'session-1',
    status: 'waiting',
    ...overrides,
  } as Session
}

function fakeClient(submit: SubmitStep) {
  return {
    bridges: {
      loginSessions: {
        steps: {
          submit,
        },
      },
    },
  } as Parameters<typeof runGuidedAccountLogin>[0]
}

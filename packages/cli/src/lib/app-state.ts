import type { AppSessionResponse } from '@beeper/desktop-api/resources/app'
import type { QrConfirmScannedResponse, SASConfirmResponse, SASStartResponse, VerificationAcceptResponse, VerificationCreateResponse } from '@beeper/desktop-api/resources/app/verifications'
import { appRequest } from './app-api.js'
import { promptConfirm } from './prompts.js'

type AppState = AppSessionResponse

type ReadinessState = AppState['state']
  | 'no-target'
  | 'target-unreachable'
  | 'login-in-progress'
  | 'initializing'
  | 'needs-cross-signing-setup'
  | 'needs-verification'
  | 'verification-in-progress'
  | 'needs-recovery-key'
  | 'needs-secrets'
  | 'needs-first-sync'
  | 'ready'
  | 'error'

export type Readiness = {
  state: ReadinessState
  app?: AppState
  actions: string[]
  message?: string
}

function nextAppStep(state: AppState, targetID?: string): string | undefined {
  const appState = state.state as ReadinessState
  const target = targetID && targetID !== 'desktop' ? ` --target ${targetID}` : ''
  if (appState === 'ready') return undefined
  if (appState === 'needs-login' || appState === 'needs-verification' || appState === 'verification-in-progress') return `Run: beeper setup${target}`
  if (appState === 'needs-secrets' || appState === 'needs-recovery-key') return `Finish recovery in Beeper, then run: beeper setup${target}`
  if (appState === 'needs-cross-signing-setup') return `Finish cross-signing setup in Beeper, then run: beeper setup${target}`
  return `Waiting for app state: ${appState}`
}

export async function evaluateReadiness(options: { baseURL?: string; target?: string; token?: string | false } = {}): Promise<Readiness> {
  try {
    const app = await appRequest<AppState>('GET', '/v1/app/setup', options)
    const state = normalizeReadinessState(app)
    return {
      state,
      app,
      actions: actionsForState(state),
      message: nextAppStep(app, options.target),
    }
  } catch (error) {
    return {
      state: 'target-unreachable',
      actions: ['status', 'targets runtime start', 'setup'],
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function driveVerification(options: { baseURL?: string; force?: boolean; target?: string; userID?: string } = {}): Promise<AppState> {
  let state = await appRequest<AppState>('GET', '/v1/app/setup', options)
  if (state.state === 'ready') return state
  if (state.state === 'needs-login') throw new Error('Target is not signed in. Run `beeper setup` after signing in to Beeper Desktop.')

  for (;;) {
    const verification = state.verification
    const actions = new Set(verification?.availableActions ?? [])
    const id = verification?.id

    if (!verification) {
      state = (await appRequest<VerificationCreateResponse>('POST', '/v1/app/setup/verifications', {
        ...options,
        body: options.userID ? { userID: options.userID } : {},
      })).session
      continue
    }

    if (actions.has('accept') && id) {
      state = (await appRequest<VerificationAcceptResponse>('POST', `/v1/app/setup/verifications/${encodeURIComponent(id)}/accept`, options)).session
      continue
    }

    if (actions.has('sas.start') && id) {
      state = (await appRequest<SASStartResponse>('POST', `/v1/app/setup/verifications/${encodeURIComponent(id)}/sas/start`, options)).session
      continue
    }

    if (actions.has('sas.confirm') && id) {
      const sas = state.verification?.sas
      if (!options.force) {
        process.stdout.write(`Verify that this matches on the other device:\n${sas?.emojis ?? sas?.decimals ?? '(no SAS data)'}\n`)
        if (!await promptConfirm('Do they match?')) throw new Error('Verification cancelled.')
      }
      state = (await appRequest<SASConfirmResponse>('POST', `/v1/app/setup/verifications/${encodeURIComponent(id)}/sas/confirm`, options)).session
      continue
    }

    if (actions.has('qr.confirmScanned') && id) {
      state = (await appRequest<QrConfirmScannedResponse>('POST', `/v1/app/setup/verifications/${encodeURIComponent(id)}/qr/confirm-scanned`, options)).session
      continue
    }

    return state
  }
}

function normalizeReadinessState(app: AppState): ReadinessState {
  const known = new Set<ReadinessState>([
    'no-target',
    'target-unreachable',
    'needs-login',
    'login-in-progress',
    'initializing',
    'needs-cross-signing-setup',
    'needs-verification',
    'verification-in-progress',
    'needs-recovery-key',
    'needs-secrets',
    'needs-first-sync',
    'ready',
    'error',
  ])
  if (known.has(app.state as ReadinessState)) return app.state as ReadinessState
  if (app.verification?.state && app.state !== 'ready') return 'verification-in-progress'
  return 'error'
}

function actionsForState(state: ReadinessState): string[] {
  if (state === 'ready') return ['chats list', 'messages list', 'send text']
  if (state === 'no-target') return ['setup', 'targets add']
  if (state === 'target-unreachable') return ['status', 'targets runtime start', 'setup']
  if (state === 'error') return ['status', 'setup']
  return ['setup', 'status']
}

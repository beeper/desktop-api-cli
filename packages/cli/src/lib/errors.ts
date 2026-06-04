/**
 * Beeper CLI exit codes:
 *   1   generic runtime error
 *   2   usage error (parsing, missing required flag/arg, invalid combination)
 *   3   empty results when --fail-empty/--non-empty is set
 *   4   auth required or target not ready (inspect JSON error.code for auth_required vs not_ready)
 *   5   not found (selector matched nothing)
 *   6   ambiguous selector (multiple matches; use exact ID or --pick)
 *   127 user declined a selector suggestion (POSIX "command not found" semantics)
 */
export const ExitCodes = {
  Generic: 1,
  Usage: 2,
  EmptyResults: 3,
  AuthRequired: 4,
  NotReady: 4,
  NotFound: 5,
  Ambiguous: 6,
  CommandNotFound: 127,
} as const

type ExitCode = typeof ExitCodes[keyof typeof ExitCodes]

export class CLIError extends Error {
  readonly exitCode: ExitCode
  readonly tryMessage?: string
  readonly code?: string
  constructor(message: string, exitCode: ExitCode, tryMessage?: string, code?: string) {
    super(message)
    this.exitCode = exitCode
    this.tryMessage = tryMessage
    this.code = code
    this.name = 'CLIError'
  }
}

/**
 * Expected failure surfaced to the user (bad input, missing auth, network unreachable, etc).
 * Renders as a single-line red message. Do not include a stack trace.
 */
export class AbortError extends CLIError {
  constructor(message: string, exitCode: ExitCode = ExitCodes.Generic, tryMessage?: string, code?: string) {
    super(message, exitCode, tryMessage, code)
    this.name = 'AbortError'
  }
}

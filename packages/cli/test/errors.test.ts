import { describe, expect, it } from 'bun:test'
import { AbortError, CLIError, ExitCodes } from '../src/lib/errors.js'

describe('CLIError', () => {
  it('AbortError carries an explicit exit code', () => {
    const err = new AbortError('bad flag', ExitCodes.Usage)
    expect(err).toBeInstanceOf(CLIError)
    expect(err.exitCode).toBe(ExitCodes.Usage)
    expect(err.message).toBe('bad flag')
  })

  it('CLIError instances are Error subclasses', () => {
    const err = new CLIError('boom', ExitCodes.Generic)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('CLIError')
  })
})

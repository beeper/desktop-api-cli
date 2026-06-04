import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { writeResult } from '../src/cli/output.js'
import type { GlobalFlags } from '../src/cli/types.js'

const baseFlags: GlobalFlags = {
  account: [],
  color: 'auto',
  debug: false,
  dryRun: false,
  events: false,
  force: false,
  full: false,
  json: true,
  noInput: false,
  plain: false,
  readOnly: false,
  resultsOnly: true,
  wrapUntrusted: false,
}

describe('writeResult', () => {
  afterEach(() => {
    process.stdout.write = originalWrite
  })

  const originalWrite = process.stdout.write

  it('treats services as a primary JSON result envelope', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ services: [{ bridge_id: 'imessage', name: 'iMessage' }] }, baseFlags)

    expect(JSON.parse(stdout)).toEqual([{ bridge_id: 'imessage', name: 'iMessage' }])
  })

  it('unwraps config path for JSON results-only', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ path: '/tmp/beeper/config.json' }, baseFlags, {
      description: 'Print config file path',
      path: ['config', 'path'],
      risk: 'read',
      run: async () => undefined,
    })

    expect(JSON.parse(stdout)).toBe('/tmp/beeper/config.json')
  })

  it('unwraps config keys for JSON results-only', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ keys: ['defaultTarget', 'defaultAccount'] }, baseFlags, {
      description: 'List available config keys',
      path: ['config', 'keys'],
      risk: 'read',
      run: async () => undefined,
    })

    expect(JSON.parse(stdout)).toEqual(['defaultTarget', 'defaultAccount'])
  })

  it('unwraps auth accounts for JSON results-only', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ accounts: [{ target: 'desktop', authenticated: false }] }, baseFlags, {
      description: 'List stored target credentials',
      output: 'auth',
      path: ['auth', 'list'],
      risk: 'read',
      run: async () => undefined,
    })

    expect(JSON.parse(stdout)).toEqual([{ target: 'desktop', authenticated: false }])
  })

  it('unwraps targets for JSON results-only', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ targets: [{ id: 'desktop', type: 'desktop' }] }, baseFlags, {
      description: 'List configured Beeper targets',
      output: 'targets',
      path: ['targets', 'list'],
      risk: 'read',
      run: async () => undefined,
    })

    expect(JSON.parse(stdout)).toEqual([{ id: 'desktop', type: 'desktop' }])
  })

  it('does not unwrap status target fields for JSON results-only', () => {
    let stdout = ''
    spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk)
      return true
    })

    writeResult({ auth: { authenticated: false }, target: { id: 'desktop' } }, baseFlags, {
      description: 'Show selected target and setup readiness',
      path: ['status'],
      risk: 'read',
      run: async () => undefined,
    })

    expect(JSON.parse(stdout)).toEqual({ auth: { authenticated: false }, target: { id: 'desktop' } })
  })
})

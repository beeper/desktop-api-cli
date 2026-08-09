import { afterEach, describe, expect, it } from 'bun:test'
import { downloadURLFor, feedURLFor, installServer, normalizeInstallRequest } from '../src/lib/installations.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('server installation artifact selection', () => {
  it('uses the production stable Server artifact by default', () => {
    const request = normalizeInstallRequest({ kind: 'server', platform: 'linux', arch: 'x64' })

    expect(request.channel).toBe('stable')
    expect(request.serverEnv).toBe('production')
    expect(request.bundleID).toBe('com.automattic.beeper.server')
    expect(request.apiBaseURL).toBe('https://api.beeper.com')
    expect(feedURLFor(request)).toBe('https://api.beeper.com/desktop/update-feed.json?bundleID=com.automattic.beeper.server&platform=linux&channel=stable&arch=x64')
    expect(downloadURLFor(request)).toBe('https://api.beeper.com/desktop/download/linux/x64/stable/com.automattic.beeper.server')
  })

  it('keeps staging stable when staging is explicitly selected', () => {
    const request = normalizeInstallRequest({ kind: 'server', serverEnv: 'staging', channel: 'stable', platform: 'linux', arch: 'x64' })

    expect(request.channel).toBe('stable')
    expect(request.serverEnv).toBe('staging')
    expect(request.bundleID).toBe('com.automattic.beeper.server')
    expect(request.apiBaseURL).toBe('https://api.beeper-staging.com')
    expect(downloadURLFor(request)).toBe('https://api.beeper-staging.com/desktop/download/linux/x64/stable/com.automattic.beeper.server')
  })

  it('keeps nightly explicit instead of deriving it from the environment', () => {
    const request = normalizeInstallRequest({ kind: 'server', channel: 'nightly', platform: 'linux', arch: 'x64' })

    expect(request.channel).toBe('nightly')
    expect(request.serverEnv).toBe('production')
    expect(request.bundleID).toBe('com.automattic.beeper.server.nightly')
    expect(request.apiBaseURL).toBe('https://api.beeper.com')
    expect(downloadURLFor(request)).toBe('https://api.beeper.com/desktop/download/linux/x64/nightly/com.automattic.beeper.server.nightly')
  })

  it('fails closed when the selected Server feed has no artifact URL', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return calls === 1
        ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response('unexpected download', { status: 404, statusText: 'Not Found' })
    }

    await expect(installServer()).rejects.toThrow('Beeper Server stable update feed did not include an artifact URL; refusing to install a different channel.')
    expect(calls).toBe(1)
  })

  it('fails closed when the stable feed returns a nightly artifact', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return calls === 1
        ? Response.json({ url: 'https://downloads.beeper.com/beeper-server-nightly-4.3.23-linux-x64.tar.gz' })
        : new Response('unexpected download', { status: 404, statusText: 'Not Found' })
    }

    await expect(installServer()).rejects.toThrow('Beeper Server stable update feed returned a nightly artifact; refusing to install a different channel.')
    expect(calls).toBe(1)
  })
})

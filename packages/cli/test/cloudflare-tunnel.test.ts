import { describe, expect, it } from 'bun:test'
import { cloudflaredDomain, findKnownError, findTunnelURL, versionIsGreaterThan, whatToTry } from '../src/lib/cloudflare-tunnel.js'

describe('cloudflare tunnel helpers', () => {
  it('parses cloudflared output and versions', () => {
    expect(versionIsGreaterThan('2024.8.2', '2024.8.1')).toBe(true)
    expect(versionIsGreaterThan('2024.8.2', '2024.8.2')).toBe(false)
    expect(versionIsGreaterThan('2024.8.2', '2024.9.0')).toBe(false)
    expect(findTunnelURL('INF https://example.trycloudflare.com ready')).toBe('https://example.trycloudflare.com')
    expect(findTunnelURL('INF https://example.example.com ready', 'example.com')).toBe('https://example.example.com')
    expect(findTunnelURL('INF https://example.example.com ready')).toBeUndefined()
    expect(findKnownError('2024-01-01 ERR Failed to serve quic connection connIndex=1')).toMatch(/Could not start Cloudflare Tunnel/)
    expect(whatToTry()).toMatch(/BEEPER_CLOUDFLARED_PATH/)
  })

  it('allows overriding the parsed cloudflared domain', () => {
    const previous = process.env.BEEPER_CLOUDFLARED_DOMAIN
    process.env.BEEPER_CLOUDFLARED_DOMAIN = 'beeper.test'
    expect(cloudflaredDomain()).toBe('beeper.test')
    if (previous === undefined) delete process.env.BEEPER_CLOUDFLARED_DOMAIN
    else process.env.BEEPER_CLOUDFLARED_DOMAIN = previous
  })
})

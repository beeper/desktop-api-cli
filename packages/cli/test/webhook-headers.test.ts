import { describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import { webhookHeaders } from '../src/cli/commands.js'

describe('webhookHeaders', () => {
  it('includes Beeper and wacli-compatible signatures when a secret is set', () => {
    const body = '{"type":"message","messageID":"m1"}'
    const expected = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`

    expect(webhookHeaders(body, 'secret')).toEqual({
      'content-type': 'application/json',
      'x-beeper-signature': expected,
      'x-wacli-signature': expected,
    })
  })

  it('omits signature headers when no secret is set', () => {
    expect(webhookHeaders('{}')).toEqual({ 'content-type': 'application/json' })
  })
})

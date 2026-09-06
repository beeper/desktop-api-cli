import { expect, mock, test } from 'bun:test'
import type { Bridge } from '@beeper/desktop-api/resources/bridges.js'
import { resolveAccountType } from '../src/commands/accounts/add.js'
import { resolveBridge } from '../src/commands/bridges/show.js'

const bridge = (id: string, displayName: string, provider: 'cloud' | 'local'): Bridge => ({
  id, displayName, provider, network: displayName.toLowerCase(), type: displayName.toLowerCase(), status: 'available',
} as Bridge)
const cloud = bridge('whatsapp', 'WhatsApp', 'cloud')
const local = bridge('local-whatsapp', 'WhatsApp', 'local')

test('accounts add gives literal bridge IDs priority', () => {
  for (const items of [[cloud, local], [local, cloud]]) {
    expect(resolveAccountType(items, 'whatsapp')).toBe(cloud)
    expect(resolveAccountType(items, 'local-whatsapp')).toBe(local)
  }
  expect(resolveAccountType([
    bridge('local-instagram', 'Instagram', 'local'),
    bridge('instagramgo', 'Instagram', 'cloud'),
  ], 'instagramgo').id).toBe('instagramgo')
  expect(() => resolveAccountType([cloud, local], 'signal')).toThrow('Unknown bridge "signal"')

  const createSession = mock(() => undefined)
  expect(() => createSession(resolveAccountType([cloud, local], 'WhatsApp').id))
    .toThrow('Account type WhatsApp is ambiguous')
  expect(createSession).not.toHaveBeenCalled()
})

test('bridges show gives unnormalized literal IDs priority', () => {
  for (const items of [[cloud, local], [local, cloud]]) {
    expect(resolveBridge(items, 'whatsapp')).toBe(cloud)
    expect(resolveBridge(items, 'local-whatsapp')).toBe(local)
  }
  const dashed = bridge('a-b', 'First', 'cloud')
  const compact = bridge('ab', 'Second', 'local')
  expect(resolveBridge([dashed, compact], 'a-b')).toBe(dashed)
  expect(resolveBridge([dashed, compact], 'ab')).toBe(compact)
})

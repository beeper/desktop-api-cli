import { describe, expect, it } from 'bun:test'
import { listAccountIDs, resolveAccountID } from '../src/lib/resolve.js'

const clientWithAccounts = (accounts: unknown[]) => ({
  accounts: {
    list: async () => accounts,
  },
})

describe('account resolution', () => {
  it('uses accountID when present', async () => {
    const client = clientWithAccounts([{ accountID: 'whatsapp-main', network: 'whatsapp' }])

    expect(await resolveAccountID(client, 'whatsapp')).toBe('whatsapp-main')
    expect(await listAccountIDs(client)).toEqual(['whatsapp-main'])
  })

  it('falls back to id when accountID is absent', async () => {
    const client = clientWithAccounts([{ id: 'matrix-main', network: 'matrix' }])

    expect(await resolveAccountID(client, 'matrix')).toBe('matrix-main')
    expect(await listAccountIDs(client)).toEqual(['matrix-main'])
  })
})

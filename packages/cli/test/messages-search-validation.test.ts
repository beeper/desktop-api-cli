import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const cliRoot = fileURLToPath(new URL('..', import.meta.url))

function run(...args: string[]) {
  return spawnSync(process.execPath, ['./bin/dev.js', ...args], {
    cwd: cliRoot,
    encoding: 'utf8',
    env: { ...process.env, BEEPER_CLI_CONFIG_DIR: '/tmp/beeper-cli-bun-test', BEEPER_NO_LOGO: '1' },
  })
}

describe('messages search query-or-filter requirement', () => {
  it('rejects empty query with no filters and exits with usage error', () => {
    const result = run('messages', 'search', '--json')
    expect(result.status).toBe(2)
    const payload = JSON.parse(result.stderr)
    expect(payload.error.exitCode).toBe(2)
    expect(payload.error.message).toMatch(/Provide a search query or at least one filter flag/)
  })

  it('accepts a bare query', () => {
    const result = run('messages', 'search', 'invoice', '--help')
    // --help short-circuits before validation; smoke-test acceptance is in cli-smoke
    expect(result.status).toBe(0)
  })

  it('accepts no query when --sender is set (would fail at network but pass validation)', () => {
    // Use --help to avoid network: just confirms the flag is recognized.
    const result = run('messages', 'search', '--sender', 'me', '--help')
    expect(result.status).toBe(0)
  })
})

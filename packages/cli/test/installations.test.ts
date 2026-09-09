import { expect, it } from 'bun:test'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadArtifact } from '../src/lib/installations.js'

it('installs a complete download on the destination filesystem', async () => {
  // The checkout can be on a different filesystem from the system temp directory.
  const destination = await mkdtemp(join(fileURLToPath(new URL('..', import.meta.url)), '.download-test-'))
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => new Response('server artifact'),
  })
  try {
    const artifact = await downloadArtifact(new URL('/beeper-server.tar.gz', server.url).href, destination)

    expect(artifact).toBe(join(destination, 'beeper-server.tar.gz'))
    expect(await readFile(artifact, 'utf8')).toBe('server artifact')
    expect(await readdir(destination)).toEqual(['beeper-server.tar.gz'])
  } finally {
    server.stop(true)
    await rm(destination, { recursive: true, force: true })
  }
})

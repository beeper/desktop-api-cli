import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { WebSocketServer } from 'ws'

const cliRoot = join(import.meta.dir, '..')

describe('watch target selection', () => {
  it('uses the selected target base URL and token', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'beeper-cli-watch-target-'))
    const targetsDir = join(configDir, 'targets')
    mkdirSync(targetsDir)

    const first = await startTargetServer()
    const second = await startTargetServer()
    writeFileSync(join(configDir, 'config.json'), JSON.stringify({ defaultTarget: 'first' }))
    writeFileSync(join(targetsDir, 'first.json'), JSON.stringify({
      id: 'first',
      type: 'remote',
      baseURL: first.baseURL,
      auth: { accessToken: 'first-token', tokenType: 'Bearer' },
    }))
    writeFileSync(join(targetsDir, 'second.json'), JSON.stringify({
      id: 'second',
      type: 'remote',
      baseURL: second.baseURL,
      auth: { accessToken: 'second-token', tokenType: 'Bearer' },
    }))

    const env = { ...process.env, BEEPER_CLI_CONFIG_DIR: configDir, BEEPER_NO_LOGO: '1' }
    delete env.BEEPER_ACCESS_TOKEN

    try {
      const result = await runCli(env)

      expect(result.status).toBe(0)
      expect(first.infoRequests).toBe(0)
      expect(first.authorization).toBeUndefined()
      expect(second.infoRequests).toBe(1)
      expect(second.authorization).toBe('Bearer second-token')
    } finally {
      await first.close()
      await second.close()
      rmSync(configDir, { recursive: true, force: true })
    }
  }, 20_000)
})

type TargetServer = {
  baseURL: string
  infoRequests: number
  authorization?: string
  close: () => Promise<void>
}

async function runCli(env: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return await new Promise(resolve => {
    const child = spawn(process.execPath, ['./bin/dev.js', 'watch', '--target', 'second', '--json'], {
      cwd: cliRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill()
      finish(null)
    }, 10_000)
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    child.once('error', () => finish(null))
    child.once('close', code => finish(code))

    function finish(status: number | null): void {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({ status, stdout, stderr })
    }
  })
}

async function startTargetServer(): Promise<TargetServer> {
  let infoRequests = 0
  let authorization: string | undefined
  const httpServer = createServer((request, response) => {
    if (request.url !== '/v1/info') {
      response.writeHead(404)
      response.end()
      return
    }
    infoRequests++
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ endpoints: { ws_events: '/v1/ws' } }))
  })
  const websocketServer = new WebSocketServer({ server: httpServer, path: '/v1/ws' })
  websocketServer.on('connection', (socket, request) => {
    authorization = request.headers.authorization
    socket.close(1000)
  })
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(0, '127.0.0.1', () => resolve())
  })
  const address = httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Target server did not bind to a TCP port')

  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    get infoRequests() { return infoRequests },
    get authorization() { return authorization },
    close: async () => {
      for (const client of websocketServer.clients) client.terminate()
      httpServer.closeAllConnections?.()
      await new Promise<void>(resolve => httpServer.close(() => resolve()))
    },
  }
}

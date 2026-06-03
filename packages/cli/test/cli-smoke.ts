import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const configDir = '/tmp/beeper-cli-smoke'
rmSync(configDir, { recursive: true, force: true })

const run = (...args: string[]) => spawnSync('bun', ['./bin/dev.js', ...args], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
})

const ok = (...args: string[]) => {
  const result = run(...args)
  assert.equal(result.status, 0, `${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  return result.stdout
}

assert.match(ok('--help'), /Usage: beeper <command>/)
assert.match(ok('--help'), /targets add/)
assert.match(ok('--help'), /targets runtime start\s+Start a local target runtime/)
assert.match(ok('--help'), /targets runtime stop\s+Stop a local server runtime/)
assert.match(ok('--help'), /targets runtime restart\s+Restart a local server runtime/)
assert.match(ok('--help'), /targets tunnel/)
assert.match(ok('--help'), /use account\s+Select the default account/)
assert.match(ok('--help'), /use target\s+Select the default target/)
assert.match(ok('--help'), /remove account\s+Remove an account/)
assert.match(ok('--help'), /remove target\s+Remove a target/)
assert.match(ok('--help'), /auth email start\s+Start email sign-in for a target/)
assert.match(ok('--help'), /auth email response\s+Finish email sign-in for a target/)
assert.match(ok('--help'), /install desktop\s+Install Beeper Desktop locally/)
assert.match(ok('--help'), /install server\s+Install Beeper Server locally/)
assert.match(ok('--help'), /accounts list/)
assert.match(ok('--help'), /accounts add/)
assert.match(ok('--help'), /messages list/)
assert.match(ok('--help'), /chats archive\s+Archive or unarchive a chat/)
assert.match(ok('--help'), /chats disappear\s+Set a disappearing-message timer/)
assert.match(ok('--help'), /chats priority\s+Set chat priority/)
assert.match(ok('--help'), /chats focus\s+Focus a chat in Beeper/)
assert.match(ok('--help'), /chats notify-anyway\s+Notify a chat anyway/)
assert.match(ok('--help'), /messages context/)
assert.match(ok('--help'), /messages edit\s+Edit a message/)
assert.match(ok('--help'), /messages delete\s+Delete a message/)
assert.match(ok('--help'), /api request/)
assert.match(ok('--help'), /send text\s+Send a text message/)
assert.match(ok('--help'), /send file\s+Send a file message/)
assert.match(ok('--help'), /send sticker\s+Send a sticker/)
assert.match(ok('--help'), /send voice\s+Send a voice note/)
assert.match(ok('--help'), /send react\s+Send or remove a reaction/)
assert.match(ok('--help'), /send presence\s+Send a typing indicator/)
assert.match(ok('--help'), /resolve account\s+Resolve an account selector/)
assert.match(ok('--help'), /resolve bridge\s+Resolve a bridge selector/)
assert.match(ok('--help'), /resolve chat\s+Resolve a chat selector/)
assert.match(ok('--help'), /resolve contact\s+Resolve a contact selector/)
assert.match(ok('--help'), /resolve target\s+Resolve a target selector/)
assert.match(ok('--help'), /watch/)
assert.match(ok('--help'), /media download/)
assert.match(ok('--help'), /export\s+Export accounts/)
assert.match(ok('setup', '--help'), /--remote/)
assert.match(ok('targets', 'tunnel', '--help'), /--url-only/)
assert.match(ok('accounts', 'add', '--help'), /--webview-backend/)
assert.match(ok('watch', '--help'), /--include-type/)
assert.match(ok('send', 'presence', '--help'), /--state/)
assert.match(ok('media', 'download', '--help'), /--out/)
assert.match(ok('export', '--help'), /--no-attachments/)

const version = JSON.parse(ok('version', '--json'))
assert.equal(version.name, 'beeper-cli')
assert.match(version.version, /^\d+\.\d+\.\d+/)

let result = run('version', '--json', '--plain')
assert.equal(result.status, 2)
let errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /cannot combine --json and --plain/)

result = run('messages', 'list', '--limit', '12abc', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--limit must be an integer/)

result = run('messages', 'list', '--limit=', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--limit must be an integer/)

result = run('messages', 'list', '--limit', '1e2', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--limit must be an integer/)

let payload = JSON.parse(ok('targets', 'list', '--json'))
assert.equal(payload[0].id, 'desktop')
assert.equal(existsSync(join(configDir, 'config.json')), false)
assert.equal(existsSync(join(configDir, 'targets')), false)

payload = JSON.parse(ok('use', 'target', 'desktop', '--json'))
assert.equal(payload.defaultTarget, 'desktop')

result = run('--safety-profile', 'readonly', 'use', 'target', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'targets', 'tunnel', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'use', 'account', 'matrix', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'remove', 'target', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'send', 'text', '--to', 'chat', '--message', 'hello', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'chats', 'archive', '--chat', 'chat', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'accounts', 'add', 'matrix', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'send', 'presence', '--to', 'chat', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'media', 'download', 'mxc://server/file', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('--safety-profile', 'readonly', 'export', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /blocked by safety profile "readonly"/)

result = run('targets', 'add', 'desktop', 'http://127.0.0.1:23374', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /reserved/)

result = run('targets', 'add', 'work', 'http://127.0.0.1:23373', '--default', '--json')
assert.equal(result.status, 0, result.stderr)
payload = JSON.parse(result.stdout)
assert.equal(payload.target.id, 'work')
assert.equal(payload.target.type, 'remote')

payload = JSON.parse(ok('use', 'target', 'work', '--json'))
assert.equal(payload.defaultTarget, 'work')

payload = JSON.parse(ok('status', '--json'))
assert.equal(payload.auth.authenticated, false)
assert.equal(payload.target.id, 'work')

payload = JSON.parse(ok('auth', 'logout', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')

payload = JSON.parse(ok('auth', 'email', 'start', '--email', 'qa@example.invalid', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.start')

payload = JSON.parse(ok('auth', 'email', 'response', '--setup-request-id', 'setup-1', '--code', '123456', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.response')

payload = JSON.parse(ok('install', 'desktop', '--server-env', 'staging', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'install.desktop')
assert.equal(payload.request.serverEnv, 'staging')

payload = JSON.parse(ok('install', 'server', '--server-env', 'staging', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'install.server')
assert.equal(payload.request.serverEnv, 'staging')

payload = JSON.parse(ok('targets', 'runtime', 'start', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'targets.runtime.start')
assert.equal(payload.request.target.id, 'work')
assert.equal(payload.request.target.auth, undefined)

payload = JSON.parse(ok('targets', 'runtime', 'stop', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'targets.runtime.stop')
assert.equal(payload.request.target.id, 'work')

payload = JSON.parse(ok('targets', 'runtime', 'restart', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'targets.runtime.restart')
assert.equal(payload.request.target.id, 'work')

result = run('targets', 'runtime', 'bogus', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /unknown command "targets runtime bogus"/)

payload = JSON.parse(ok('targets', 'tunnel', 'work', '--retries', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'targets.tunnel')
assert.equal(payload.request.target, 'work')
assert.equal(payload.request.retries, 1)

payload = JSON.parse(ok('remove', 'target', 'work', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'remove.target')
assert.equal(payload.request.id, 'work')

payload = JSON.parse(ok('api', 'request', 'POST', '/v1/example', '--body', '{"ok":true}', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.body.ok, true)

payload = JSON.parse(ok('api', 'request', 'GET', '/v1/example', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.method, 'GET')

payload = JSON.parse(ok('send', 'voice', '--to', 'chat', '--file', './note.ogg', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.voice')
assert.equal(payload.request.chat, 'chat')

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello', '--mention', 'user1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.mentions[0], 'user1')

payload = JSON.parse(ok('send', 'react', '--to', 'chat', '--id', 'm1', '--reaction', '+1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.reactionKey, '+1')

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--seconds', 'off', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageExpirySeconds, null)

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--seconds', '3600', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.messageExpirySeconds, 3600)

result = run('chats', 'disappear', '--chat', 'chat', '--seconds', '1e2', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--seconds must be a positive integer or "off"/)

payload = JSON.parse(ok('chats', 'priority', '--chat', 'chat', '--level', 'low', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')

payload = JSON.parse(ok('chats', 'focus', '--chat', 'chat', '--text', 'draft', '--file', './draft.txt', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.focus')
assert.equal(payload.request.draftText, 'draft')
assert.equal(payload.request.draftAttachmentPath, './draft.txt')

payload = JSON.parse(ok('chats', 'notify-anyway', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.notify-anyway')

result = run('chats', 'notify-anyway', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--chat is required/)

payload = JSON.parse(ok('messages', 'context', '--chat', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'edit', '--chat', 'chat', '--id', 'm1', '--message', 'edited', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.edit')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.text, 'edited')

payload = JSON.parse(ok('messages', 'delete', '--chat', 'chat', '--id', 'm1', '--for-everyone', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.delete')
assert.equal(payload.request.forEveryone, true)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('export', '--chat', 'chat', '--out', '/tmp/beeper-export', '--limit-messages', '10', '--no-attachments', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'export')
assert.equal(payload.request.outDir, '/tmp/beeper-export')

payload = JSON.parse(ok('send', 'presence', '--to', 'chat', '--duration', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.presence')
assert.equal(payload.request.durationSeconds, 1)

payload = JSON.parse(ok('media', 'download', 'mxc://server/file', '--out', '/tmp', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.out, '/tmp')

payload = JSON.parse(ok('export', '--out', '/tmp/beeper-export', '--limit-chats', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'export')
assert.equal(payload.request.outDir, '/tmp/beeper-export')
assert.equal(payload.request.limitChats, 1)

payload = JSON.parse(ok('--safety-profile', 'readonly', 'resolve', 'target', 'desktop', '--json'))
assert.equal(payload.kind, 'target')
assert.equal(payload.selected.id, 'desktop')

payload = JSON.parse(ok('targets', 'list', '--json'))
assert.equal(payload[0].id, 'work')

const schema = JSON.parse(ok('schema', '--json'))
assert.equal(schema.schema_version, 1)
assert.equal(schema.command.type, 'application')

const mcp = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n',
})
assert.equal(mcp.status, 0, mcp.stderr)
payload = JSON.parse(mcp.stdout)
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'targets_list'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_search'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'contacts_list'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'api_request'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'resolve_target'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'resolve_chat'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_context'))

const mcpInitialize = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n',
})
assert.equal(mcpInitialize.status, 0, mcpInitialize.stderr)
payload = JSON.parse(mcpInitialize.stdout)
assert.equal(payload.result.serverInfo.name, 'beeper')
assert.equal(payload.result.serverInfo.version, version.version)

const mcpCall = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"version","arguments":{}}}\n',
})
assert.equal(mcpCall.status, 0, mcpCall.stderr)
payload = JSON.parse(mcpCall.stdout)
const mcpVersion = JSON.parse(payload.result.content[0].text)
assert.match(mcpVersion.name, /beeper-cli/)
assert.equal(mcpVersion.version, version.version)

const mcpEOFCall = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"version","arguments":{}}}',
})
assert.equal(mcpEOFCall.status, 0, mcpEOFCall.stderr)
payload = JSON.parse(mcpEOFCall.stdout)
assert.equal(payload.id, 4)
assert.equal(JSON.parse(payload.result.content[0].text).version, version.version)

const mcpDryRunCall = spawnSync('bun', ['./bin/dev.js', '--dry-run', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"messages_context","arguments":{"chat":"chat","id":"m1","after":"3","before":"4"}}}\n',
})
assert.equal(mcpDryRunCall.status, 0, mcpDryRunCall.stderr)
payload = JSON.parse(mcpDryRunCall.stdout)
const mcpContext = JSON.parse(payload.result.content[0].text)
assert.equal(mcpContext.dry_run, true)
assert.equal(mcpContext.request.after, 3)
assert.equal(mcpContext.request.before, 4)

const mcpInvalidJSON = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{bad json}\n',
})
assert.equal(mcpInvalidJSON.status, 0, mcpInvalidJSON.stderr)
payload = JSON.parse(mcpInvalidJSON.stdout)
assert.equal(payload.jsonrpc, '2.0')
assert.equal(payload.error.code, -32000)
assert.match(payload.error.message, /JSON/)

rmSync(configDir, { recursive: true, force: true })

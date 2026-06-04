import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const configDir = '/tmp/beeper-cli-smoke'
const homeConfigDir = '/tmp/beeper-cli-smoke-home'
rmSync(configDir, { recursive: true, force: true })
rmSync(homeConfigDir, { recursive: true, force: true })

const run = (...args: string[]) => spawnSync('bun', ['./bin/dev.js', ...args], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_HOME: configDir,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  maxBuffer: 16 * 1024 * 1024,
})

const ok = (...args: string[]) => {
  const result = run(...args)
  assert.equal(result.status, 0, `${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  return result.stdout
}

const assertOrderedItems = (text: string, expected: string[]) => {
  const items = text.trim().split('\n')
  let start = 0
  for (const item of expected) {
    const index = items.indexOf(item, start)
    assert.notEqual(index, -1, `missing completion item ${item}`)
    start = index + 1
  }
}

const runEnv = (env: Record<string, string>, ...args: string[]) => spawnSync('bun', ['./bin/dev.js', ...args], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_HOME: configDir,
    BEEPER_CLI_CONFIG_DIR: configDir,
    ...env,
  },
  maxBuffer: 16 * 1024 * 1024,
})

const rootHelp = ok('--help')
assert.match(rootHelp, /Usage: beeper <command>/)
assert.match(rootHelp, /Build: 0\.6\.2/)
assert.match(rootHelp, /Flags:\n/)
assert.match(rootHelp, /Commands:\n/)
assert.match(rootHelp, /Commands:\n  message \(msg\)[\s\S]*\n  ls \(list\) \[flags\][\s\S]*\n  search \(find\)[\s\S]*\n  open \(browse,focus\)[\s\S]*\n  download \(dl\)[\s\S]*\n  upload \(up,put\)/)
assert.match(rootHelp, /accounts \(account\) <command> \[flags\]\n    Manage connected chat accounts/)
assert.match(rootHelp, /targets \(target\) <command> \[flags\]\n    Manage Beeper Desktop and Server targets/)
assert.doesNotMatch(rootHelp, /\n  use <command> \[flags\]/)
assert.doesNotMatch(rootHelp, /\n  remove <command> \[flags\]/)
assert.match(rootHelp, /auth <command> \[flags\]\n    Authenticate and manage stored credentials/)
assert.match(rootHelp, /login \(auth add,auth login\) <email> \[flags\]\n    Start email sign-in for a target/)
assert.match(rootHelp, /logout \[<target>\] \[flags\]\n    Clear stored authentication \(alias for 'auth logout'\)/)
assert.match(rootHelp, /me \(whoami,who-am-i\) \[flags\]\n    Show selected account and target identity/)
assert.match(rootHelp, /whoami \(who-am-i\) \[flags\]\n    Show selected account and target identity \(alias for 'me'\)/)
assert.match(rootHelp, /install <command> \[flags\]\n    Install Beeper Desktop or Beeper Server/)
assert.match(rootHelp, /accounts \(account\) <command> \[flags\]\n    Manage connected chat accounts/)
assert.match(rootHelp, /agent <command> \[flags\]\n    Agent-friendly helpers/)
assert.match(rootHelp, /help \[<command> \.\.\.\] \[flags\]\n    Show help for a command/)
assert.match(rootHelp, /messages <command> \[flags\]\n    List, search, edit, and delete messages/)
assert.match(rootHelp, /chats \(chat\) <command> \[flags\]\n    List and manage chats/)
assert.match(rootHelp, /groups \(group\) <command> \[flags\]\n    List and manage group chats/)
assert.match(rootHelp, /api <command> \[flags\]\n    Call raw Beeper Desktop API endpoints/)
assert.match(rootHelp, /send \[<to>\] \[<message> \.\.\.\] \[flags\]\n    Send a text message/)
assert.match(rootHelp, /message \(msg\) \[<to>\] \[<message> \.\.\.\] \[flags\]\n    Send a text message \(alias for 'send text'\)/)
assert.match(rootHelp, /presence <command> \[flags\]\n    Send presence indicators/)
assert.match(rootHelp, /resolve <command> \[flags\]\n    Resolve Beeper selectors/)
assert.match(rootHelp, /watch \[flags\]/)
assert.match(rootHelp, /download \(dl\) \[<url>\] \[flags\]\n    Download message media \(alias for 'media download'\)/)
assert.match(rootHelp, /upload \(up,put\) <localPath> \[flags\]\n    Send a file message/)
assert.match(rootHelp, /ls \(list\) \[flags\]\n    List chats \(alias for 'chats list'\)/)
assert.match(rootHelp, /search \(find\) \[<query>\] \[flags\]\n    Search messages across chats \(alias for 'messages search'\)/)
assert.match(rootHelp, /open \(browse,focus\) \[<chat>\] \[flags\]\n    Focus a chat in Beeper \(alias for 'chats focus'\)/)
assert.match(rootHelp, /export \[flags\]\n    Export accounts/)
assert.match(rootHelp, /doctor \(auth doctor\) \[flags\]\n    Run diagnostics/)
assert.match(rootHelp, /docs \(help-docs\) \[flags\]\n    Print command documentation locations/)
assert.match(rootHelp, /exit-codes \(agent exit-codes,agent exitcodes,agent exit-code,exitcodes\) \[flags\]\n    Print stable exit codes/)
assert.doesNotMatch(rootHelp, /targets runtime start \[<name>\] \[flags\]/)
assert.doesNotMatch(rootHelp, /messages delete \[flags\]/)
assert.doesNotMatch(rootHelp, /send text \(message,msg\)/)
assert.doesNotMatch(rootHelp, /\n  dl <url> \[flags\]/)
assert.doesNotMatch(rootHelp, /\n  find \[<query>\] \[flags\]/)
assert.doesNotMatch(rootHelp, /\n  focus \[flags\]/)
assert.doesNotMatch(rootHelp, /\n  msg \[<to>\] \[<message> \.\.\.\] \[flags\]/)
assert.doesNotMatch(rootHelp, /Send a typing indicator \(alias for 'send presence'\)/)
assert.match(rootHelp, /Config:\n\n    file: /)
assert.match(rootHelp, /    root: \/tmp\/beeper-cli-smoke \(source: BEEPER_HOME\)/)
assert.match(rootHelp, /Flags:\n  -h, --help\s+Show context-sensitive help/)
assert.match(rootHelp, /config <command> \[flags\]\n    Manage configuration/)
assert.match(rootHelp, /-h, --help\s+Show context-sensitive help/)
assert.match(rootHelp, /--full\s+Disable truncation in human table output/)
assert.match(rootHelp, /--lock-wait=STRING\s+Accepted for compatibility/)
assert.match(rootHelp, /--read-only \(\-\-readonly\).*Reject commands/)
assert.match(rootHelp, /\(\$BEEPER_READONLY\)/)
assert.match(rootHelp, /--home=STRING \(\-\-store\).*Override Beeper CLI/)
assert.match(rootHelp, /\(\$BEEPER_HOME,\$BEEPER_STORE_DIR,\$BEEPER_CLI_CONFIG_DIR\)/)
assert.match(rootHelp, /-v, --verbose \(\-\-debug\).*Enable verbose logging/)
assert.match(rootHelp, /\(\$BEEPER_DEBUG\)/)
assert.match(rootHelp, /--color="auto".*Color output/)
assert.match(rootHelp, /\(\$BEEPER_COLOR\)/)
assert.match(rootHelp, /--select=STRING \(\-\-fields, --project\).*In JSON mode/)
assert.match(rootHelp, /\(\$BEEPER_SELECT,\$BEEPER_FIELDS,\$BEEPER_PROJECT\)/)
assert.match(rootHelp, /--enable-commands=STRING.*Comma-separated enabled command prefixes/)
assert.match(rootHelp, /\(\$BEEPER_ENABLE_COMMANDS\)/)
assert.match(rootHelp, /--json .*?Output JSON to stdout \(best for scripting\)/)
assert.match(rootHelp, /\(\$BEEPER_JSON\)/)
assert.match(rootHelp, /--plain .*?Output stable, parseable text to stdout/)
assert.match(rootHelp, /\(TSV-like; no colors\)/)
assert.match(rootHelp, /\(\$BEEPER_PLAIN\)/)
assert.match(rootHelp, /--events .*?Emit machine-readable NDJSON lifecycle events on stderr/)
assert.match(rootHelp, /--read-only[\s\S]*?Reject commands that intentionally write Beeper or local CLI\s+state/)
assert.match(rootHelp, /--enable-commands=[\s\S]*?dot paths allowed/)
assert.match(rootHelp, /--enable-commands-exact=[\s\S]*?parent commands do not\s+enable children/)
assert.equal(ok('version'), '0.6.2\n')
assert.match(ok('--version', '--json'), /"name": "beeper-cli"/)
assert.doesNotMatch(ok('-v'), /^0\.6\.2$/)
assert.equal(ok('--debug', 'version'), '0.6.2\n')
assert.match(ok('st'), /READINESS/)
assert.match(ok('doctor'), /SELECTED TARGET/)
assert.match(ok('doctor', '--connect'), /SELECTED TARGET/)
assert.match(ok('doctor', '--help'), /--connect\s+Accepted for compatibility/)
assert.match(ok('targets', 'ls'), /ID\s+DEFAULT\s+TYPE/)
assert.match(ok('ls', '--help'), /Usage: beeper chats list \(chats ls,chat list,chat ls,ls,list\) \[flags\]/)
const targetsHelp = ok('targets', '--help')
assert.match(targetsHelp, /Usage: beeper targets <command> \[flags\]/)
assert.match(targetsHelp, /Build: 0\.6\.2/)
assert.match(targetsHelp, /list \(ls\) \[flags\]\n    List configured Beeper targets/)
assert.match(targetsHelp, /runtime start \[<name>\] \[flags\]\n    Start a local target runtime/)
assert.match(targetsHelp, /Commands:\n  list \(ls\)[\s\S]*\n  use <selector>[\s\S]*\n  add <name> <url>[\s\S]*\n  remove \(rm,del\)[\s\S]*\n  logs \[<name>\][\s\S]*\n  runtime start[\s\S]*\n  runtime stop[\s\S]*\n  runtime restart[\s\S]*\n  tunnel/)
const sendHelp = ok('send', '--help')
assert.match(sendHelp, /Usage: beeper send \[<to>\] \[<message> \.\.\.\] \[flags\]/)
assert.match(sendHelp, /Build: 0\.6\.2/)
assert.match(sendHelp, /Arguments:\n  \[<to>\]\s+Chat selector/)
assert.match(sendHelp, /--message=STRING\s+Message text to send/)
assert.match(sendHelp, /text \[<to>\] \[<message> \.\.\.\] \[flags\]\n    Send a text message/)
assert.match(sendHelp, /Commands:\n  text[\s\S]*\n  file[\s\S]*\n  voice[\s\S]*\n  sticker[\s\S]*\n  react[\s\S]*\n  presence/)
const messagesHelp = ok('messages', '--help')
assert.match(messagesHelp, /Commands:\n  list \(ls\)[\s\S]*\n  search \(find\)[\s\S]*\n  context \[<id>\] \[flags\]\n    Show a message with surrounding context\n\n  show \(get,info\) \[<id>\] \[flags\]\n    Show one message\n\n  export \[flags\]\n    Export messages as JSON\n\n  forward \[<id>\] \[flags\]\n    Forward a message[\s\S]*\n  edit \(update,set\) \[<id>\] \[flags\]\n    Edit a message\n\n  delete \(rm,del,remove\) \[<id>\] \[flags\]\n    Delete a message\n\n  revoke \[<id>\] \[flags\]\n    Delete a sent message for everyone/)
const messagesListHelp = ok('messages', 'list', '--help')
assert.match(messagesListHelp, /--type=STRING\s+Only messages of this kind/)
assert.match(messagesListHelp, /--has-media\s+Only messages with media/)
assert.equal(existsSync(join(root, 'docs', 'commands', 'README.md')), true)
assert.equal(existsSync(join(root, 'docs', 'commands', 'send-text.md')), true)
const commandIndexDoc = readFileSync(join(root, 'docs', 'commands', 'README.md'), 'utf8')
assert.match(commandIndexDoc, /## Root Commands/)
assert.match(commandIndexDoc, /## Root Commands[\s\S]*\| `beeper message \(msg\)[\s\S]*\| `beeper ls \(list\) \[flags\]`[\s\S]*\| `beeper search \(find\)[\s\S]*\| `beeper open \(browse,focus\)[\s\S]*\| `beeper download \(dl\)[\s\S]*\| `beeper upload \(up,put\)/)
assert.match(commandIndexDoc, /\| `beeper whoami \(who-am-i\) \[flags\]` \| Show selected account and target identity \(alias for 'beeper me'\) \|/)
assert.match(commandIndexDoc, /\| `beeper search-all \(find-all\) <query> \[flags\]` \| Search chats, group participants, and messages together \(alias for 'beeper search all'\) \|/)
assert.match(commandIndexDoc, /\| `beeper targets \(target\) <command> \[flags\]` \| Manage Beeper Desktop and Server targets \|/)
assert.match(commandIndexDoc, /\| `beeper download \(dl\) \[<url>\] \[flags\]` \| Download message media \(alias for 'beeper media download'\) \|/)
assert.match(commandIndexDoc, /\| `beeper message \(msg\) \[<to>\] \[<message> \.\.\.\] \[flags\]` \| Send a text message \(alias for 'beeper send text'\) \|/)
assert.match(commandIndexDoc, /## Full Command Reference/)
const sendTextDoc = readFileSync(join(root, 'docs', 'commands', 'send-text.md'), 'utf8')
assert.match(sendTextDoc, /beeper send text \(message,msg\) \[<to>\] \[<message> \.\.\.\] \[flags\]/)
assert.match(sendTextDoc, /`\[<to>\]`/)
assert.match(sendTextDoc, /## Global Flags\n\n\| Name \| Description \|\n\| --- \| --- \|\n\| `-h, --help` \|/)
assert.match(sendTextDoc, /\| `-v, --verbose, --debug` \|[\s\S]*\| `--version` \|/)
assert.doesNotMatch(sendTextDoc, /\| `--version` \|[\s\S]*\| `-v, --verbose, --debug` \|/)
const mediaDownloadDoc = readFileSync(join(root, 'docs', 'commands', 'media-download.md'), 'utf8')
assert.match(mediaDownloadDoc, /beeper media download \(media dl,download,dl\) \[<url>\] \[flags\]/)
const targetsListDoc = readFileSync(join(root, 'docs', 'commands', 'targets-list.md'), 'utf8')
assert.match(targetsListDoc, /## JSON Output[\s\S]*Default JSON output is an object containing the `targets` field\.[\s\S]*`--json --results-only` to emit only `targets`/)
const authListDoc = readFileSync(join(root, 'docs', 'commands', 'auth-list.md'), 'utf8')
assert.match(authListDoc, /## JSON Output[\s\S]*Default JSON output is an object containing the `accounts` field\.[\s\S]*`--json --results-only` to emit only `accounts`/)
assert.match(mediaDownloadDoc, /`--out="\.", --output`/)
const rootCompletion = ok('__complete', '--cword', '1', '--', 'beeper', '')
assert.equal(rootCompletion.split('\n').slice(0, 3).join('\n'), '--access-token\n--account\n-a')
assertOrderedItems(rootCompletion, ['message', 'ls', 'search', 'open', 'download', 'upload'])
assertOrderedItems(rootCompletion, ['status', 'me', 'whoami', 'setup'])
assert.match(rootCompletion, /^me$/m)
const sendCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'send', '')
assert.equal(sendCompletion.split('\n').slice(0, 4).join('\n'), '--to\n--pick\n--reply-to\n--reply-to-sender')
assertOrderedItems(sendCompletion, ['text', 'file', 'voice', 'sticker', 'react', 'presence'])
const targetsCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'targets', '')
assertOrderedItems(targetsCompletion, ['list', 'use', 'add', 'remove', 'logs', 'runtime', 'tunnel'])
const accountsCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'accounts', '')
assertOrderedItems(accountsCompletion, ['list', 'show', 'add', 'use', 'remove'])
const contactsCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'contacts', '')
assertOrderedItems(contactsCompletion, ['list', 'show'])
const chatsCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'chats', '')
assertOrderedItems(chatsCompletion, ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread'])
const configCompletion = ok('__complete', '--cword', '2', '--', 'beeper', 'config', '')
assertOrderedItems(configCompletion, ['get', 'keys', 'set', 'unset', 'list', 'path'])
assert.match(ok('__complete', '--cword', '2', '--', 'beeper', 'targets', 'l'), /list/)
assert.match(ok('__complete', '--cword', '2', '--', 'beeper', 'targets', ''), /^rm$/m)
assert.match(ok('__complete', '--cword', '2', '--', 'beeper', 'targets', ''), /^use$/m)
assertOrderedItems(ok('__complete', '--cword', '2', '--', 'beeper', 'presence', ''), ['typing', 'paused'])
assert.doesNotMatch(ok('__complete', '--cword', '2', '--', 'beeper', 'targets', ''), /^target$/m)
assert.match(ok('__complete', '--cword', '2', '--', 'beeper', 'remove', ''), /^target$/m)
assert.match(ok('__complete', '--cword', '1', '--', 'beeper', 'l'), /ls/)
assert.match(ok('__complete', '--cword', '1', '--', 'beeper', 'se'), /search/)
assert.match(ok('__complete', '--cword', '1', '--', 'beeper', '--no-r'), /--no-read-only/)
assert.doesNotMatch(ok('__complete', '--cword', '1', '--', 'beeper', '--no-h'), /--no-help/)
assert.doesNotMatch(ok('__complete', '--cword', '1', '--', 'beeper', '--no-n'), /--no-no-input/)
assert.match(ok('__complete', '--cword', '2', '--', 'beeper', '--color', ''), /always/)
assert.doesNotMatch(ok('__complete', '--cword', '2', '--', 'beeper', '--color', 'ne'), /always/)
assert.match(ok('__complete', '--cword', '4', '--', 'beeper', 'send', 'presence', '--state', ''), /paused/)
assert.match(ok('__complete', '--cword', '4', '--', 'beeper', 'send', 'presence', '--state', 'ty'), /typing/)
assert.match(ok('__complete', '--cword', '3', '--', 'beeper', 'send', 'text', '--m'), /--message-file/)
assert.doesNotMatch(ok('--read-only', '__complete', '--cword', '2', '--', 'beeper', 'send', ''), /text/)
assert.doesNotMatch(runEnv({ BEEPER_ENABLE_COMMANDS: 'messages' }, '__complete', '--cword', '2', '--', 'beeper', 'targets', '').stdout, /list/)
const bashCompletion = ok('completion', 'bash')
assert.match(bashCompletion, /^#!\/usr\/bin\/env bash/)
assert.match(bashCompletion, /local IFS=\$'\\n'/)
assert.match(bashCompletion, /COMPREPLY=\(\)/)
assert.match(bashCompletion, /if \[\[ -n "\$completions" \]\]; then/)
assert.match(bashCompletion, /__complete/)
assert.match(ok('completion', '--help'), /Commands:\n  bash \[flags\]\n    Generate the autocompletion script for bash/)
assert.match(ok('completion', '--help'), /powershell \(pwsh\) \[flags\]\n    Generate the autocompletion script for powershell/)
assert.match(ok('completion', 'zsh', '--help'), /--no-descriptions/)
assert.match(ok('completion', 'bash', '--no-descriptions'), /__complete/)
const zshCompletion = ok('completion', 'zsh')
assert.match(zshCompletion, /^#compdef beeper/)
assert.match(zshCompletion, /_describe 'values' completions/)
assert.match(zshCompletion, /compdef _beeper beeper/)
const fishCompletion = ok('completion', 'fish')
assert.match(fishCompletion, /function __beeper_complete/)
assert.match(fishCompletion, /set -l cur \(commandline -ct\)/)
assert.match(fishCompletion, /set words \$words \$cur/)
assert.match(fishCompletion, /set -l cword \(math \(count \$words\) - 1\)/)
assert.match(fishCompletion, /complete -c beeper -f -a "\(__beeper_complete\)"/)
const pwshCompletion = ok('completion', 'pwsh')
assert.match(pwshCompletion, /Register-ArgumentCompleter -CommandName beeper/)
assert.match(pwshCompletion, /\$commandAst\.CommandElements/)
assert.match(pwshCompletion, /\$completions = beeper __complete --cword \$cword -- \$elements/)
assert.match(pwshCompletion, /foreach \(\$completion in \$completions\)/)
assert.match(ok('agent', '--help'), /Agent-friendly helpers/)
assert.match(ok('agent', '--help'), /Commands:\n  exit-codes \(exitcodes,exit-code\) \[flags\]\n    Print stable exit codes/)
assert.match(ok('--help'), /completion <shell> \[flags\]\n    Generate shell completion scripts/)
assert.match(ok('help'), /Usage: beeper <command>/)
assert.match(ok('help', 'send', 'text'), /Usage: beeper send text/)
assert.match(ok('help', '--help'), /Arguments:\n  \[<command> \.\.\.\]/)
assert.match(ok('schema', '--help'), /Usage: beeper schema \(help-json,helpjson\) \[<command> \.\.\.\] \[flags\]/)
assert.match(ok('schema', '--help'), /Optional command path to describe\. Default: entire CLI/)
assert.match(ok('message', '--help'), /Usage: beeper send text \(message,msg\) \[<to>\] \[<message> \.\.\.\] \[flags\]/)
assert.match(ok('msg', '--help'), /Arguments:\n  \[<to>\]\s+Chat selector/)
assert.match(ok('msg', '--help'), /\[<message> \.\.\.\]\s+Message text/)
assert.match(ok('help', 'targets ls'), /Usage: beeper targets list/)
assert.match(ok('help', 'targets'), /Commands:\n(?:.*\n)*  list \(ls\) \[flags\]\n    List configured Beeper targets/)
assert.match(ok('targets', '--help'), /Usage: beeper targets <command> \[flags\]/)
assert.match(ok('targets', '--help'), /Manage Beeper Desktop and Server targets/)
assert.match(ok('targets', '--help'), /Commands:\n(?:.*\n)*  list \(ls\) \[flags\]\n    List configured Beeper targets/)
assert.match(ok('targets', '--help'), /remove \(rm,del\) <selector> \[flags\]\n    Remove a target/)
assert.match(ok('targets', '--help'), /use <selector> \[flags\]\n    Select the default target/)
assert.match(ok('targets', 'add', '--help'), /<name>\s+Target name\n  <url>\s+Target base URL/)
assert.match(ok('api', 'request', '--help'), /<method>\s+HTTP method: GET, POST, PUT, PATCH, or DELETE\n  <path>\s+Desktop API path, for example \/v1\/info/)
assert.match(ok('--help'), /chats \(chat\) <command> \[flags\]/)
assert.match(ok('--help'), /groups \(group\) <command> \[flags\]/)
assert.match(ok('--help'), /accounts \(account\) <command> \[flags\]/)
assert.match(ok('--help'), /contacts \(contact\) <command> \[flags\]/)
assert.match(ok('--help'), /targets \(target\) <command> \[flags\]/)
assert.match(ok('chat', '--help'), /Usage: beeper chat <command> \[flags\]/)
assert.match(ok('account', '--help'), /Commands:\n  list \(ls\) \[flags\]\n    List connected accounts/)
assert.match(ok('accounts', '--help'), /Commands:\n  list \(ls\) \[flags\]\n    List connected accounts\n\n  show \(get,info\) <selector> \[flags\]\n    Show one connected account/)
assert.match(ok('accounts', '--help'), /add \(create,new\) \[<bridge>\] \[flags\]\n    Connect a chat account by bridge/)
assert.match(ok('contacts', '--help'), /Commands:\n  list \(ls,search,find\) \[<query>\] \[flags\]\n    List contacts\n\n  show \(get,info\) \[<selector>\] \[flags\]\n    Show one contact/)
assert.match(ok('contacts', 'search', '--help'), /Usage: beeper contacts list .* \[<query>\] \[flags\]/)
assert.match(ok('contacts', 'show', '--help'), /--jid=STRING\s+Contact JID or user ID/)
assert.match(ok('messages', 'search', '--help'), /--sender=STRING \(--from\)/)
assert.match(ok('messages', 'search', '--help'), /--has-media\s+Only messages with media/)
assert.match(ok('messages', 'search', '--help'), /\[<query>\]\s+Search query\. Optional when a filter/)
const chatsHelp = ok('chats', '--help')
assert.match(chatsHelp, /unarchive \[<chat>\] \[flags\]\n    Unarchive a chat/)
assert.match(chatsHelp, /mark-unread \[<chat>\] \[flags\]\n    Mark a chat as unread/)
assert.match(ok('chats', 'list', '--help'), /--limit=50\s+Maximum chats to print/)
assert.match(ok('groups', '--help'), /Commands:\n  list \(ls\) \[flags\]\n    List group chats\n\n  show \(info\) \[<jid>\] \[flags\]\n    Show group details\n\n  create \(add,new\) \[flags\]\n    Create a group chat/)
assert.match(ok('groups', 'create', '--help'), /--user=STRING\s+Initial participant user ID/)
assert.match(ok('chats', 'show', '--help'), /--chat=STRING \(--jid\)\s+Chat selector/)
assert.match(ok('chats', 'disappear', '--help'), /--seconds=STRING \(--duration, --ephemeral-duration\)/)
assert.match(ok('config', '--help'), /Commands:\n  get \(show\) <key> \[flags\]\n    Get a config value\n\n  keys \(list-keys,names\) \[flags\]\n    List available config keys\n\n  set \(add,update\) <key> <value> \[flags\]\n    Set a config value/)
assert.doesNotMatch(ok('--read-only', 'config', '--help'), /config set/)
assert.doesNotMatch(ok('--read-only', 'help'), /send text/)
assert.match(ok('setup', '--help'), /--remote/)
assert.match(ok('setup', '--help'), /-h, --help\s+Show context-sensitive help/)
assert.doesNotMatch(ok('setup', '--help'), /Global flags:/)
assert.match(ok('schema', '--help'), /--include-hidden/)
assert.doesNotMatch(ok('schema', '--help'), /Global flags:/)
assert.match(ok('mcp', '--help'), /--allow-tool=ALLOW-TOOL,\.\.\. \(\--tool\)\s+Tool or service allowlist/)
assert.match(ok('mcp', '--help'), /--transport="stdio"/)
assert.match(ok('mcp', '--help'), /--http-port=7331/)
assert.match(ok('docs', '--help'), /--url \(--url-only\)\s+Print only the documentation URL/)
assert.match(ok('targets', 'tunnel', '--help'), /--url-only/)
assert.match(ok('accounts', 'add', '--help'), /--webview-backend/)
assert.match(ok('login', '--help'), /Usage: beeper login \(auth add,auth login\) <email> \[flags\]/)
assert.match(ok('auth', '--help'), /add \(login\) <email> \[flags\]\n    Start email sign-in for a target/)
assert.match(ok('auth', '--help'), /list \(ls\) \[flags\]\n    List stored target credentials/)
assert.match(ok('auth', '--help'), /services \(bridges\) \[flags\]\n    List supported account login services and bridges/)
assert.match(ok('auth', '--help'), /manage \(setup,connect\) \[flags\]\n    Make the selected target ready for messaging/)
assert.match(ok('auth', '--help'), /doctor \[flags\]\n    Run diagnostics for config, target reachability, auth, and readiness/)
assert.match(ok('auth', '--help'), /logout \(remove,rm,del\) \[<target>\] \[flags\]\n    Clear stored authentication/)
assert.match(ok('auth', '--help'), /status \[<target>\] \[flags\]\n    Show auth configuration and stored target credential status/)
assert.match(ok('watch', '--help'), /--include-type/)
assert.match(ok('watch', '--help'), /--webhook-allow-private\s+Accepted for compatibility/)
assert.match(ok('watch', '--help'), /--webhook-secret=STRING\s+HMAC-SHA256 secret for X-Beeper-Signature and X-Wacli-Signature/)
assert.match(ok('send', 'presence', '--help'), /--state/)
assert.match(ok('presence', '--help'), /Usage: beeper presence <command> \[flags\]/)
assert.match(ok('presence', '--help'), /Commands:\n  typing \[flags\]\n    Send a 'composing' \(typing\) indicator to a chat\n\n  paused \[flags\]\n    Send a 'paused' indicator \(stop typing\) to a chat/)
assert.match(ok('presence', 'typing', '--help'), /Usage: beeper presence typing \[flags\]/)
assert.match(ok('presence', 'paused', '--help'), /Usage: beeper presence paused \[flags\]/)
assert.match(ok('send', 'text', '--help'), /--post-send-wait=STRING\s+Compatibility alias for waiting after send/)
assert.match(ok('send', 'text', '--help'), /--reply-to-sender=STRING\s+Accepted for compatibility/)
assert.match(ok('send', 'text', '--help'), /--ephemeral\s+Send with this chat's disappearing-message timer/)
assert.match(ok('send', 'text', '--help'), /--ephemeral-duration=STRING\s+Set the chat disappearing-message timer/)
assert.match(ok('media', 'download', '--help'), /--out/)
assert.match(ok('media', 'download', '--help'), /--out="\."/)
assert.match(ok('messages', 'search', '--help'), /--limit=50 \(\-\-max\)/)
assert.match(ok('export', '--help'), /--no-attachments/)

const version = JSON.parse(ok('version', '--json'))
assert.equal(version.name, 'beeper-cli')
assert.match(version.version, /^\d+\.\d+\.\d+/)
assert.equal(version.commit, '')
assert.equal(version.date, '')

let exitCodes = JSON.parse(ok('exit-codes', '--json')).exit_codes
assert.equal(exitCodes.auth_required, 4)
assert.equal(exitCodes.not_ready, 4)
const exitCodesText = ok('exit-codes')
assert.match(exitCodesText, /^ok: 0$/m)
assert.match(exitCodesText, /^auth_required: 4$/m)
assert.doesNotMatch(exitCodesText, /^EXIT CODES\s+\{/m)
const exitCodesPlain = ok('exit-codes', '--plain')
assert.match(exitCodesPlain, /^ok\t0$/m)
assert.match(exitCodesPlain, /^auth_required\t4$/m)
assert.doesNotMatch(exitCodesPlain, /^EXIT CODES\t/m)

exitCodes = JSON.parse(ok('agent', 'exit-code', '--json', '--select=exit_codes.ok')).exit_codes
assert.equal(exitCodes.auth_required, 4)
assert.equal(exitCodes.not_ready, 4)

const agentPayload = JSON.parse(ok('agent', '--json'))
assert.equal(agentPayload.helpers[0].command, 'agent exit-codes')

const statusPlain = ok('status', '--plain')
assert.match(statusPlain, /^target\tdesktop$/m)
assert.match(statusPlain, /^auth_source\tnone$/m)
assert.doesNotMatch(statusPlain, /^AUTH SOURCE\t/m)

let docsPayload = JSON.parse(ok('docs', '--json'))
assert.equal(docsPayload.success, true)
assert.equal(docsPayload.error, null)
assert.equal(docsPayload.data.url, 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli')
assert.equal(docsPayload.data.relative_commands, 'docs/commands/README.md')
assert.match(docsPayload.data.commands, /docs\/commands\/README\.md$/)
assert.equal(ok('docs'), 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli\n')
assert.equal(ok('docs', '--plain'), 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli\n')
assert.equal(ok('docs', '--url'), 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli\n')
docsPayload = JSON.parse(ok('docs', '--url', '--json'))
assert.equal(docsPayload.success, true)
assert.equal(docsPayload.data, 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli')

let envResult = runEnv({ BEEPER_JSON: '1' }, 'version')
assert.equal(envResult.status, 0, envResult.stderr)
assert.equal(JSON.parse(envResult.stdout).name, 'beeper-cli')

envResult = runEnv({ BEEPER_JSON: '1' }, '--no-json', 'version')
assert.equal(envResult.status, 0, envResult.stderr)
assert.equal(envResult.stdout, '0.6.2\n')

envResult = runEnv({ BEEPER_AUTO_JSON: '1' }, 'version')
assert.equal(envResult.status, 0, envResult.stderr)
assert.equal(JSON.parse(envResult.stdout).name, 'beeper-cli')

envResult = runEnv({ BEEPER_AUTO_JSON: '1' }, '--plain', 'version')
assert.equal(envResult.status, 0, envResult.stderr)
assert.equal(envResult.stdout, `${version.version}\n`)

envResult = runEnv({ BEEPER_AUTO_JSON: '1' }, '--no-json', 'version')
assert.equal(envResult.status, 0, envResult.stderr)
assert.equal(envResult.stdout, '0.6.2\n')

let payload: Record<string, unknown>
envResult = runEnv({ BEEPER_FIELDS: 'name' }, 'version', '--json')
assert.equal(envResult.status, 0, envResult.stderr)
payload = JSON.parse(envResult.stdout)
assert.deepEqual(Object.keys(payload), ['name'])
assert.equal(payload.name, 'beeper-cli')

envResult = runEnv({ BEEPER_FIELDS: 'name' }, 'version', '--json', '--select=version')
assert.equal(envResult.status, 0, envResult.stderr)
payload = JSON.parse(envResult.stdout)
assert.deepEqual(Object.keys(payload), ['version'])

envResult = runEnv({ BEEPER_PROJECT: 'name' }, 'version', '--json')
assert.equal(envResult.status, 0, envResult.stderr)
payload = JSON.parse(envResult.stdout)
assert.deepEqual(Object.keys(payload), ['name'])

let result = run('version', '--json', '--plain')
assert.equal(result.status, 2)
let errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /cannot combine --json and --plain/)

result = run('schema', '--bogus')
assert.equal(result.status, 2)
assert.match(result.stderr, /unknown flag --bogus/)
assert.match(result.stderr, /Run with --help to see available flags/)
assert.doesNotMatch(result.stderr, /hint: Run with --help to see available flags/)

result = run('schema', '--bogus', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.hint, 'Run with --help to see available flags')

result = run('targets', 'add', 'onlyname')
assert.equal(result.status, 2)
assert.match(result.stderr, /expected "<url>"/)

result = run('media', 'download', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.message, 'media download requires <url> or --id with --chat')

payload = JSON.parse(ok('media', 'message', 'm1', '--chat', 'chat', '--index', '2', '--poster', '--out', '/tmp', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')
assert.equal(payload.request.index, 2)
assert.equal(payload.request.poster, true)

result = run('media', 'message', 'm1', '--chat', 'chat', '--id', 'm2', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--id and positional <id> cannot be combined/)

result = run('targets', 'list', 'extra')
assert.equal(result.status, 2)
assert.match(result.stderr, /unexpected argument extra/)

result = run('version', 'extra', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.message, 'unexpected argument extra')

result = run('setup', '--server-env', 'nope', '--dry-run')
assert.equal(result.status, 2)
assert.match(result.stderr, /invalid argument "nope" for "--server-env" flag: expected one of: local, dev, staging, prod/)

result = run('--color', 'nope', 'version', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.message, 'invalid argument "nope" for "--color" flag: expected one of: auto, always, never')

payload = JSON.parse(ok('message', 'chat-selector', 'hello', 'there', '--dry-run', '--json'))
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.chat, 'chat-selector')
assert.equal(payload.request.text, 'hello there')

payload = JSON.parse(ok('msg', '--to', 'chat-selector', '--message', 'hello', '--dry-run', '--json'))
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.chat, 'chat-selector')
assert.equal(payload.request.text, 'hello')

result = run('message', '--to', 'chat-selector', 'other-chat', 'hello', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--to and positional <to> cannot be combined/)

result = run('messages', 'list', '--limit', '12abc', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--limit must be an integer/)

result = run('messages', 'list', '--limit', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.message, '--limit: expected integer value but got "EOL" (<EOL>)')

result = run('setup', '--email', '--local', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.equal(errorPayload.error.message, '--email: expected string value but got "--local"')

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

result = run('send', 'text', '--to', 'chat', '--message', 'hello', '--post-send-wait', 'nope', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /Invalid duration "nope"/)

result = run('contacts', 'search', 'alice', '--query', 'bob', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--query and positional <query> cannot be combined/)

result = run('contacts', 'show', '@user:example.org', '--jid', '@other:example.org', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--jid and positional <selector> cannot be combined/)

result = run('version', '--timeout', 'bogus', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--timeout must be a duration/)

result = runEnv({ BEEPER_TIMEOUT: 'bogus' }, 'version', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--timeout must be a duration/)

payload = JSON.parse(ok('version', '--timeout', '5m0s', '--json'))
assert.equal(payload.name, 'beeper-cli')

payload = JSON.parse(ok('version', '--timeout', '1.5s', '--json'))
assert.equal(payload.name, 'beeper-cli')

payload = JSON.parse(ok('--lock-wait', '5s', 'version', '--json'))
assert.equal(payload.name, 'beeper-cli')

payload = JSON.parse(runEnv({ BEEPER_TIMEOUT: '1m30s' }, 'version', '--json').stdout)
assert.equal(payload.name, 'beeper-cli')

payload = JSON.parse(ok('targets', 'list', '--json'))
assert.ok((payload.targets as Array<{ id: string }>).some(target => target.id === 'desktop'))
payload = JSON.parse(ok('targets', 'list', '--json', '--results-only'))
assert.ok((payload as Array<{ id: string }>).some(target => target.id === 'desktop'))
assert.equal(existsSync(join(configDir, 'config.json')), false)
assert.equal(existsSync(join(configDir, 'targets')), false)

payload = JSON.parse(ok('--home', '/tmp/beeper-cli-smoke-home', 'targets', 'list', '--json'))
assert.ok((payload.targets as Array<{ id: string }>).some(target => target.id === 'desktop'))
assert.equal(existsSync('/tmp/beeper-cli-smoke-home'), false)

payload = JSON.parse(ok('config', 'path', '--json'))
assert.equal(payload.path, join(configDir, 'config.json'))
assert.equal(JSON.parse(ok('config', 'path', '--json', '--results-only')), join(configDir, 'config.json'))
assert.equal(JSON.parse(ok('config', 'where', '--json', '--results-only')), join(configDir, 'config.json'))
assert.equal(ok('config', 'path', '--plain'), `${join(configDir, 'config.json')}\n`)
assert.equal(ok('config', 'where', '--plain'), `${join(configDir, 'config.json')}\n`)

payload = JSON.parse(runEnv({ BEEPER_HOME: homeConfigDir }, 'config', 'path', '--json').stdout)
assert.equal(payload.path, join(homeConfigDir, 'config.json'))

payload = JSON.parse(runEnv({ BEEPER_HOME: '', BEEPER_STORE_DIR: homeConfigDir }, 'config', 'path', '--json').stdout)
assert.equal(payload.path, join(homeConfigDir, 'config.json'))

payload = JSON.parse(runEnv({ BEEPER_HOME: homeConfigDir }, '--home', configDir, 'config', 'path', '--json').stdout)
assert.equal(payload.path, join(configDir, 'config.json'))

payload = JSON.parse(ok('--store', homeConfigDir, 'config', 'path', '--json'))
assert.equal(payload.path, join(homeConfigDir, 'config.json'))

payload = JSON.parse(ok('config', 'keys', '--json'))
assert.deepEqual(payload.keys, ['defaultTarget', 'defaultAccount'])

payload = JSON.parse(ok('config', 'keys', '--json', '--results-only'))
assert.deepEqual(payload, ['defaultTarget', 'defaultAccount'])

assert.equal(ok('config', 'keys', '--plain'), 'defaultTarget\ndefaultAccount\n')

payload = JSON.parse(ok('config', 'set', 'default-target', 'desktop', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'config.set')
assert.equal(payload.request.key, 'defaultTarget')

payload = JSON.parse(ok('login', 'person@example.com', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.start')
assert.equal(payload.request.email, 'person@example.com')

payload = JSON.parse(ok('logout', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')

payload = JSON.parse(ok('logout', 'desktop', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')
assert.equal(payload.request.target, 'desktop')

payload = JSON.parse(ok('auth', 'list', '--json'))
assert.equal(payload.accounts[0].target, 'desktop')
assert.equal(payload.accounts[0].authenticated, false)
assert.equal(payload.accounts[0].source, 'none')

payload = JSON.parse(ok('auth', 'list', '--json', '--results-only'))
assert.equal(payload[0].target, 'desktop')
assert.equal(payload[0].authenticated, false)
assert.match(ok('auth', 'ls'), /TARGET\s+DEFAULT\s+AUTHENTICATED\s+SOURCE/)

payload = JSON.parse(ok('auth', 'services', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.services')

payload = JSON.parse(ok('auth', 'bridges', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.services')

result = run('--read-only', 'config', 'set', 'default-target', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /read-only mode/)

result = run('--readonly', 'config', 'set', 'default-target', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /read-only mode/)

result = runEnv({ BEEPER_READONLY: '1' }, 'config', 'set', 'default-target', 'desktop', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /read-only mode/)

payload = JSON.parse(runEnv({ BEEPER_READONLY: '1' }, '--no-read-only', 'config', 'set', 'default-target', 'desktop', '--dry-run', '--json').stdout)
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'config.set')

result = runEnv({ BEEPER_ENABLE_COMMANDS: 'messages' }, 'targets', 'list', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /not enabled/)

result = runEnv({ BEEPER_DISABLE_COMMANDS: 'targets.list' }, 'targets', 'list', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /disabled/)

payload = JSON.parse(ok('use', 'target', 'desktop', '--json'))
assert.equal(payload.defaultTarget, 'desktop')

payload = JSON.parse(ok('config', 'get', 'defaultTarget', '--json'))
assert.equal(payload.key, 'defaultTarget')
assert.equal(payload.value, 'desktop')
assert.equal(ok('config', 'get', 'defaultTarget', '--plain'), 'desktop\n')
assert.equal(ok('config', 'show', 'defaultTarget', '--plain'), 'desktop\n')

payload = JSON.parse(ok('config', 'list', '--json'))
assert.equal(payload.defaultTarget, 'desktop')
assert.equal(payload.defaultAccount, null)

payload = JSON.parse(ok('auth', 'status', '--json'))
assert.equal(payload.auth.authenticated, false)
assert.equal(payload.auth.source, 'none')
assert.equal(payload.config.defaultTarget, 'desktop')
assert.equal(payload.config.exists, true)
assert.equal(payload.target.id, 'desktop')
assert.equal(payload.target.default, true)

payload = JSON.parse(ok('auth', 'status', '--json', '--results-only'))
assert.equal(payload.auth.authenticated, false)
assert.equal(payload.config.defaultTarget, 'desktop')
assert.equal(payload.target.id, 'desktop')

const authStatusPlain = ok('auth', 'status', '--plain')
assert.match(authStatusPlain, /^auth\.authenticated\tfalse$/m)
assert.match(authStatusPlain, /^auth\.source\tnone$/m)
assert.match(authStatusPlain, /^config\.defaultTarget\tdesktop$/m)
assert.match(authStatusPlain, /^target\.id\tdesktop$/m)

payload = JSON.parse(ok('auth', 'add', 'user@example.com', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.start')
assert.equal(payload.request.email, 'user@example.com')

payload = JSON.parse(ok('config', 'set', 'default-account', 'matrix', '--json'))
assert.equal(payload.saved, true)
assert.equal(payload.key, 'defaultAccount')
assert.equal(payload.value, 'matrix')
assert.equal(ok('config', 'set', 'default-account', 'matrix', '--plain'), 'Set defaultAccount = matrix\n')

payload = JSON.parse(ok('config', 'show', 'default_account', '--json'))
assert.equal(payload.value, 'matrix')

payload = JSON.parse(ok('config', 'rm', 'default-account', '--json'))
assert.equal(payload.removed, true)
assert.equal(payload.value, null)
payload = JSON.parse(ok('config', 'set', 'default-account', 'matrix', '--json'))
assert.equal(payload.saved, true)
assert.equal(ok('config', 'rm', 'default-account', '--plain'), 'Unset defaultAccount\n')

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

payload = JSON.parse(ok('targets', 'use', 'desktop', '--json'))
assert.equal(payload.defaultTarget, 'desktop')

payload = JSON.parse(ok('targets', 'use', 'work', '--json'))
assert.equal(payload.defaultTarget, 'work')

payload = JSON.parse(ok('status', '--json'))
assert.equal(payload.auth.authenticated, false)
assert.equal(payload.config.defaultTarget, 'work')
assert.equal(payload.config.exists, true)
assert.equal(payload.target.id, 'work')

payload = JSON.parse(ok('status', '--json', '--results-only'))
assert.equal(payload.auth.authenticated, false)
assert.equal(payload.config.defaultTarget, 'work')
assert.equal(payload.target.id, 'work')

payload = JSON.parse(ok('whoami', '--account', 'matrix', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'me')
assert.equal(payload.request.accounts[0], 'matrix')
assert.equal(payload.request.target, 'work')

payload = JSON.parse(ok('accounts', 'show', 'matrix', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'accounts.show')
assert.equal(payload.request.selector, 'matrix')

payload = JSON.parse(ok('contacts', 'show', '@user:example.org', '--account', 'matrix', '--pick', '2', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'contacts.show')
assert.equal(payload.request.accounts[0], 'matrix')
assert.equal(payload.request.pick, 2)
assert.equal(payload.request.selector, '@user:example.org')

payload = JSON.parse(ok('contacts', 'show', '--jid', '@user:example.org', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'contacts.show')
assert.equal(payload.request.jid, '@user:example.org')
assert.equal(payload.request.selector, '@user:example.org')

payload = JSON.parse(ok('auth', 'logout', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')

payload = JSON.parse(ok('auth', 'remove', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')

payload = JSON.parse(ok('auth', 'rm', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.logout')

payload = JSON.parse(ok('auth', 'email', 'start', '--email', 'qa@example.invalid', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.start')

payload = JSON.parse(ok('auth', 'email', 'response', '--setup-request-id', 'setup-1', '--code', '123456', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'auth.email.response')

payload = JSON.parse(ok('auth', 'manage', '--local', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'setup')
assert.equal(payload.request.authMode, 'local')

payload = JSON.parse(ok('auth', 'setup', '--oauth', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'setup')
assert.equal(payload.request.authMode, 'oauth')

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
assert.equal(result.status, 127)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'command_not_found')
assert.match(errorPayload.error.message, /unknown command "targets runtime bogus"/)

result = run('targets', 'runtime', 'strat', '--dry-run', '--json')
assert.equal(result.status, 127)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'command_not_found')
assert.match(errorPayload.error.message, /did you mean "targets runtime start"/)

result = run('opne')
assert.equal(result.status, 127)
assert.match(result.stderr, /unknown command "opne", did you mean "open"\?/)

payload = JSON.parse(ok('targets', 'tunnel', 'work', '--retries', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'targets.tunnel')
assert.equal(payload.request.target, 'work')
assert.equal(payload.request.retries, 1)

payload = JSON.parse(ok('remove', 'target', 'work', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'remove.target')
assert.equal(payload.request.id, 'work')

payload = JSON.parse(ok('targets', 'rm', 'work', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'remove.target')
assert.equal(payload.request.id, 'work')

result = run('targets', 'rm', 'work', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /destructive command "targets remove" requires --force or --dry-run/)

payload = JSON.parse(ok('chats', 'unarchive', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.unarchive')
assert.equal(payload.request.isArchived, false)

payload = JSON.parse(ok('chats', 'archive', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.archive')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.isArchived, true)

payload = JSON.parse(ok('chats', 'unmute', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.request.isMuted, false)

payload = JSON.parse(ok('chats', 'unpin', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.request.isPinned, false)

payload = JSON.parse(ok('chats', 'mark-read', '--chat', 'chat', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.read')
assert.equal(payload.request.read, true)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('chats', 'mark-read', 'chat', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.read')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('chats', 'mark-unread', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.request.read, false)

payload = JSON.parse(ok('messages', 'export', '--chat', 'chat', '--from-me', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.export')
assert.equal(payload.request.sender, 'me')

payload = JSON.parse(ok('messages', 'export', '--chat', 'chat', '--from-them', '--dry-run', '--json'))
assert.equal(payload.request.sender, 'others')

result = run('messages', 'export', '--chat', 'chat', '--sender', 'me', '--from-them', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /Use only one of --sender, --from-me, or --from-them/)

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

payload = JSON.parse(ok('send', 'file', '--to', 'chat', '--file', './note.ogg', '--ptt', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.file')
assert.equal(payload.request.attachmentType, 'voice-note')
assert.equal(payload.request.mimeType, 'audio/ogg')
assert.equal(payload.request.text, '')

result = run('send', 'file', '--to', 'chat', '--file', './note.ogg', '--ptt', '--caption', 'listen', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--caption cannot be combined with --ptt/)

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello', '--mention', 'user1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.mentions[0], 'user1')

payload = JSON.parse(ok('send', '--to', 'chat', '--message', 'hello', '--mention', 'user1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.text, 'hello')
assert.equal(payload.request.mentions[0], 'user1')

payload = JSON.parse(ok('send', 'chat', 'hello', 'there', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.text, 'hello there')

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello', '--reply-to', 'm1', '--reply-to-sender', 'user1', '--dry-run', '--json'))
assert.equal(payload.request.replyTo, 'm1')
assert.equal(payload.request.replyToSender, 'user1')

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello', '--ephemeral', '--ephemeral-duration', '24h', '--dry-run', '--json'))
assert.equal(payload.request.ephemeral, true)
assert.equal(payload.request.ephemeralDuration, '24h')
assert.equal(payload.request.messageExpirySeconds, 86400)

result = run('send', 'text', '--to', 'chat', '--message', 'hello', '--ephemeral-duration', 'off', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--ephemeral-duration must be a positive duration/)

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello\\nthere', '--message-escapes', '--dry-run', '--json'))
assert.equal(payload.request.text, 'hello\nthere')

payload = JSON.parse(ok('send', 'text', '--to', 'chat', '--message', 'hello', '--post-send-wait', '2s', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.text')
assert.equal(payload.request.wait, true)
assert.equal(payload.request.waitTimeoutMs, 2000)

payload = JSON.parse(ok('send', 'file', '--to', 'chat', '--file', './note.ogg', '--post-send-wait', '0', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.file')
assert.equal(payload.request.wait, false)
assert.equal(payload.request.waitTimeoutMs, 0)

payload = JSON.parse(ok('send', 'file', './note.ogg', '--to', 'chat', '--caption', 'listen', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.file')
assert.equal(payload.request.file, './note.ogg')
assert.equal(payload.request.text, 'listen')

payload = JSON.parse(ok('send', 'voice', './voice.ogg', '--to', 'chat', '--duration', '12', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.voice')
assert.equal(payload.request.file, './voice.ogg')
assert.equal(payload.request.duration, 12)
assert.equal(payload.request.attachmentType, 'voice-note')

payload = JSON.parse(ok('send', 'sticker', './sticker.webp', '--to', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.sticker')
assert.equal(payload.request.file, './sticker.webp')
assert.equal(payload.request.attachmentType, 'sticker')

result = run('send', 'file', './note.ogg', '--to', 'chat', '--file', './other.ogg', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--file and positional <localPath> cannot be combined/)

payload = JSON.parse(ok('upload', './note.ogg', '--to', 'chat', '--caption', 'listen', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.file')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.file, './note.ogg')
assert.equal(payload.request.text, 'listen')

payload = JSON.parse(ok('up', './note.ogg', '--to', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.file')
assert.equal(payload.request.file, './note.ogg')

payload = JSON.parse(ok('-a', 'matrix', 'chats', 'start', '@u:example.org', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.start')
assert.equal(payload.request.account, 'matrix')

payload = JSON.parse(runEnv({ BEEPER_ACCOUNT: 'matrix' }, 'chats', 'start', '@u:example.org', '--dry-run', '--json').stdout)
assert.equal(payload.request.account, 'matrix')

payload = JSON.parse(ok('send', 'react', '--to', 'chat', '--id', 'm1', '--reaction', '+1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.reactionKey, '+1')

payload = JSON.parse(ok('send', 'react', '--to', 'chat', '--id', 'm1', '--post-send-wait', '2s', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.wait, true)
assert.equal(payload.request.waitTimeoutMs, 2000)

payload = JSON.parse(ok('send', 'react', '--to', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.reactionKey, '+1')
assert.equal(payload.request.remove, false)

payload = JSON.parse(ok('send', 'react', 'm1', '--to', 'chat', '--reaction', 'rocket', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.messageID, 'm1')
assert.equal(payload.request.reactionKey, 'rocket')

result = run('send', 'react', 'm1', '--to', 'chat', '--id', 'm2', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--id and positional <id> cannot be combined/)

payload = JSON.parse(ok('send', 'reaction', '--to', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.reactionKey, '+1')

payload = JSON.parse(ok('send', 'react', '--to', 'chat', '--id', 'm1', '--reaction=', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.react')
assert.equal(payload.request.reactionKey, '+1')
assert.equal(payload.request.remove, true)

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--seconds', 'off', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageExpirySeconds, null)

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--seconds', '3600', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.messageExpirySeconds, 3600)

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--duration', '24h', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.messageExpirySeconds, 86400)

payload = JSON.parse(ok('chats', 'disappear', '--chat', 'chat', '--ephemeral-duration', '7d', '--dry-run', '--json'))
assert.equal(payload.request.messageExpirySeconds, 604800)

result = run('chats', 'disappear', '--chat', 'chat', '--seconds', '1e2', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--seconds must be a positive integer, a duration like 24h\/7d\/90d, or "off"/)

payload = JSON.parse(ok('chats', 'priority', '--chat', 'chat', '--level', 'low', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')

payload = JSON.parse(ok('groups', 'rename', 'group-chat', '--name', 'Planning', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.rename')
assert.equal(payload.request.chat, 'group-chat')
assert.equal(payload.request.title, 'Planning')

payload = JSON.parse(ok('groups', 'description', 'group-chat', '--description', 'Roadmap', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.description')
assert.equal(payload.request.chat, 'group-chat')
assert.equal(payload.request.description, 'Roadmap')

result = run('groups', 'rename', 'group-chat', '--jid', 'other', '--name', 'Planning', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--jid and positional <jid> cannot be combined/)

payload = JSON.parse(ok('chats', 'focus', '--chat', 'chat', '--text', 'draft', '--file', './draft.txt', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.focus')
assert.equal(payload.request.draftText, 'draft')
assert.equal(payload.request.draftAttachmentPath, './draft.txt')

payload = JSON.parse(ok('open', '--chat', 'chat', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.focus')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('open', 'chat', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.focus')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('browse', 'chat', '--message', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.focus')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('chats', 'notify-anyway', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.notify-anyway')

payload = JSON.parse(ok('chats', 'notify-anyway', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.notify-anyway')
assert.equal(payload.request.chat, 'chat')

result = run('chats', 'notify-anyway', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /chats notify-anyway requires --chat or <chat>/)

result = run('chats', 'notify-anyway', 'chat', '--chat', 'other', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /--chat and positional <chat> cannot be combined/)

assert.match(ok('search', 'all', '--help'), /Usage: beeper search all \(search-all,find-all\) <query> \[flags\]/)
payload = JSON.parse(ok('search', 'all', 'dinner', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'search.all')
assert.equal(payload.request.query, 'dinner')

payload = JSON.parse(ok('search-all', 'dinner', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'search.all')
assert.equal(payload.request.query, 'dinner')

payload = JSON.parse(ok('groups', 'create', '--name', 'Team', '--user', '@a:example.org', '--user', '@b:example.org', '--message', 'hello', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'groups.create')
assert.equal(payload.request.title, 'Team')
assert.deepEqual(payload.request.participantIDs, ['@a:example.org', '@b:example.org'])
assert.equal(payload.request.messageText, 'hello')

payload = JSON.parse(ok('groups', 'rename', '--jid', 'group-chat', '--name', 'New Team', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.rename')
assert.equal(payload.request.chat, 'group-chat')
assert.equal(payload.request.title, 'New Team')

payload = JSON.parse(ok('groups', 'description', '--jid', 'group-chat', '--topic', 'Planning', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'chats.description')
assert.equal(payload.request.description, 'Planning')

payload = JSON.parse(ok('messages', 'context', '--chat', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'context', 'm1', '--chat', 'chat', '--before', '2', '--after', '3', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.request.before, 2)
assert.equal(payload.request.after, 3)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'show', '--chat', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.show')
assert.equal(payload.request.after, 0)
assert.equal(payload.request.before, 0)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'show', 'm1', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.show')
assert.equal(payload.request.messageID, 'm1')

result = run('messages', 'show', 'm1', '--chat', 'chat', '--id', 'm2', '--dry-run', '--json')
assert.equal(result.status, 2)
assert.match(result.stderr, /--id and positional <id> cannot be combined/)

payload = JSON.parse(ok('messages', 'export', '--chat', 'chat', '--limit', '3', '--output', '/tmp/messages.json', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.export')
assert.equal(payload.request.asc, false)
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.limit, 3)
assert.equal(payload.request.output, '/tmp/messages.json')

payload = JSON.parse(ok('messages', 'forward', '--chat', 'source', '--id', 'm1', '--to', 'dest', '--attachment-index', '2', '--post-send-wait', '0', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.forward')
assert.equal(payload.request.attachmentIndex, 2)
assert.equal(payload.request.chat, 'source')
assert.equal(payload.request.messageID, 'm1')
assert.equal(payload.request.to, 'dest')
assert.equal(payload.request.wait, false)

payload = JSON.parse(ok('messages', 'forward', 'm1', '--chat', 'source', '--to', 'dest', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.forward')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'edit', '--chat', 'chat', '--id', 'm1', '--message', 'edited', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.edit')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.text, 'edited')

payload = JSON.parse(ok('messages', 'edit', 'm1', '--chat', 'chat', '--message', 'edited', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.edit')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'delete', '--chat', 'chat', '--id', 'm1', '--for-everyone', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.delete')
assert.equal(payload.request.forEveryone, true)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'delete', 'm1', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.delete')
assert.equal(payload.request.messageID, 'm1')

result = run('messages', 'delete', 'm1', '--chat', 'chat', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.match(errorPayload.error.message, /destructive command "messages delete" requires --force or --dry-run/)

payload = JSON.parse(ok('messages', 'revoke', '--chat', 'chat', '--id', 'm1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.revoke')
assert.equal(payload.request.forEveryone, true)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('messages', 'revoke', 'm1', '--chat', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'messages.revoke')
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('export', '--chat', 'chat', '--out', '/tmp/beeper-export', '--limit-messages', '10', '--no-attachments', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'export')
assert.equal(payload.request.outDir, '/tmp/beeper-export')

payload = JSON.parse(ok('send', 'presence', '--to', 'chat', '--duration', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.presence')
assert.equal(payload.request.durationSeconds, 1)

payload = JSON.parse(ok('presence', '--to', 'chat', '--state', 'paused', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.presence')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.state, 'paused')

payload = JSON.parse(ok('presence', 'typing', '--to', 'chat', '--duration', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.presence')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.durationSeconds, 1)
assert.equal(payload.request.state, 'typing')

payload = JSON.parse(ok('presence', 'paused', '--to', 'chat', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'send.presence')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.state, 'paused')

result = run('presence', '--dry-run', '--json')
assert.equal(result.status, 2)
errorPayload = JSON.parse(result.stderr)
assert.equal(errorPayload.error.code, 'usage_error')
assert.match(errorPayload.error.message, /--to is required/)

payload = JSON.parse(ok('media', 'download', 'mxc://server/file', '--out', '/tmp', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.out, '/tmp')

payload = JSON.parse(ok('media', 'dl', 'mxc://server/file', '--out', '/tmp', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.url, 'mxc://server/file')

payload = JSON.parse(ok('media', 'message', '--chat', 'chat', '--id', 'm1', '--index', '2', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.chat, 'chat')
assert.equal(payload.request.index, 2)
assert.equal(payload.request.messageID, 'm1')

payload = JSON.parse(ok('download', 'mxc://server/file', '--out', '/tmp', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'media.download')
assert.equal(payload.request.url, 'mxc://server/file')

payload = JSON.parse(ok('export', '--out', '/tmp/beeper-export', '--limit-chats', '1', '--dry-run', '--json'))
assert.equal(payload.dry_run, true)
assert.equal(payload.op, 'export')
assert.equal(payload.request.outDir, '/tmp/beeper-export')
assert.equal(payload.request.limitChats, 1)

payload = JSON.parse(ok('--safety-profile', 'readonly', 'resolve', 'target', 'desktop', '--json'))
assert.equal(payload.kind, 'target')
assert.equal(payload.selected.id, 'desktop')

payload = JSON.parse(ok('targets', 'list', '--json'))
assert.ok((payload.targets as Array<{ id: string }>).some(target => target.id === 'work'))

const schemaText = ok('schema', '--json')
assert.match(schemaText, /^\{\n  "schema_version": 1,\n  "build":/)
const schema = JSON.parse(schemaText)
assert.equal(schema.schema_version, 1)
assert.equal(schema.command.type, 'application')
assert.equal(schema.command.path, 'beeper')
assert.equal(schema.command.program_path, 'beeper')
assert.equal(schema.command.usage, 'beeper <command> [flags]')
assert.deepEqual(schema.command.flags.slice(0, 5).map((flag: { name: string }) => flag.name), ['help', 'color', 'home', 'account', 'access-token'])
assert.ok(schema.command.flags.findIndex((flag: { name: string }) => flag.name === 'verbose') < schema.command.flags.findIndex((flag: { name: string }) => flag.name === 'version'))
assert.ok(schema.command.flags.some((flag: { name: string; short?: string }) => flag.name === 'json' && flag.short === 'j'))
assert.ok(schema.command.flags.some((flag: { name: string; short?: string }) => flag.name === 'account' && flag.short === 'a'))
assert.ok(schema.command.flags.some((flag: { name: string; short?: string }) => flag.name === 'help' && flag.short === 'h'))
assert.ok(schema.command.flags.some((flag: { name: string }) => flag.name === 'lock-wait'))
assert.ok(schema.command.flags.some((flag: { aliases?: string[]; name: string }) => flag.name === 'read-only' && flag.aliases?.includes('readonly')))
assert.ok(schema.command.flags.some((flag: { name: string }) => flag.name === 'full'))
assert.ok(schema.command.flags.some((flag: { has_default?: boolean; name: string; placeholder?: string }) => flag.name === 'json' && flag.has_default === true && flag.placeholder === 'false'))
assert.ok(schema.command.flags.some((flag: { has_default?: boolean; name: string; placeholder?: string }) => flag.name === 'access-token' && flag.has_default === undefined && flag.placeholder === 'STRING'))
assert.ok(schema.command.flags.some((flag: { has_default?: boolean; name: string; placeholder?: string }) => flag.name === 'help' && flag.has_default === true && flag.placeholder === 'false'))
assert.deepEqual(schema.command.subcommands.slice(0, 6).map((command: { name: string }) => command.name), ['message', 'ls', 'search', 'open', 'download', 'upload'])
assert.ok(schema.command.subcommands.some((command: { name: string; path: string; usage: string }) => command.name === 'message' && command.path === 'message' && command.usage === 'beeper message (msg) [<to>] [<message> ...] [flags]'))
assert.ok(schema.command.subcommands.some((command: { help: string; name: string; path: string; usage: string }) => command.name === 'logout' && command.path === 'logout' && command.usage === 'beeper logout [<target>] [flags]' && command.help.includes("alias for 'auth logout'")))
assert.ok(schema.command.subcommands.some((command: { aliases?: string[][]; name: string; path: string; usage: string }) => command.name === 'download' && command.path === 'download' && command.usage === 'beeper download (dl) [<url>] [flags]' && command.aliases?.[0]?.[0] === 'dl'))
assert.ok(schema.command.subcommands.some((command: { aliases?: string[][]; name: string; path: string; usage: string }) => command.name === 'upload' && command.path === 'upload' && command.usage === 'beeper upload (up,put) <localPath> [flags]' && command.aliases?.some(alias => alias[0] === 'up') && command.aliases?.some(alias => alias[0] === 'put')))
assert.ok(schema.command.subcommands.some((command: { alias_paths?: string[]; name: string }) => command.name === 'upload' && command.alias_paths?.includes('up') && command.alias_paths?.includes('put')))
assert.ok(schema.command.subcommands.some((command: { aliases?: string[][]; name: string; path: string; usage: string }) => command.name === 'me' && command.path === 'me' && command.usage === 'beeper me (whoami,who-am-i) [flags]' && command.aliases?.some(alias => alias[0] === 'whoami')))
assert.ok(schema.command.subcommands.some((command: { aliases?: string[][]; help: string; name: string; path: string; usage: string }) => command.name === 'whoami' && command.path === 'whoami' && command.usage === 'beeper whoami (who-am-i) [flags]' && command.help.includes("alias for 'me'") && command.aliases?.some(alias => alias[0] === 'who-am-i')))
assert.ok(schema.command.subcommands.some((command: { name: string; subcommands?: Array<{ name: string }>; usage: string }) => command.name === 'agent' && command.usage === 'beeper agent <command> [flags]' && command.subcommands?.some(subcommand => subcommand.name === 'exit-codes')))
assert.ok(schema.command.subcommands.some((command: { name: string }) => command.name === 'doctor'))
assert.ok(!schema.command.subcommands.some((command: { name: string }) => command.name === '__complete'))

let hiddenSchema = JSON.parse(ok('schema', '--include-hidden', '--json'))
assert.ok(hiddenSchema.command.subcommands.some((command: { name: string }) => command.name === '__complete'))

let commandSchema = JSON.parse(ok('schema', 'targets ls', '--json'))
assert.equal(commandSchema.command.path, 'targets list')
assert.equal(commandSchema.command.program_path, 'beeper targets list')
assert.equal(commandSchema.command.name, 'list')
assert.equal(commandSchema.command.mcp, true)
assert.equal(commandSchema.command.risk, 'read')
assert.equal(commandSchema.command.primary_result_key, 'targets')
assert.deepEqual(commandSchema.command.program_alias_paths, ['beeper targets ls', 'beeper target list', 'beeper target ls'])
assert.equal(commandSchema.command.usage, 'beeper targets list (targets ls,target list,target ls) [flags]')
assert.ok(commandSchema.command.flags.some((flag: { name: string; short?: string }) => flag.name === 'json' && flag.short === 'j'))

commandSchema = JSON.parse(ok('schema', 'targets', 'add', '--json'))
assert.equal(commandSchema.command.path, 'targets add')
assert.equal(commandSchema.command.positionals[0].help, 'Target name')
assert.equal(commandSchema.command.positionals[1].help, 'Target base URL')

commandSchema = JSON.parse(ok('schema', 'api', 'request', '--json'))
assert.equal(commandSchema.command.path, 'api request')
assert.match(commandSchema.command.positionals[0].help, /HTTP method/)
assert.match(commandSchema.command.positionals[1].help, /Desktop API path/)

commandSchema = JSON.parse(ok('schema', 'ls', '--json'))
assert.equal(commandSchema.command.path, 'chats list')
assert.deepEqual(commandSchema.command.aliases, [['chats', 'ls'], ['chat', 'list'], ['chat', 'ls'], ['ls'], ['list']])

commandSchema = JSON.parse(ok('schema', 'upload', '--json'))
assert.equal(commandSchema.command.path, 'upload')
assert.equal(commandSchema.command.usage, 'beeper upload (up,put) <localPath> [flags]')
assert.deepEqual(commandSchema.command.aliases, [['up'], ['put']])
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'caption'))

commandSchema = JSON.parse(ok('schema', 'open', '--json'))
assert.equal(commandSchema.command.path, 'chats focus')
assert.equal(commandSchema.command.usage, 'beeper chats focus (chat focus,open,browse,focus) [<chat>] [flags]')
assert.deepEqual(commandSchema.command.aliases, [['chat', 'focus'], ['open'], ['browse'], ['focus']])
assert.equal(commandSchema.command.positionals[0].name, 'chat')
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; name: string; required?: boolean }) => flag.name === 'chat' && flag.required === false && flag.aliases?.includes('jid')))

commandSchema = JSON.parse(ok('schema', 'search', '--json'))
assert.equal(commandSchema.command.path, 'messages search')
assert.equal(commandSchema.command.usage, 'beeper messages search (messages find,search,find) [<query>] [flags]')
assert.deepEqual(commandSchema.command.aliases, [['messages', 'find'], ['search'], ['find']])
assert.match(commandSchema.command.positionals[0].help, /Optional when a filter/)
assert.ok(commandSchema.command.flags.some((flag: { has_default?: boolean; name: string; placeholder?: string }) => flag.name === 'limit' && flag.has_default === true && flag.placeholder === '50'))
assert.ok(commandSchema.command.flags.some((flag: { has_default?: boolean; name: string; placeholder?: string }) => flag.name === 'after' && flag.has_default === undefined && flag.placeholder === 'STRING'))
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; name: string }) => flag.name === 'sender' && flag.aliases?.includes('from')))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'has-media'))

commandSchema = JSON.parse(ok('schema', 'search', 'all', '--json'))
assert.equal(commandSchema.command.path, 'search all')
assert.equal(commandSchema.command.usage, 'beeper search all (search-all,find-all) <query> [flags]')
assert.deepEqual(commandSchema.command.aliases, [['search-all'], ['find-all']])

commandSchema = JSON.parse(ok('schema', 'search-all', '--json'))
assert.equal(commandSchema.command.path, 'search all')

commandSchema = JSON.parse(ok('schema', 'whoami', '--json'))
assert.equal(commandSchema.command.path, 'me')
assert.deepEqual(commandSchema.command.aliases, [['whoami'], ['who-am-i']])

commandSchema = JSON.parse(ok('schema', 'msg', '--json'))
assert.equal(commandSchema.command.path, 'send text')
assert.equal(commandSchema.command.usage, 'beeper send text (message,msg) [<to>] [<message> ...] [flags]')
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'ephemeral'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'ephemeral-duration'))

commandSchema = JSON.parse(ok('schema', 'download', '--json'))
assert.equal(commandSchema.command.path, 'media download')
assert.deepEqual(commandSchema.command.aliases, [['media', 'dl'], ['download'], ['dl']])

commandSchema = JSON.parse(ok('schema', 'auth', 'status', '--json'))
assert.equal(commandSchema.command.path, 'auth status')
assert.equal(commandSchema.command.usage, 'beeper auth status [<target>] [flags]')

commandSchema = JSON.parse(ok('schema', 'st', '--json'))
assert.equal(commandSchema.command.path, 'status')
assert.deepEqual(commandSchema.command.aliases, [['st']])

commandSchema = JSON.parse(ok('schema', 'auth', 'add', '--json'))
assert.equal(commandSchema.command.path, 'login')
assert.deepEqual(commandSchema.command.aliases, [['auth', 'add'], ['auth', 'login']])

commandSchema = JSON.parse(ok('schema', 'auth', '--json'))
assert.deepEqual(commandSchema.command.subcommands.slice(0, 2).map((command: { name: string; usage: string }) => [command.name, command.usage]), [['add', 'beeper auth add (login) <email> [flags]'], ['list', 'beeper auth list (auth ls) [flags]']])

commandSchema = JSON.parse(ok('schema', 'auth', 'ls', '--json'))
assert.equal(commandSchema.command.path, 'auth list')
assert.equal(commandSchema.command.output, 'auth')
assert.equal(commandSchema.command.primary_result_key, 'accounts')
assert.deepEqual(commandSchema.command.aliases, [['auth', 'ls']])

commandSchema = JSON.parse(ok('schema', 'auth', 'services', '--json'))
assert.equal(commandSchema.command.path, 'auth services')
assert.equal(commandSchema.command.primary_result_key, 'services')
assert.equal(commandSchema.command.usage, 'beeper auth services (auth bridges) [flags]')
assert.deepEqual(commandSchema.command.aliases, [['auth', 'bridges']])
assert.deepEqual(commandSchema.command.alias_paths, ['auth bridges'])
assert.ok(commandSchema.command.flags.some((flag: { default?: boolean; name: string }) => flag.name === 'markdown' && flag.default === false))
assert.ok(commandSchema.command.flags.some((flag: { help?: string; name: string }) => flag.name === 'markdown' && flag.help === 'Output a Markdown table'))

commandSchema = JSON.parse(ok('schema', 'auth', 'bridges', '--json'))
assert.equal(commandSchema.command.path, 'auth services')

commandSchema = JSON.parse(ok('schema', 'auth', 'manage', '--json'))
assert.equal(commandSchema.command.path, 'auth manage')
assert.equal(commandSchema.command.usage, 'beeper auth manage (auth setup,auth connect) [flags]')
assert.deepEqual(commandSchema.command.aliases, [['auth', 'setup'], ['auth', 'connect']])
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'oauth'))

commandSchema = JSON.parse(ok('schema', 'auth', 'remove', '--json'))
assert.equal(commandSchema.command.path, 'auth logout')
assert.equal(commandSchema.command.usage, 'beeper auth logout (logout,auth remove,auth rm,auth del) [<target>] [flags]')
assert.deepEqual(commandSchema.command.aliases, [['logout'], ['auth', 'remove'], ['auth', 'rm'], ['auth', 'del']])
assert.equal(commandSchema.command.positionals[0].name, 'target')

commandSchema = JSON.parse(ok('schema', 'auth', 'del', '--json'))
assert.equal(commandSchema.command.path, 'auth logout')

commandSchema = JSON.parse(ok('schema', 'doctor', '--json'))
assert.equal(commandSchema.command.path, 'doctor')
assert.deepEqual(commandSchema.command.aliases, [['auth', 'doctor']])
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'connect'))

commandSchema = JSON.parse(ok('schema', 'auth', 'doctor', '--json'))
assert.equal(commandSchema.command.path, 'doctor')
assert.equal(commandSchema.command.usage, 'beeper doctor (auth doctor) [flags]')

commandSchema = JSON.parse(ok('schema', 'accounts', '--json'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['list', 'show', 'add', 'use', 'remove'])
assert.deepEqual(commandSchema.command.aliases, [['account']])
assert.equal(commandSchema.command.usage, 'beeper accounts (account) <command> [flags]')

commandSchema = JSON.parse(ok('schema', 'account', 'ls', '--json'))
assert.equal(commandSchema.command.path, 'accounts list')
assert.deepEqual(commandSchema.command.aliases, [['accounts', 'ls'], ['account', 'list'], ['account', 'ls']])
assert.equal(commandSchema.command.usage, 'beeper accounts list (accounts ls,account list,account ls) [flags]')

commandSchema = JSON.parse(ok('schema', 'accounts', 'get', '--json'))
assert.equal(commandSchema.command.path, 'accounts show')
assert.deepEqual(commandSchema.command.aliases, [['accounts', 'get'], ['accounts', 'info'], ['account', 'show'], ['account', 'get'], ['account', 'info']])
assert.equal(commandSchema.command.usage, 'beeper accounts show (accounts get,accounts info,account show,account get,account info) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', 'account', 'info', '--json'))
assert.equal(commandSchema.command.path, 'accounts show')

commandSchema = JSON.parse(ok('schema', 'accounts', 'add', '--json'))
assert.equal(commandSchema.command.path, 'accounts add')
assert.deepEqual(commandSchema.command.aliases, [['accounts', 'create'], ['accounts', 'new'], ['account', 'add'], ['account', 'create'], ['account', 'new']])
assert.equal(commandSchema.command.usage, 'beeper accounts add (accounts create,accounts new,account add,account create,account new) [<bridge>] [flags]')

commandSchema = JSON.parse(ok('schema', 'account', 'new', '--json'))
assert.equal(commandSchema.command.path, 'accounts add')

commandSchema = JSON.parse(ok('schema', 'accounts', 'use', '--json'))
assert.equal(commandSchema.command.path, 'accounts use')
assert.deepEqual(commandSchema.command.aliases, [['use', 'account'], ['account', 'use']])
assert.equal(commandSchema.command.usage, 'beeper accounts use (use account,account use) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', 'use', 'account', '--json'))
assert.equal(commandSchema.command.path, 'accounts use')

commandSchema = JSON.parse(ok('schema', 'accounts', 'remove', '--json'))
assert.equal(commandSchema.command.path, 'accounts remove')
assert.deepEqual(commandSchema.command.aliases, [['accounts', 'rm'], ['accounts', 'del'], ['remove', 'account'], ['account', 'remove'], ['account', 'rm'], ['account', 'del']])
assert.equal(commandSchema.command.usage, 'beeper accounts remove (accounts rm,accounts del,remove account,account remove,account rm,account del) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', 'remove', 'account', '--json'))
assert.equal(commandSchema.command.path, 'accounts remove')

commandSchema = JSON.parse(ok('schema', 'contacts', '--json'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['list', 'show'])
assert.deepEqual(commandSchema.command.aliases, [['contact']])

commandSchema = JSON.parse(ok('schema', 'contacts', 'get', '--json'))
assert.equal(commandSchema.command.path, 'contacts show')
assert.deepEqual(commandSchema.command.aliases, [['contacts', 'get'], ['contacts', 'info'], ['contact', 'show'], ['contact', 'get'], ['contact', 'info']])
assert.equal(commandSchema.command.usage, 'beeper contacts show (contacts get,contacts info,contact show,contact get,contact info) [<selector>] [flags]')

commandSchema = JSON.parse(ok('schema', 'contact', 'info', '--json'))
assert.equal(commandSchema.command.path, 'contacts show')
assert.equal(commandSchema.command.positionals[0].name, 'selector')
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'jid'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'pick'))

commandSchema = JSON.parse(ok('schema', 'contacts', 'search', '--json'))
assert.equal(commandSchema.command.path, 'contacts list')
assert.equal(commandSchema.command.positionals[0].name, 'query')
assert.equal(commandSchema.command.usage, 'beeper contacts list (contacts ls,contacts search,contacts find,contact list,contact ls,contact search,contact find) [<query>] [flags]')

commandSchema = JSON.parse(ok('schema', 'media', '--json'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['download', 'message'])

commandSchema = JSON.parse(ok('schema', 'media', 'message', '--json'))
assert.equal(commandSchema.command.path, 'media message')
assert.equal(commandSchema.command.usage, 'beeper media message [<id>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'id')

commandSchema = JSON.parse(ok('schema', 'groups', '--json'))
assert.equal(commandSchema.command.path, 'groups')
assert.deepEqual(commandSchema.command.aliases, [['group']])
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['list', 'show', 'create', 'rename', 'description'])

commandSchema = JSON.parse(ok('schema', 'group', 'ls', '--json'))
assert.equal(commandSchema.command.path, 'groups list')
assert.equal(commandSchema.command.usage, 'beeper groups list (groups ls,group list,group ls) [flags]')
assert.deepEqual(commandSchema.command.aliases, [['groups', 'ls'], ['group', 'list'], ['group', 'ls']])

commandSchema = JSON.parse(ok('schema', 'group', 'info', '--json'))
assert.equal(commandSchema.command.path, 'groups show')
assert.equal(commandSchema.command.usage, 'beeper groups show (groups info,group show,group info) [<jid>] [flags]')
assert.ok(commandSchema.command.positionals.some((arg: { name: string }) => arg.name === 'jid'))
assert.deepEqual(commandSchema.command.aliases, [['groups', 'info'], ['group', 'show'], ['group', 'info']])

commandSchema = JSON.parse(ok('schema', 'groups', 'create', '--json'))
assert.equal(commandSchema.command.path, 'groups create')
assert.deepEqual(commandSchema.command.aliases, [['groups', 'add'], ['groups', 'new'], ['group', 'create'], ['group', 'add'], ['group', 'new']])
assert.equal(commandSchema.command.usage, 'beeper groups create (groups add,groups new,group create,group add,group new) [flags]')

commandSchema = JSON.parse(ok('schema', 'group', 'add', '--json'))
assert.equal(commandSchema.command.path, 'groups create')

commandSchema = JSON.parse(ok('schema', 'groups', 'rename', '--json'))
assert.equal(commandSchema.command.path, 'groups rename')
assert.equal(commandSchema.command.usage, 'beeper groups rename (group rename) [<jid>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'jid')

commandSchema = JSON.parse(ok('schema', 'groups', 'description', '--json'))
assert.equal(commandSchema.command.path, 'groups description')
assert.equal(commandSchema.command.usage, 'beeper groups description (groups topic,group description,group topic) [<jid>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'jid')

commandSchema = JSON.parse(ok('schema', 'presence', '--json'))
assert.equal(commandSchema.command.path, 'presence')
assert.equal(commandSchema.command.usage, 'beeper presence <command> [flags]')
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['typing', 'paused'])

commandSchema = JSON.parse(ok('schema', 'presence', 'typing', '--json'))
assert.equal(commandSchema.command.path, 'presence typing')
assert.equal(commandSchema.command.usage, 'beeper presence typing [flags]')

commandSchema = JSON.parse(ok('schema', 'send', 'presence', '--json'))
assert.equal(commandSchema.command.path, 'send presence')
assert.equal(commandSchema.command.usage, 'beeper send presence [flags]')
assert.equal(commandSchema.command.risk, 'write')
assert.deepEqual(commandSchema.command.requirements, ['write'])

commandSchema = JSON.parse(ok('schema', 'messages', '--json'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['list', 'search', 'context', 'show', 'export', 'forward', 'edit', 'delete', 'revoke'])

commandSchema = JSON.parse(ok('schema', 'messages', 'list', '--json'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'from-me'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'from-them'))

commandSchema = JSON.parse(ok('schema', 'chats', '--json'))
assert.deepEqual(commandSchema.command.aliases, [['chat']])
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name).slice(0, 12), ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread'])

commandSchema = JSON.parse(ok('schema', 'chat', 'ls', '--json'))
assert.equal(commandSchema.command.path, 'chats list')
assert.ok(commandSchema.command.aliases.some((alias: string[]) => alias.join(' ') === 'chat ls'))
assert.ok(commandSchema.command.flags.some((flag: { default?: number; name: string; placeholder?: string }) => flag.name === 'limit' && flag.default === 50 && flag.placeholder === '50'))

commandSchema = JSON.parse(ok('schema', 'chats', 'show', '--json'))
assert.equal(commandSchema.command.path, 'chats show')
assert.equal(commandSchema.command.usage, 'beeper chats show (chats info,chat show,chat info) [<chat>] [flags]')
assert.ok(commandSchema.command.positionals.some((arg: { name: string }) => arg.name === 'chat'))
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; name: string }) => flag.name === 'chat' && flag.aliases?.includes('jid')))

commandSchema = JSON.parse(ok('schema', 'chat', 'info', '--json'))
assert.equal(commandSchema.command.path, 'chats show')

commandSchema = JSON.parse(ok('schema', 'chats', 'mark-unread', '--json'))
assert.equal(commandSchema.command.path, 'chats mark-unread')
assert.equal(commandSchema.command.usage, 'beeper chats mark-unread (chat mark-unread) [<chat>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'chat')
assert.equal(commandSchema.command.risk, 'write')

commandSchema = JSON.parse(ok('schema', 'messages', 'show', '--json'))
assert.equal(commandSchema.command.path, 'messages show')
assert.equal(commandSchema.command.usage, 'beeper messages show (messages get,messages info) [<id>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'id')
assert.deepEqual(commandSchema.command.aliases, [['messages', 'get'], ['messages', 'info']])
assert.equal(commandSchema.command.risk, 'read')

commandSchema = JSON.parse(ok('schema', 'messages', 'info', '--json'))
assert.equal(commandSchema.command.path, 'messages show')

commandSchema = JSON.parse(ok('schema', 'messages', 'export', '--json'))
assert.equal(commandSchema.command.path, 'messages export')
assert.equal(commandSchema.command.usage, 'beeper messages export [flags]')
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; default?: number; name: string }) => flag.name === 'limit' && flag.default === 1000))
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; name: string }) => flag.name === 'output' && flag.aliases?.includes('out')))

commandSchema = JSON.parse(ok('schema', 'messages', 'forward', '--json'))
assert.equal(commandSchema.command.path, 'messages forward')
assert.equal(commandSchema.command.usage, 'beeper messages forward [<id>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'id')
assert.equal(commandSchema.command.risk, 'write')
assert.ok(commandSchema.command.flags.some((flag: { default?: string; name: string }) => flag.name === 'post-send-wait' && flag.default === '2s'))

commandSchema = JSON.parse(ok('schema', 'messages', 'edit', '--json'))
assert.equal(commandSchema.command.path, 'messages edit')
assert.deepEqual(commandSchema.command.aliases, [['messages', 'update'], ['messages', 'set']])
assert.equal(commandSchema.command.usage, 'beeper messages edit (messages update,messages set) [<id>] [flags]')

commandSchema = JSON.parse(ok('schema', 'messages', 'set', '--json'))
assert.equal(commandSchema.command.path, 'messages edit')

commandSchema = JSON.parse(ok('schema', 'messages', 'delete', '--json'))
assert.equal(commandSchema.command.path, 'messages delete')
assert.deepEqual(commandSchema.command.aliases, [['messages', 'rm'], ['messages', 'del'], ['messages', 'remove']])
assert.equal(commandSchema.command.usage, 'beeper messages delete (messages rm,messages del,messages remove) [<id>] [flags]')

commandSchema = JSON.parse(ok('schema', 'messages', 'rm', '--json'))
assert.equal(commandSchema.command.path, 'messages delete')

commandSchema = JSON.parse(ok('schema', 'messages', 'revoke', '--json'))
assert.equal(commandSchema.command.path, 'messages revoke')
assert.equal(commandSchema.command.usage, 'beeper messages revoke [<id>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'id')
assert.equal(commandSchema.command.risk, 'destructive')

commandSchema = JSON.parse(ok('schema', 'watch', '--json'))
assert.equal(commandSchema.command.path, 'watch')
assert.ok(commandSchema.command.flags.some((flag: { default?: boolean; name: string }) => flag.name === 'webhook-allow-private' && flag.default === false))
assert.ok(commandSchema.command.flags.some((flag: { help?: string; name: string }) => flag.name === 'webhook-secret' && flag.help?.includes('X-Wacli-Signature')))

commandSchema = JSON.parse(ok('schema', 'exit-codes', '--json'))
assert.equal(commandSchema.command.path, 'exit-codes')
assert.equal(commandSchema.command.raw_json, true)
assert.equal(commandSchema.command.risk, 'read')

commandSchema = JSON.parse(ok('schema', 'config', 'show', '--json'))
assert.equal(commandSchema.command.path, 'config get')
assert.equal(commandSchema.command.name, 'get')
assert.equal(commandSchema.command.usage, 'beeper config get (config show) <key> [flags]')

commandSchema = JSON.parse(ok('schema', 'config', 'keys', '--json'))
assert.equal(commandSchema.command.path, 'config keys')
assert.equal(commandSchema.command.primary_result_key, 'keys')

commandSchema = JSON.parse(ok('schema', 'config', '--json'))
assert.equal(commandSchema.command.path, 'config')
assert.equal(commandSchema.command.help, 'config commands')
assert.equal(commandSchema.command.usage, 'beeper config <command> [flags]')
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'read-only'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['get', 'keys', 'set', 'unset', 'list', 'path'])
assert.ok(commandSchema.command.subcommands.some((command: { name: string }) => command.name === 'get'))

commandSchema = JSON.parse(ok('schema', 'docs', '--json'))
assert.equal(commandSchema.command.path, 'docs')
assert.ok(commandSchema.command.flags.some((flag: { aliases?: string[]; name: string }) => flag.name === 'url' && flag.aliases?.includes('url-only')))

commandSchema = JSON.parse(ok('schema', 'completion', 'zsh', '--json'))
assert.equal(commandSchema.command.path, 'completion zsh')
assert.equal(commandSchema.command.name, 'zsh')
assert.equal(commandSchema.command.usage, 'beeper completion zsh [flags]')
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'no-descriptions'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'json'))

commandSchema = JSON.parse(ok('schema', 'completion', '--json'))
assert.deepEqual(commandSchema.command.positionals[0].enum, ['bash', 'fish', 'powershell', 'zsh'])

commandSchema = JSON.parse(ok('schema', 'agent', '--json'))
assert.equal(commandSchema.command.usage, 'beeper agent <command> [flags]')
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string; usage: string }) => [command.name, command.usage]), [['exit-codes', 'beeper agent exit-codes (exitcodes,exit-code) [flags]']])

commandSchema = JSON.parse(ok('schema', 'schema', '--json'))
assert.equal(commandSchema.command.usage, 'beeper schema (help-json,helpjson) [<command> ...] [flags]')

commandSchema = JSON.parse(ok('schema', 'mcp', '--json'))
assert.equal(commandSchema.command.help, 'Run a typed, allowlisted MCP server over stdio or HTTP')
assert.ok(commandSchema.command.flags.some((flag: { help?: string; name: string; placeholder?: string }) => flag.name === 'allow-tool' && flag.placeholder === 'ALLOW-TOOL,...' && flag.help?.includes('default: all read-only tools')))
const mcpHelp = ok('mcp', '--help')
assert.match(mcpHelp, /--allow-tool=ALLOW-TOOL,\.\.\. \(\--tool\)/)
assert.match(mcpHelp, /beeper mcp --allow-tool targets\.\*,messages --list-tools/)

commandSchema = JSON.parse(ok('schema', 'send', '--json'))
assert.equal(commandSchema.command.path, 'send')
assert.equal(commandSchema.command.usage, 'beeper send [<to>] [<message> ...] [flags]')
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'message'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['text', 'file', 'voice', 'sticker', 'react', 'presence'])

commandSchema = JSON.parse(ok('schema', 'send', 'react', '--json'))
assert.deepEqual(commandSchema.command.aliases, [['send', 'reaction']])
assert.equal(commandSchema.command.usage, 'beeper send react (send reaction) [<id>] [flags]')
assert.equal(commandSchema.command.positionals[0].name, 'id')
assert.ok(commandSchema.command.flags.some((flag: { default?: string; name: string }) => flag.name === 'reaction' && flag.default === '+1'))

commandSchema = JSON.parse(ok('schema', 'send', 'reaction', '--json'))
assert.equal(commandSchema.command.path, 'send react')

commandSchema = JSON.parse(ok('schema', 'send', 'file', '--json'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'ptt'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'post-send-wait'))
assert.ok(commandSchema.command.flags.some((flag: { name: string }) => flag.name === 'reply-to-sender'))

commandSchema = JSON.parse(ok('schema', 'targets', '--json'))
assert.deepEqual(commandSchema.command.aliases, [['target']])
assert.equal(commandSchema.command.usage, 'beeper targets (target) <command> [flags]')
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['list', 'use', 'add', 'remove', 'logs', 'runtime', 'tunnel'])

commandSchema = JSON.parse(ok('schema', 'targets', 'use', '--json'))
assert.equal(commandSchema.command.path, 'targets use')
assert.deepEqual(commandSchema.command.aliases, [['use', 'target'], ['target', 'use']])
assert.equal(commandSchema.command.usage, 'beeper targets use (use target,target use) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', 'use', 'target', '--json'))
assert.equal(commandSchema.command.path, 'targets use')

commandSchema = JSON.parse(ok('schema', 'targets', 'runtime', '--json'))
assert.deepEqual(commandSchema.command.subcommands.map((command: { name: string }) => command.name), ['start', 'stop', 'restart'])

commandSchema = JSON.parse(ok('schema', 'target', 'runtime', 'restart', '--json'))
assert.equal(commandSchema.command.path, 'targets runtime restart')
assert.equal(commandSchema.command.program_path, 'beeper targets runtime restart')
assert.deepEqual(commandSchema.command.aliases, [['target', 'runtime', 'restart']])
assert.deepEqual(commandSchema.command.program_alias_paths, ['beeper target runtime restart'])

commandSchema = JSON.parse(ok('schema', 'target', 'del', '--json'))
assert.equal(commandSchema.command.path, 'targets remove')
assert.deepEqual(commandSchema.command.aliases, [['targets', 'rm'], ['targets', 'del'], ['remove', 'target'], ['target', 'remove'], ['target', 'rm'], ['target', 'del']])
assert.equal(commandSchema.command.usage, 'beeper targets remove (targets rm,targets del,remove target,target remove,target rm,target del) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', 'remove', 'target', '--json'))
assert.equal(commandSchema.command.path, 'targets remove')

commandSchema = JSON.parse(ok('schema', 'account', 'del', '--json'))
assert.equal(commandSchema.command.path, 'accounts remove')
assert.deepEqual(commandSchema.command.aliases, [['accounts', 'rm'], ['accounts', 'del'], ['remove', 'account'], ['account', 'remove'], ['account', 'rm'], ['account', 'del']])
assert.equal(commandSchema.command.usage, 'beeper accounts remove (accounts rm,accounts del,remove account,account remove,account rm,account del) <selector> [flags]')

commandSchema = JSON.parse(ok('schema', '--json', '--select=command.name', '--results-only', '--wrap-untrusted'))
assert.equal(commandSchema.schema_version, 1)
assert.equal(commandSchema.command.name, 'beeper')
assert.ok(Array.isArray(commandSchema.command.flags))

let filteredHelp = ok('--read-only', '--help')
assert.match(filteredHelp, /targets \(target\) <command> \[flags\]/)
assert.doesNotMatch(filteredHelp, /send text/)
assert.doesNotMatch(filteredHelp, /media download/)
assert.doesNotMatch(filteredHelp, /send presence/)

let filteredSchema = JSON.parse(ok('--read-only', 'schema', '--json'))
assert.equal(schemaPaths(filteredSchema).includes('send text'), false)
assert.equal(schemaPaths(filteredSchema).includes('targets list'), true)
assert.equal(schemaPaths(filteredSchema).includes('media download'), false)
assert.equal(schemaPaths(filteredSchema).includes('chats list'), true)

filteredHelp = ok('--enable-commands', 'messages', '--help')
assert.match(filteredHelp, /messages search/)
assert.doesNotMatch(filteredHelp, /targets list/)

filteredHelp = ok('--enable-commands', 'auth', 'auth', '--help')
assert.match(filteredHelp, /add \(login\) <email> \[flags\]/)
assert.match(filteredHelp, /status \[<target>\] \[flags\]/)
assert.match(filteredHelp, /doctor \[flags\]/)
assert.match(filteredHelp, /services \(bridges\) \[flags\]/)
assert.doesNotMatch(filteredHelp, /targets list/)

filteredHelp = ok('--enable-commands-exact', 'auth.services', 'auth', '--help')
assert.match(filteredHelp, /services \(bridges\) \[flags\]/)
assert.doesNotMatch(filteredHelp, /add \(login\) <email>/)

filteredSchema = JSON.parse(ok('--disable-commands', 'messages.search', 'schema', '--json'))
assert.equal(schemaPaths(filteredSchema).includes('messages search'), false)

filteredSchema = JSON.parse(ok('--enable-commands', 'auth,schema', 'schema', 'auth', '--json'))
assert.equal(schemaPaths(filteredSchema).includes('login'), true)
assert.equal(schemaPaths(filteredSchema).includes('auth status'), true)
assert.equal(schemaPaths(filteredSchema).includes('auth services'), true)

const docsDiffBefore = spawnSync('git', ['diff', '--', 'packages/cli/docs/commands'], { cwd: join(root, '..', '..'), encoding: 'utf8' }).stdout
result = spawnSync('bun', ['scripts/generate-command-docs.ts'], { cwd: root, encoding: 'utf8' })
assert.equal(result.status, 0, result.stderr)
const docsDiffAfter = spawnSync('git', ['diff', '--', 'packages/cli/docs/commands'], { cwd: join(root, '..', '..'), encoding: 'utf8' }).stdout
assert.equal(docsDiffAfter, docsDiffBefore, 'generated command docs are not idempotent')

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
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'me'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_search'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'contacts_list'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'accounts_show'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'contacts_show'))
assert.ok(payload.result.tools.some((tool: { _meta?: { command?: string; risk?: string; service?: string }; name: string }) => tool.name === 'me' && tool._meta?.command === 'me' && tool._meta?.risk === 'read' && tool._meta?.service === 'me'))
assert.ok(payload.result.tools.some((tool: { _meta?: { command?: string; risk?: string; service?: string }; name: string }) => tool.name === 'messages_search' && tool._meta?.command === 'messages search' && tool._meta?.risk === 'read' && tool._meta?.service === 'messages'))
assert.ok(payload.result.tools.some((tool: { _meta?: { command?: string; risk?: string; service?: string }; inputSchema?: { properties?: Record<string, unknown> }; name: string }) => tool.name === 'accounts_show' && tool._meta?.command === 'accounts show' && tool._meta?.risk === 'read' && tool.inputSchema?.properties?.selector))
assert.ok(payload.result.tools.some((tool: { _meta?: { command?: string; risk?: string; service?: string }; inputSchema?: { properties?: Record<string, unknown> }; name: string }) => tool.name === 'contacts_show' && tool._meta?.command === 'contacts show' && tool._meta?.risk === 'read' && tool.inputSchema?.properties?.selector))
assert.ok(payload.result.tools.some((tool: { inputSchema?: { properties?: Record<string, { enum?: string[]; type?: string }> }; name: string }) => tool.name === 'messages_search' && tool.inputSchema?.properties?.['chat-type']?.type === 'string' && tool.inputSchema?.properties?.['chat-type']?.enum?.includes('group')))
assert.ok(!payload.result.tools.some((tool: { name: string }) => tool.name === 'api_request'))
assert.ok(!payload.result.tools.some((tool: { name: string }) => tool.name === 'config_get'))
assert.ok(!payload.result.tools.some((tool: { name: string }) => tool.name === 'schema'))
assert.ok(!payload.result.tools.some((tool: { name: string }) => tool.name === 'send_text'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'resolve_target'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'resolve_chat'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_context'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_show'))
assert.ok(payload.result.tools.some((tool: { name: string }) => tool.name === 'messages_export'))

const mcpAllowWrite = spawnSync('bun', ['./bin/dev.js', 'mcp', '--allow-write', '--list-tools'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
})
assert.equal(mcpAllowWrite.status, 0, mcpAllowWrite.stderr)
payload = JSON.parse(mcpAllowWrite.stdout)
assert.ok(Array.isArray(payload.tools))
assert.ok(payload.tools.some((tool: { name: string }) => tool.name === 'send_text'))
assert.ok(payload.tools.some((tool: { name: string }) => tool.name === 'send_react'))
assert.ok(payload.tools.some((tool: { name: string }) => tool.name === 'chats_read'))
assert.ok(payload.tools.some((tool: { name: string; risk?: string; service?: string }) => tool.name === 'messages_edit' && tool.risk === 'write' && tool.service === 'messages'))
assert.ok(payload.tools.some((tool: { name: string; requirements?: string[] }) => tool.name === 'messages_edit' && tool.requirements?.includes('write')))
assert.ok(payload.tools.some((tool: { name: string; requirements?: string[] }) => tool.name === 'targets_list' && tool.requirements === undefined))
assert.ok(!payload.tools.some((tool: { name: string }) => tool.name === 'api_request'))
assert.ok(!payload.tools.some((tool: { name: string }) => tool.name === 'messages_delete'))
assert.ok(!payload.tools.some((tool: { inputSchema?: unknown }) => tool.inputSchema))

const mcpAllowComma = spawnSync('bun', ['./bin/dev.js', 'mcp', '--allow-tool', 'targets.*,messages', '--list-tools'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_HOME: configDir,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
})
assert.equal(mcpAllowComma.status, 0, mcpAllowComma.stderr)
payload = JSON.parse(mcpAllowComma.stdout)
assert.ok(payload.tools.some((tool: { name: string }) => tool.name === 'targets_list'))
assert.ok(payload.tools.some((tool: { name: string }) => tool.name === 'messages_search'))
assert.ok(!payload.tools.some((tool: { name: string }) => tool.name === 'contacts_list'))

const mcpAllowSnake = spawnSync('bun', ['./bin/dev.js', 'mcp', '--allow-tool', 'messages_search', '--list-tools'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_HOME: configDir,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
})
assert.equal(mcpAllowSnake.status, 0, mcpAllowSnake.stderr)
payload = JSON.parse(mcpAllowSnake.stdout)
assert.deepEqual(payload.tools.map((tool: { name: string }) => tool.name), ['messages_search'])

const mcpInitialize = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n',
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
  input: '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"targets_list","arguments":{}}}\n',
})
assert.equal(mcpCall.status, 0, mcpCall.stderr)
payload = JSON.parse(mcpCall.stdout)
const mcpTargets = JSON.parse(payload.result.content[0].text)
assert.equal(mcpTargets.exit_code, 0)
assert.equal(mcpTargets.tool, 'targets_list')
assert.ok(Array.isArray(mcpTargets.stdout))

const mcpHiddenWriteCall = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"send_text","arguments":{}}}\n',
})
assert.equal(mcpHiddenWriteCall.status, 0, mcpHiddenWriteCall.stderr)
payload = JSON.parse(mcpHiddenWriteCall.stdout)
assert.equal(payload.result.isError, true)
assert.match(payload.result.content[0].text, /Tool send_text not found/)

const mcpEOFCall = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"targets_list","arguments":{}}}',
})
assert.equal(mcpEOFCall.status, 0, mcpEOFCall.stderr)
payload = JSON.parse(mcpEOFCall.stdout)
assert.equal(payload.id, 4)
assert.equal(JSON.parse(payload.result.content[0].text).tool, 'targets_list')

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
assert.equal(mcpContext.stdout.dry_run, true)
assert.equal(mcpContext.stdout.request.after, 3)
assert.equal(mcpContext.stdout.request.before, 4)

const mcpStrictInputCall = spawnSync('bun', ['./bin/dev.js', 'mcp'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BEEPER_CLI_CONFIG_DIR: configDir,
  },
  input: '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"targets_list","arguments":{"unexpected":true}}}\n',
})
assert.equal(mcpStrictInputCall.status, 0, mcpStrictInputCall.stderr)
payload = JSON.parse(mcpStrictInputCall.stdout)
assert.equal(payload.result.isError, true)
assert.match(payload.result.content[0].text, /Unrecognized key/)

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

function schemaPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(schemaPaths)
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  return [
    typeof row.path === 'string' ? row.path : undefined,
    ...Object.values(row).flatMap(schemaPaths),
  ].filter((item): item is string => Boolean(item))
}

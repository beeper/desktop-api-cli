import { createHmac } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { stdout as output } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BeeperDesktop } from '@beeper/desktop-api'
import { apiItems, apiRecord } from '../lib/api-values.js'
import { appRequest } from '../lib/app-api.js'
import { evaluateReadiness } from '../lib/app-state.js'
import { printAccountLoginStep, runGuidedAccountLogin } from '../lib/account-login.js'
import { startCloudflareTunnel, type StartedTunnel } from '../lib/cloudflare-tunnel.js'
import { authFromToken, authorizeTarget } from '../lib/desktop-auth.js'
import { AbortError, ExitCodes } from '../lib/errors.js'
import { exportBeeperData } from '../lib/export.js'
import { installDesktop, installServer } from '../lib/installations.js'
import { collectPage } from '../lib/paging.js'
import { listAccountIDs, normalizeSelector, resolveAccountID, resolveAccountIDs, resolveChatID, userQueryFromInput } from '../lib/resolve.js'
import { normalizeServerEnv } from '../lib/server-env.js'
import { finishEmailSetup, startEmailSetup } from '../lib/setup-login.js'
import { targetLiveStatus } from '../lib/target-status.js'
import { promptChoice } from '../lib/prompts.js'
import {
  builtInDesktopTargetID,
  configPath,
  listTargets,
  publicTarget,
  readConfig,
  readTarget,
  removeTarget,
  resolveTarget,
  updateConfig,
  writeTarget,
  type Config,
  type Target,
} from '../lib/targets.js'
import WebSocket from 'ws'
import {
  desktopLogDir,
  launchDesktopApp,
  profileErrorLogPath,
  profileLogPath,
  startProfile,
  stopProfile,
} from '../lib/profiles.js'
import type { ArgSpec, CommandContext, CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { globalFlagSpecs, numberFlag, requiredStringFlag, stringFlag, stringListFlag } from './parse.js'
import { commandVisible } from './policy.js'
import { buildSchema } from './schema.js'
import { serveMcp } from './mcp.js'
import { usage, writeEvent, writeResult } from './output.js'
import { runSetup } from './setup.js'

type WebhookConfig = { inflight: number; max: number; queue: Array<{ body: string; secret?: string }>; secret?: string; url: string }
type EventFilter = { include?: Set<string>; exclude?: Set<string> }
type AttachmentType = 'sticker' | 'voice-note'
type SendKind = 'file' | 'sticker' | 'text' | 'voice'
type SendPayload = {
  attachmentType?: AttachmentType
  duration?: number
  file?: string
  fileName?: string
  forwardedUpload?: Record<string, unknown>
  mentions?: string[]
  mimeType?: string
  noPreview?: boolean
  ephemeral?: boolean
  ephemeralDuration?: string
  messageExpirySeconds?: number
  replyTo?: string
  replyToSender?: string
  text: string
  wait?: boolean
  waitTimeoutMs?: number
}

const accountFilterFlag: FlagSpec = { name: 'account', short: 'a', aliases: ['acct'], type: 'string', multiple: true, description: 'Limit to account selector' }
const candidateLimitFlag: FlagSpec = { name: 'limit', aliases: ['max'], type: 'integer', default: 10, description: 'Maximum candidates' }
const chatArg: ArgSpec = { name: 'chat', description: 'Chat selector. Used when --chat is omitted.' }
const chatFlag: FlagSpec = { name: 'chat', aliases: ['jid'], type: 'string', required: true, description: 'Chat selector' }
const optionalChatFlag: FlagSpec = { ...chatFlag, required: false }
const pickCandidateFlag: FlagSpec = { name: 'pick', type: 'integer', description: 'Select the Nth candidate' }
const pickChatFlag: FlagSpec = { name: 'pick', type: 'integer', description: 'Pick the Nth result when selector is ambiguous' }
const configKeys = ['defaultTarget', 'defaultAccount'] as const
type ConfigKey = typeof configKeys[number]

const chatFlags: FlagSpec[] = [
  chatFlag,
  pickChatFlag,
]
const optionalChatFlags: FlagSpec[] = [
  optionalChatFlag,
  pickChatFlag,
]

const installFlags: FlagSpec[] = [
  { name: 'channel', type: 'string', enum: ['stable', 'nightly'], default: 'stable', description: 'Install release channel' },
  { name: 'server-env', type: 'string', enum: ['local', 'dev', 'staging', 'prod'], default: 'prod', description: 'Server environment' },
]

const setupCommandFlags: FlagSpec[] = [
  { name: 'local', type: 'boolean', default: false, description: 'Use the local Beeper Desktop session on this device' },
  { name: 'oauth', type: 'boolean', default: false, description: 'Authorize the target with browser OAuth/PKCE' },
  { name: 'remote', type: 'string', description: 'Connect to a remote Beeper Desktop or Server URL' },
  { name: 'server', type: 'boolean', default: false, description: 'Set up a local Beeper Server target' },
  { name: 'desktop', type: 'boolean', default: false, description: 'Set up a local Beeper Desktop target' },
  { name: 'install', type: 'boolean', default: false, description: 'Allow installing a missing local runtime' },
  ...installFlags,
  { name: 'email', type: 'string', description: 'Sign in with an email address' },
  { name: 'username', type: 'string', description: 'Username to use if setup creates a new account' },
]

const sendChatFlags: FlagSpec[] = [
  { name: 'to', type: 'string', description: 'Chat selector' },
  pickChatFlag,
]

const sendDeliveryFlags: FlagSpec[] = [
  ...sendChatFlags,
  { name: 'reply-to', type: 'string', description: 'Send as a reply to this message ID' },
  { name: 'reply-to-sender', type: 'string', description: 'Accepted for compatibility; Beeper replies only need --reply-to' },
  { name: 'wait', type: 'boolean', default: false, description: 'Wait until the message leaves pending state' },
  { name: 'wait-timeout', type: 'integer', default: 30_000, description: 'Maximum wait time in ms when --wait is set' },
  { name: 'post-send-wait', type: 'string', description: 'Compatibility alias for waiting after send, for example 2s or 500ms; 0 disables waiting' },
]

const presenceFlags: FlagSpec[] = [
  ...sendChatFlags,
  { name: 'duration', type: 'integer', description: 'Seconds to keep typing before sending paused' },
  { name: 'state', type: 'string', enum: ['typing', 'paused'], default: 'typing', description: 'Presence indicator to send' },
]

function messageListFlags(limitDefault = 50, limitDescription = 'Maximum messages to print'): FlagSpec[] {
  return [
    { name: 'after-cursor', aliases: ['after'], type: 'string', description: 'Paginate messages newer than this message ID' },
    { name: 'asc', type: 'boolean', default: false, description: 'Order oldest first' },
    { name: 'before-cursor', aliases: ['before'], type: 'string', description: 'Paginate messages older than this message ID' },
    chatFlag,
    { name: 'limit', type: 'integer', default: limitDefault, description: limitDescription },
    pickChatFlag,
    { name: 'sender', type: 'string', description: 'me, others, or a specific user ID' },
    { name: 'from-me', type: 'boolean', default: false, description: 'Only messages sent by me' },
    { name: 'from-them', type: 'boolean', default: false, description: 'Only messages sent by others' },
    { name: 'type', type: 'string', enum: ['text', 'image', 'video', 'audio', 'document', 'file', 'link'], description: 'Only messages of this kind' },
    { name: 'has-media', type: 'boolean', default: false, description: 'Only messages with media' },
  ]
}

export const commands: CommandSpec[] = [
  {
    description: 'Print version',
    output: 'diagnostic',
    path: ['version'],
    risk: 'read',
    run: version,
  },
  {
    args: [{ name: 'target', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['st']],
    description: 'Show auth, config, selected target, and setup readiness',
    mcp: true,
    output: 'status',
    path: ['status'],
    risk: 'read',
    run: status,
  },
  {
    aliases: [['whoami'], ['who-am-i']],
    description: 'Show selected account and target identity',
    flags: [accountFilterFlag],
    mcp: true,
    path: ['me'],
    risk: 'read',
    run: me,
  },
  {
    aliases: [['auth', 'doctor']],
    description: 'Run diagnostics for config, target reachability, auth, and readiness',
    flags: [{ name: 'connect', type: 'boolean', default: false, description: 'Accepted for compatibility; doctor always checks selected target reachability' }],
    output: 'diagnostic',
    path: ['doctor'],
    risk: 'read',
    run: doctor,
  },
  {
    description: 'Agent-friendly helpers',
    output: 'diagnostic',
    path: ['agent'],
    risk: 'read',
    run: agent,
  },
  {
    aliases: [['agent', 'exit-codes'], ['agent', 'exitcodes'], ['agent', 'exit-code'], ['exitcodes']],
    description: 'Print stable exit codes for automation',
    output: 'diagnostic',
    path: ['exit-codes'],
    rawJson: true,
    risk: 'read',
    run: exitCodes,
  },
  {
    aliases: [['help-docs']],
    description: 'Print command documentation locations',
    flags: [{ name: 'url', aliases: ['url-only'], type: 'boolean', default: false, description: 'Print only the documentation URL' }],
    output: 'diagnostic',
    path: ['docs'],
    risk: 'read',
    run: docs,
  },
  {
    args: [{ name: 'command', variadic: true, description: 'Command path to describe' }],
    description: 'Show help for a command',
    path: ['help'],
    risk: 'read',
    run: helpCommand,
  },
  {
    args: [{ name: 'command', variadic: true, description: 'Optional command path to describe. Default: entire CLI' }],
    aliases: [['help-json'], ['helpjson']],
    description: 'Machine-readable command/flag schema',
    flags: [{ name: 'include-hidden', type: 'boolean', default: false, description: 'Include hidden commands' }],
    path: ['schema'],
    rawJson: true,
    risk: 'read',
    run: schema,
  },
  {
    description: 'Run a typed, allowlisted MCP server over stdio or HTTP',
    examples: [
      'beeper mcp',
      'beeper mcp --allow-tool targets.*,messages --list-tools',
      'beeper mcp --allow-write --allow-tool send_text',
    ],
    flags: [
      { name: 'allow-tool', aliases: ['tool'], type: 'string', multiple: true, placeholder: 'ALLOW-TOOL,...', description: 'Tool or service allowlist (default: all read-only tools). Examples: targets.*,messages_search,send' },
      { name: 'allow-write', type: 'boolean', default: false, description: 'Allow write-risk MCP tools' },
      { name: 'transport', type: 'string', enum: ['stdio', 'http'], default: 'stdio', description: 'MCP transport' },
      { name: 'http-host', type: 'string', default: '127.0.0.1', description: 'Host for --transport=http' },
      { name: 'http-port', type: 'integer', default: 7331, description: 'Port for --transport=http. Use 0 to choose a free port' },
      { name: 'http-path', type: 'string', default: '/mcp', description: 'HTTP path for --transport=http' },
      { name: 'list-tools', type: 'boolean', default: false, description: 'Print enabled MCP tools as JSON and exit' },
      { name: 'max-output-bytes', type: 'integer', default: 102400, description: 'Maximum stdout/stderr bytes captured per tool call' },
      { name: 'timeout-seconds', type: 'integer', default: 60, description: 'Per-tool subprocess timeout' },
    ],
    path: ['mcp'],
    risk: 'read',
    run: mcp,
  },
  {
    args: [{ name: 'shell', required: true, enum: ['bash', 'fish', 'powershell', 'zsh'], description: 'Shell (bash|zsh|fish|powershell)' }],
    description: 'Generate shell completion scripts',
    hidden: false,
    path: ['completion'],
    risk: 'read',
    run: completion,
  },
  {
    description: 'Generate the autocompletion script for bash',
    flags: [{ name: 'no-descriptions', type: 'boolean', default: false, description: 'Accepted for compatibility; completion descriptions are not emitted' }],
    path: ['completion', 'bash'],
    risk: 'read',
    run: completionShell,
  },
  {
    description: 'Generate the autocompletion script for fish',
    flags: [{ name: 'no-descriptions', type: 'boolean', default: false, description: 'Accepted for compatibility; completion descriptions are not emitted' }],
    path: ['completion', 'fish'],
    risk: 'read',
    run: completionShell,
  },
  {
    aliases: [['completion', 'pwsh']],
    description: 'Generate the autocompletion script for powershell',
    flags: [{ name: 'no-descriptions', type: 'boolean', default: false, description: 'Accepted for compatibility; completion descriptions are not emitted' }],
    path: ['completion', 'powershell'],
    risk: 'read',
    run: completionShell,
  },
  {
    description: 'Generate the autocompletion script for zsh',
    flags: [{ name: 'no-descriptions', type: 'boolean', default: false, description: 'Accepted for compatibility; completion descriptions are not emitted' }],
    path: ['completion', 'zsh'],
    risk: 'read',
    run: completionShell,
  },
  {
    aliases: [['config', 'show']],
    args: [{ name: 'key', required: true, description: 'Config key to get' }],
    description: 'Get a config value',
    output: 'diagnostic',
    path: ['config', 'get'],
    risk: 'read',
    run: configGet,
  },
  {
    aliases: [['config', 'list-keys'], ['config', 'names']],
    description: 'List available config keys',
    path: ['config', 'keys'],
    risk: 'read',
    run: configKeysCommand,
  },
  {
    aliases: [['config', 'ls'], ['config', 'all']],
    description: 'List all config values',
    output: 'diagnostic',
    path: ['config', 'list'],
    risk: 'read',
    run: configList,
  },
  {
    aliases: [['config', 'where']],
    description: 'Print config file path',
    output: 'diagnostic',
    path: ['config', 'path'],
    risk: 'read',
    run: configPathCommand,
  },
  {
    aliases: [['config', 'add'], ['config', 'update']],
    args: [
      { name: 'key', required: true, description: 'Config key to set' },
      { name: 'value', required: true, description: 'Value to set' },
    ],
    description: 'Set a config value',
    output: 'diagnostic',
    path: ['config', 'set'],
    risk: 'write',
    run: configSet,
  },
  {
    aliases: [['config', 'rm'], ['config', 'del'], ['config', 'remove']],
    args: [{ name: 'key', required: true, description: 'Config key to unset' }],
    description: 'Unset a config value',
    output: 'diagnostic',
    path: ['config', 'unset'],
    risk: 'write',
    run: configUnset,
  },
  {
    args: [{ name: 'words', variadic: true, description: 'Current command line words' }],
    description: 'Internal completion helper',
    flags: [{ name: 'cword', type: 'integer', default: -1, description: 'Current word index' }],
    hidden: true,
    path: ['__complete'],
    risk: 'read',
    run: completeCommand,
  },
  {
    description: 'Make the selected target ready for messaging',
    examples: ['beeper setup', 'beeper setup --local', 'beeper setup --remote https://desktop.example.com', 'beeper setup --desktop --install'],
    flags: setupCommandFlags,
    path: ['setup'],
    risk: 'write',
    run: runSetup,
  },
  {
    aliases: [['targets', 'ls'], ['target', 'list'], ['target', 'ls']],
    description: 'List configured Beeper targets',
    mcp: true,
    output: 'targets',
    path: ['targets', 'list'],
    risk: 'read',
    run: targetsList,
  },
  {
    args: [
      { name: 'name', required: true, description: 'Target name' },
      { name: 'url', required: true, description: 'Target base URL' },
    ],
    description: 'Add a remote Beeper Desktop or Server target',
    flags: [{ name: 'default', type: 'boolean', default: false, description: 'Set this target as the default after creation' }],
    aliases: [['target', 'add']],
    path: ['targets', 'add'],
    risk: 'write',
    run: targetsAdd,
  },
  {
    args: [{ name: 'name', description: 'Target name. Defaults to the selected target.' }],
    description: 'Expose a target through Cloudflare Tunnel',
    flags: [
      { name: 'cloudflared-path', type: 'string', description: 'Path to cloudflared. Also configurable with BEEPER_CLOUDFLARED_PATH.' },
      { name: 'install', type: 'boolean', default: false, description: 'Download the pinned cloudflared binary if missing or outdated' },
      { name: 'retries', type: 'integer', default: 5, description: 'Startup retries before giving up' },
      { name: 'timeout', type: 'string', description: 'Startup timeout, for example 40s or 60000ms' },
      { name: 'url-only', type: 'boolean', default: false, description: 'Print only the public tunnel URL' },
    ],
    aliases: [['target', 'tunnel']],
    path: ['targets', 'tunnel'],
    risk: 'write',
    run: targetsTunnel,
  },
  {
    description: 'Install Beeper Desktop locally',
    flags: installFlags,
    path: ['install', 'desktop'],
    risk: 'write',
    run: installCommand,
  },
  {
    description: 'Install Beeper Server locally',
    flags: installFlags,
    path: ['install', 'server'],
    risk: 'write',
    run: installCommand,
  },
  {
    args: [{ name: 'target', description: 'Target name. Defaults to the selected target.' }],
    description: 'Clear stored authentication',
    aliases: [['logout'], ['auth', 'remove'], ['auth', 'rm'], ['auth', 'del']],
    path: ['auth', 'logout'],
    risk: 'write',
    run: authLogout,
  },
  {
    aliases: [['auth', 'ls']],
    description: 'List stored target credentials',
    output: 'auth',
    path: ['auth', 'list'],
    risk: 'read',
    run: authList,
  },
  {
    args: [{ name: 'target', description: 'Target name. Defaults to the selected target.' }],
    description: 'Show auth configuration and stored target credential status',
    output: 'diagnostic',
    path: ['auth', 'status'],
    risk: 'read',
    run: authStatus,
  },
  {
    aliases: [['auth', 'bridges']],
    description: 'List supported account login services and bridges',
    flags: [{ name: 'markdown', type: 'boolean', default: false, description: 'Output a Markdown table' }],
    path: ['auth', 'services'],
    risk: 'read',
    run: authServices,
  },
  {
    aliases: [['auth', 'setup'], ['auth', 'connect']],
    description: 'Make the selected target ready for messaging',
    examples: ['beeper auth manage', 'beeper auth manage --local', 'beeper auth manage --oauth'],
    flags: setupCommandFlags,
    path: ['auth', 'manage'],
    risk: 'write',
    run: runSetup,
  },
  {
    args: [{ name: 'email', required: true, description: 'Email address' }],
    aliases: [['auth', 'add'], ['auth', 'login']],
    description: 'Start email sign-in for a target',
    path: ['login'],
    risk: 'write',
    run: login,
  },
  {
    description: 'Start email sign-in for a target',
    flags: [{ name: 'email', type: 'string', required: true, description: 'Email address' }],
    path: ['auth', 'email', 'start'],
    risk: 'write',
    run: authEmailStart,
  },
  {
    description: 'Finish email sign-in for a target',
    flags: [
      { name: 'code', type: 'string', required: true, description: 'Email verification code' },
      { name: 'setup-request-id', type: 'string', required: true, description: 'Setup request ID from auth email start' },
      { name: 'username', type: 'string', description: 'Username to use if setup creates a new account' },
    ],
    path: ['auth', 'email', 'response'],
    risk: 'write',
    run: authEmailResponse,
  },
  {
    aliases: [['accounts', 'ls'], ['account', 'list'], ['account', 'ls']],
    description: 'List connected accounts',
    flags: [
      accountFilterFlag,
      { name: 'ids', type: 'boolean', default: false, description: 'Print only account IDs' },
    ],
    mcp: true,
    output: 'accounts',
    path: ['accounts', 'list'],
    risk: 'read',
    run: accountsList,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    aliases: [['accounts', 'get'], ['accounts', 'info'], ['account', 'show'], ['account', 'get'], ['account', 'info']],
    description: 'Show one connected account',
    mcp: true,
    output: 'accounts',
    path: ['accounts', 'show'],
    risk: 'read',
    run: accountsShow,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Target name' }],
    aliases: [['use', 'target'], ['target', 'use']],
    description: 'Select the default target',
    path: ['targets', 'use'],
    risk: 'write',
    run: useTarget,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    aliases: [['use', 'account'], ['account', 'use']],
    description: 'Select the default account',
    path: ['accounts', 'use'],
    risk: 'write',
    run: useAccount,
  },
  {
    args: [{ name: 'bridge', description: 'Bridge ID, name, or network to connect' }],
    description: 'Connect a chat account by bridge',
    flags: [
      { name: 'cookie', type: 'string', multiple: true, description: 'Cookie value in name=value form' },
      { name: 'field', type: 'string', multiple: true, description: 'Field value in id=value form' },
      { name: 'flow', type: 'string', description: 'Login flow ID' },
      { name: 'guided', type: 'boolean', default: true, description: 'Prompt through login steps' },
      { name: 'login-id', type: 'string', description: 'Existing login ID to re-login as' },
      { name: 'webview', type: 'boolean', default: false, description: 'Use Bun.WebView for cookie login steps' },
      { name: 'webview-backend', type: 'string', enum: ['auto', 'chrome', 'webkit'], default: 'chrome', description: 'Bun.WebView backend' },
      { name: 'webview-timeout', type: 'integer', default: 120, description: 'Seconds to wait for WebView cookie collection' },
    ],
    aliases: [['accounts', 'create'], ['accounts', 'new'], ['account', 'add'], ['account', 'create'], ['account', 'new']],
    path: ['accounts', 'add'],
    risk: 'write',
    run: accountsAdd,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Target name' }],
    aliases: [['targets', 'rm'], ['targets', 'del'], ['remove', 'target'], ['target', 'remove'], ['target', 'rm'], ['target', 'del']],
    description: 'Remove a target',
    path: ['targets', 'remove'],
    risk: 'destructive',
    run: removeTargetCommand,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    aliases: [['accounts', 'rm'], ['accounts', 'del'], ['remove', 'account'], ['account', 'remove'], ['account', 'rm'], ['account', 'del']],
    description: 'Remove an account',
    path: ['accounts', 'remove'],
    risk: 'destructive',
    run: removeAccount,
  },
  {
    args: [{ name: 'query', description: 'Optional contact lookup query. Used when --query is omitted.' }],
    aliases: [['contacts', 'ls'], ['contacts', 'search'], ['contacts', 'find'], ['contact', 'list'], ['contact', 'ls'], ['contact', 'search'], ['contact', 'find']],
    description: 'List contacts',
    flags: [
      accountFilterFlag,
      { name: 'ids', type: 'boolean', default: false, description: 'Print only contact user IDs' },
      { name: 'limit', type: 'integer', default: 50, description: 'Maximum contacts to print' },
      { name: 'query', type: 'string', description: 'Optional contact lookup query' },
    ],
    mcp: true,
    output: 'contacts',
    path: ['contacts', 'list'],
    risk: 'read',
    run: contactsList,
  },
  {
    args: [{ name: 'selector', description: 'Contact selector. Used when --jid is omitted.' }],
    aliases: [['contacts', 'get'], ['contacts', 'info'], ['contact', 'show'], ['contact', 'get'], ['contact', 'info']],
    description: 'Show one contact',
    flags: [
      accountFilterFlag,
      { name: 'jid', type: 'string', description: 'Contact JID or user ID' },
      candidateLimitFlag,
      pickCandidateFlag,
    ],
    mcp: true,
    output: 'contacts',
    path: ['contacts', 'show'],
    risk: 'read',
    run: contactsShow,
  },
  {
    aliases: [['chats', 'ls'], ['chat', 'list'], ['chat', 'ls'], ['ls'], ['list']],
    description: 'List chats',
    flags: [
      accountFilterFlag,
      { name: 'archived', type: 'boolean', description: 'Only archived chats; use --no-archived to exclude' },
      { name: 'ids', type: 'boolean', default: false, description: 'Print preferred chat selectors' },
      { name: 'limit', type: 'integer', default: 50, description: 'Maximum chats to print' },
      { name: 'low-priority', type: 'boolean', description: 'Only low-priority chats; use --no-low-priority to exclude' },
      { name: 'muted', type: 'boolean', description: 'Only muted chats; use --no-muted to exclude' },
      { name: 'pinned', type: 'boolean', description: 'Only pinned chats; use --no-pinned to exclude' },
      { name: 'query', type: 'string', description: 'Optional chat lookup query' },
      { name: 'type', aliases: ['chat-type'], type: 'string', enum: ['single', 'group', 'any'], description: 'Only direct messages, group chats, or all chats' },
      { name: 'unread', type: 'boolean', description: 'Only unread chats; use --no-unread to exclude' },
    ],
    mcp: true,
    output: 'chats',
    path: ['chats', 'list'],
    risk: 'read',
    run: chatsList,
  },
  {
    aliases: [['groups', 'ls'], ['group', 'list'], ['group', 'ls']],
    description: 'List group chats',
    flags: [
      accountFilterFlag,
      { name: 'ids', type: 'boolean', default: false, description: 'Print preferred chat selectors' },
      { name: 'limit', type: 'integer', default: 50, description: 'Maximum groups to print' },
      { name: 'query', type: 'string', description: 'Optional group lookup query' },
    ],
    output: 'chats',
    path: ['groups', 'list'],
    risk: 'read',
    run: groupsList,
  },
  {
    args: [{ name: 'jid', description: 'Group chat selector. Used when --jid is omitted.' }],
    aliases: [['groups', 'info'], ['group', 'show'], ['group', 'info']],
    description: 'Show group details',
    flags: [
      { name: 'jid', aliases: ['chat'], type: 'string', description: 'Group chat selector' },
      { name: 'max-participants', type: 'integer', description: 'Limit participants returned in group details' },
      pickChatFlag,
    ],
    path: ['groups', 'show'],
    risk: 'read',
    run: groupsShow,
  },
  {
    aliases: [['groups', 'add'], ['groups', 'new'], ['group', 'create'], ['group', 'add'], ['group', 'new']],
    description: 'Create a group chat',
    flags: [
      { name: 'account', type: 'string', description: 'Account selector' },
      { name: 'name', aliases: ['title'], type: 'string', required: true, description: 'Group name' },
      { name: 'user', type: 'string', multiple: true, required: true, description: 'Initial participant user ID, phone, or handle' },
      { name: 'message', type: 'string', description: 'Optional first message text' },
    ],
    path: ['groups', 'create'],
    risk: 'write',
    run: groupsCreate,
  },
  {
    args: [{ name: 'jid', description: 'Group chat selector. Used when --jid is omitted.' }],
    aliases: [['group', 'rename']],
    description: 'Rename a group',
    flags: [
      { name: 'jid', aliases: ['chat'], type: 'string', description: 'Group chat selector' },
      { name: 'name', aliases: ['title'], type: 'string', required: true, description: 'New group name' },
      pickChatFlag,
    ],
    path: ['groups', 'rename'],
    risk: 'write',
    run: groupsRename,
  },
  {
    args: [{ name: 'jid', description: 'Group chat selector. Used when --jid is omitted.' }],
    aliases: [['groups', 'topic'], ['group', 'description'], ['group', 'topic']],
    description: 'Set or clear a group description',
    flags: [
      { name: 'jid', aliases: ['chat'], type: 'string', description: 'Group chat selector' },
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the description' },
      { name: 'description', aliases: ['topic'], type: 'string', description: 'Group description' },
      pickChatFlag,
    ],
    path: ['groups', 'description'],
    risk: 'write',
    run: groupsDescription,
  },
  {
    args: [{ name: 'chat', description: 'Chat selector. Used when --chat is omitted.' }],
    aliases: [['chats', 'info'], ['chat', 'show'], ['chat', 'info']],
    description: 'Show chat details',
    flags: [
      { ...chatFlag, required: false },
      { name: 'max-participants', type: 'integer', description: 'Limit participants returned in chat details' },
      pickChatFlag,
    ],
    mcp: true,
    path: ['chats', 'show'],
    risk: 'read',
    run: chatsShow,
  },
  {
    args: [{ name: 'user', required: true, description: 'User ID, phone, handle, or contact selector' }],
    aliases: [['chat', 'start']],
    description: 'Start a chat',
    flags: [
      { name: 'account', type: 'string', description: 'Account selector' },
      { name: 'title', type: 'string', description: 'Optional initial title for a new group chat' },
    ],
    path: ['chats', 'start'],
    risk: 'write',
    run: chatsStart,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'archive']],
    description: 'Archive or unarchive a chat',
    flags: [...optionalChatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unarchive the chat' }],
    path: ['chats', 'archive'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'unarchive']],
    description: 'Unarchive a chat',
    flags: optionalChatFlags,
    path: ['chats', 'unarchive'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'pin']],
    description: 'Pin or unpin a chat',
    flags: [...optionalChatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unpin the chat' }],
    path: ['chats', 'pin'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'unpin']],
    description: 'Unpin a chat',
    flags: optionalChatFlags,
    path: ['chats', 'unpin'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'mute']],
    description: 'Mute or unmute a chat',
    flags: [...optionalChatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unmute the chat' }],
    path: ['chats', 'mute'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'unmute']],
    description: 'Unmute a chat',
    flags: optionalChatFlags,
    path: ['chats', 'unmute'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'rename']],
    description: 'Rename a chat',
    flags: [...optionalChatFlags, { name: 'title', type: 'string', required: true, description: 'Chat title' }],
    path: ['chats', 'rename'],
    risk: 'write',
    run: chatsRename,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'description']],
    description: 'Set or clear a chat description',
    flags: [
      ...optionalChatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear or unset the chosen state' },
      { name: 'description', type: 'string', description: 'Chat description' },
    ],
    path: ['chats', 'description'],
    risk: 'write',
    run: chatsDescription,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'avatar']],
    description: 'Set or clear a chat avatar',
    flags: [
      ...optionalChatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the avatar' },
      { name: 'file', type: 'string', description: 'Avatar image file path' },
    ],
    path: ['chats', 'avatar'],
    risk: 'write',
    run: chatsAvatar,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'priority']],
    description: 'Set chat priority',
    flags: [...optionalChatFlags, { name: 'level', type: 'string', required: true, enum: ['inbox', 'low'], description: 'Chat priority level' }],
    path: ['chats', 'priority'],
    risk: 'write',
    run: chatsPriority,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'read']],
    description: 'Mark a chat read or unread',
    flags: [
      ...optionalChatFlags,
      { name: 'message', type: 'string', description: 'Read marker message ID' },
      { name: 'unread', type: 'boolean', default: false, description: 'Mark the chat unread' },
    ],
    mcp: true,
    path: ['chats', 'read'],
    risk: 'write',
    run: chatsRead,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'mark-read']],
    description: 'Mark a chat as read',
    flags: [...optionalChatFlags, { name: 'message', type: 'string', description: 'Read marker message ID' }],
    path: ['chats', 'mark-read'],
    risk: 'write',
    run: chatsRead,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'mark-unread']],
    description: 'Mark a chat as unread',
    flags: optionalChatFlags,
    path: ['chats', 'mark-unread'],
    risk: 'write',
    run: chatsRead,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'draft']],
    description: 'Set or clear a chat draft',
    flags: [
      ...optionalChatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the draft' },
      { name: 'file', type: 'string', description: 'Draft attachment file path' },
      { name: 'filename', type: 'string', description: 'Draft attachment filename' },
      { name: 'mime', type: 'string', description: 'Draft attachment MIME type' },
      { name: 'text', type: 'string', description: 'Draft text' },
    ],
    path: ['chats', 'draft'],
    risk: 'write',
    run: chatsDraft,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'remind']],
    description: 'Set or clear a chat reminder',
    flags: [
      ...optionalChatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the reminder' },
      { name: 'dismiss-on-message', type: 'boolean', default: false, description: 'Dismiss reminder when a new message arrives' },
      { name: 'when', type: 'string', description: 'ISO reminder timestamp' },
    ],
    path: ['chats', 'remind'],
    risk: 'write',
    run: chatsRemind,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'disappear']],
    description: 'Set a disappearing-message timer',
    flags: [
      ...optionalChatFlags,
      { name: 'seconds', aliases: ['duration', 'ephemeral-duration'], type: 'string', description: 'Disappearing-message timer in seconds, duration form like 24h/7d/90d, or off' },
    ],
    path: ['chats', 'disappear'],
    risk: 'write',
    run: chatsDisappear,
  },
  {
    args: [{ name: 'chat', description: 'Chat selector. Used when --chat is omitted.' }],
    aliases: [['chat', 'focus'], ['open'], ['browse'], ['focus']],
    description: 'Focus a chat in Beeper',
    flags: [
      { ...chatFlag, required: false },
      pickChatFlag,
      { name: 'file', type: 'string', description: 'Draft attachment file path' },
      { name: 'message', type: 'string', description: 'Message ID to focus' },
      { name: 'text', type: 'string', description: 'Draft text' },
    ],
    path: ['chats', 'focus'],
    risk: 'write',
    run: chatsFocus,
  },
  {
    args: [chatArg],
    aliases: [['chat', 'notify-anyway']],
    description: 'Notify a chat anyway',
    flags: optionalChatFlags,
    path: ['chats', 'notify-anyway'],
    risk: 'write',
    run: chatsNotifyAnyway,
  },
  {
    aliases: [['search-all'], ['find-all']],
    args: [{ name: 'query', required: true, description: 'Search query' }],
    description: 'Search chats, group participants, and messages together',
    output: 'diagnostic',
    path: ['search', 'all'],
    risk: 'read',
    run: unifiedSearch,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    description: 'Resolve an account selector',
    flags: [pickCandidateFlag],
    mcp: true,
    path: ['resolve', 'account'],
    risk: 'read',
    run: resolveAccount,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Bridge selector' }],
    description: 'Resolve a bridge selector',
    flags: [pickCandidateFlag],
    path: ['resolve', 'bridge'],
    risk: 'read',
    run: resolveBridge,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Chat selector' }],
    description: 'Resolve a chat selector',
    flags: [
      accountFilterFlag,
      candidateLimitFlag,
      pickCandidateFlag,
    ],
    mcp: true,
    path: ['resolve', 'chat'],
    risk: 'read',
    run: resolveChat,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Contact selector' }],
    description: 'Resolve a contact selector',
    flags: [
      accountFilterFlag,
      candidateLimitFlag,
      pickCandidateFlag,
    ],
    mcp: true,
    path: ['resolve', 'contact'],
    risk: 'read',
    run: resolveContact,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Target selector' }],
    description: 'Resolve a target selector',
    flags: [pickCandidateFlag],
    mcp: true,
    path: ['resolve', 'target'],
    risk: 'read',
    run: resolveTargetCommand,
  },
  {
    description: 'List chat messages',
    aliases: [['messages', 'ls']],
    flags: [...messageListFlags(), { name: 'ids', type: 'boolean', default: false, description: 'Print only message IDs' }],
    mcp: true,
    output: 'messages',
    path: ['messages', 'list'],
    risk: 'read',
    run: messagesList,
  },
  {
    args: [{ name: 'id', description: 'Message ID. Used when --id is omitted.' }],
    description: 'Show a message with surrounding context',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', description: 'Message ID' },
      { name: 'after', type: 'integer', default: 10, description: 'Messages after target' },
      { name: 'before', type: 'integer', default: 10, description: 'Messages before target' },
    ],
    mcp: true,
    path: ['messages', 'context'],
    risk: 'read',
    run: messagesContext,
  },
  {
    args: [{ name: 'id', description: 'Message ID. Used when --id is omitted.' }],
    aliases: [['messages', 'get'], ['messages', 'info']],
    description: 'Show one message',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', description: 'Message ID' },
    ],
    mcp: true,
    path: ['messages', 'show'],
    risk: 'read',
    run: messagesContext,
  },
  {
    description: 'Export messages as JSON',
    flags: [
      ...messageListFlags(1000, 'Maximum messages to export'),
      { name: 'output', aliases: ['out'], type: 'string', description: 'Write JSON export to file instead of stdout' },
    ],
    output: 'messages',
    path: ['messages', 'export'],
    risk: 'read',
    run: messagesExport,
  },
  {
    args: [{ name: 'id', description: 'Source message ID. Used when --id is omitted.' }],
    description: 'Forward a message',
    flags: [
      chatFlag,
      { name: 'id', type: 'string', description: 'Source message ID' },
      { name: 'to', type: 'string', required: true, description: 'Destination chat selector' },
      pickChatFlag,
      { name: 'attachment-index', type: 'integer', default: 1, description: 'Attachment index to forward when the message has media, 1-based' },
      { name: 'post-send-wait', type: 'string', default: '2s', description: 'Compatibility alias for waiting after forward, for example 2s or 500ms; 0 disables waiting' },
      { name: 'wait', type: 'boolean', default: false, description: 'Wait until the forwarded message leaves pending state' },
      { name: 'wait-timeout', type: 'integer', default: 30_000, description: 'Maximum wait time in ms when --wait is set' },
    ],
    path: ['messages', 'forward'],
    risk: 'write',
    run: messagesForward,
  },
  {
    args: [{ name: 'id', description: 'Message ID. Used when --id is omitted.' }],
    aliases: [['messages', 'update'], ['messages', 'set']],
    description: 'Edit a message',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', description: 'Message ID' },
      { name: 'message', type: 'string', required: true, description: 'New message text' },
    ],
    mcp: true,
    path: ['messages', 'edit'],
    risk: 'write',
    run: messagesEdit,
  },
  {
    args: [{ name: 'id', description: 'Message ID. Used when --id is omitted.' }],
    aliases: [['messages', 'rm'], ['messages', 'del'], ['messages', 'remove']],
    description: 'Delete a message',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', description: 'Message ID' },
      { name: 'for-everyone', type: 'boolean', default: false, description: 'Delete for everyone when supported' },
    ],
    path: ['messages', 'delete'],
    risk: 'destructive',
    run: messagesDelete,
  },
  {
    args: [{ name: 'id', description: 'Message ID. Used when --id is omitted.' }],
    description: 'Delete a sent message for everyone',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', description: 'Message ID' },
    ],
    path: ['messages', 'revoke'],
    risk: 'destructive',
    run: messagesDelete,
  },
  {
    description: 'Stream Desktop API WebSocket events',
    flags: [
      { name: 'chat', type: 'string', multiple: true, description: 'Chat ID to subscribe to; defaults to all chats' },
      { name: 'exclude-type', type: 'string', multiple: true, enum: ['chat.upserted', 'chat.deleted', 'message.upserted', 'message.deleted', 'message.stream'], description: 'Drop events of these types' },
      { name: 'include-type', type: 'string', multiple: true, enum: ['chat.upserted', 'chat.deleted', 'message.upserted', 'message.deleted', 'message.stream'], description: 'Only forward events of these types' },
      { name: 'webhook', type: 'string', description: 'Forward each event to this URL as POST' },
      { name: 'webhook-allow-private', type: 'boolean', default: false, description: 'Accepted for compatibility; Beeper watch allows private webhook URLs' },
      { name: 'webhook-queue', type: 'integer', default: 64, description: 'Maximum pending webhook deliveries' },
      { name: 'webhook-secret', type: 'string', description: 'HMAC-SHA256 secret for X-Beeper-Signature and X-Wacli-Signature' },
    ],
    path: ['watch'],
    risk: 'read',
    run: watch,
  },
  {
    args: [{ name: 'url', description: 'Media URL to download. Use --id with --chat to download from a message.' }],
    aliases: [['media', 'dl'], ['download'], ['dl']],
    description: 'Download message media',
    flags: [
      { name: 'out', aliases: ['output'], type: 'string', default: '.', description: 'Output directory or file; - streams to stdout' },
      { name: 'chat', type: 'string', description: 'Chat selector for --id message lookup' },
      { name: 'id', type: 'string', description: 'Message ID containing media' },
      { name: 'index', type: 'integer', default: 1, description: 'Attachment index to download, 1-based' },
      { name: 'poster', type: 'boolean', default: false, description: 'Download attachment poster image when available' },
    ],
    path: ['media', 'download'],
    risk: 'write',
    run: mediaDownload,
  },
  {
    args: [{ name: 'id', description: 'Message ID containing media. Used when --id is omitted.' }],
    description: 'Download media for a message',
    flags: [
      { name: 'out', aliases: ['output'], type: 'string', default: '.', description: 'Output directory or file; - streams to stdout' },
      chatFlag,
      { name: 'id', type: 'string', description: 'Message ID containing media' },
      { name: 'index', type: 'integer', default: 1, description: 'Attachment index to download, 1-based' },
      { name: 'poster', type: 'boolean', default: false, description: 'Download attachment poster image when available' },
    ],
    path: ['media', 'message'],
    risk: 'write',
    run: mediaDownload,
  },
  {
    description: 'Export accounts, chats, messages, transcripts, and attachments',
    flags: [
      accountFilterFlag,
      { name: 'chat', type: 'string', multiple: true, description: 'Limit to chat selector' },
      { name: 'force', type: 'boolean', default: false, description: 'Re-export completed chats' },
      { name: 'limit-chats', type: 'integer', description: 'Maximum chats to export' },
      { name: 'limit-messages', type: 'integer', description: 'Maximum messages per chat' },
      { name: 'max-participants', type: 'integer', default: 500, description: 'Maximum participants in chat.json' },
      { name: 'no-attachments', type: 'boolean', default: false, description: 'Skip downloading attachments' },
      { name: 'out', type: 'string', default: 'beeper-export', description: 'Export directory' },
      pickChatFlag,
    ],
    path: ['export'],
    risk: 'write',
    run: exportCommand,
  },
  {
    args: [{ name: 'query', description: 'Search query. Optional when a filter such as --sender or --has-media is provided.' }],
    aliases: [['messages', 'find'], ['search'], ['find']],
    description: 'Search messages across chats',
    examples: [
      'beeper messages search "quarterly report"',
      'beeper messages search --chat "Work" --sender me --limit 20',
    ],
    flags: [
      accountFilterFlag,
      { name: 'chat', type: 'string', multiple: true, description: 'Limit to a chat selector' },
      { name: 'chat-type', type: 'string', enum: ['group', 'single'], description: 'Only group chats or direct messages' },
      { name: 'after', type: 'string', description: 'Only messages at or after this ISO timestamp' },
      { name: 'before', type: 'string', description: 'Only messages at or before this ISO timestamp' },
      { name: 'exclude-low-priority', type: 'boolean', description: 'Exclude low-priority chats' },
      { name: 'ids', type: 'boolean', default: false, description: 'Print only message IDs' },
      { name: 'include-muted', type: 'boolean', default: true, description: 'Include muted chats' },
      { name: 'limit', aliases: ['max'], type: 'integer', default: 50, description: 'Maximum results' },
      { name: 'media', type: 'string', multiple: true, enum: ['any', 'video', 'image', 'link', 'file'], description: 'Filter by media type' },
      { name: 'sender', aliases: ['from'], type: 'string', description: 'me, others, or a user ID' },
      { name: 'has-media', type: 'boolean', default: false, description: 'Only messages with media' },
      { name: 'fail-empty', aliases: ['non-empty', 'require-results'], type: 'boolean', default: false, description: 'Exit with code 3 if no results' },
    ],
    mcp: true,
    output: 'messages',
    path: ['messages', 'search'],
    risk: 'read',
    run: messagesSearch,
  },
  {
    args: [
      { name: 'method', required: true, description: 'HTTP method: GET, POST, PUT, PATCH, or DELETE' },
      { name: 'path', required: true, description: 'Desktop API path, for example /v1/info' },
    ],
    description: 'Call a raw Desktop API path with any supported HTTP method',
    flags: [
      { name: 'body', type: 'string', description: 'JSON request body' },
      { name: 'no-auth', type: 'boolean', default: false, description: 'Call a public API path without a bearer token' },
    ],
    path: ['api', 'request'],
    risk: 'write',
    run: apiCommand,
  },
  {
    args: [
      { name: 'to', description: 'Chat selector. Used when --to is omitted.' },
      { name: 'message', description: 'Message text. Used when --message and --message-file are omitted.', variadic: true },
    ],
    description: 'Send a text message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'message', type: 'string', description: 'Message text to send' },
      { name: 'message-escapes', type: 'boolean', default: false, description: 'Interpret backslash escapes in --message' },
      { name: 'message-file', type: 'string', description: "Read message text from a file path; '-' reads stdin" },
      { name: 'mention', type: 'string', multiple: true, description: 'User ID to mention' },
      { name: 'no-preview', type: 'boolean', default: false, description: 'Disable automatic link preview' },
      { name: 'ephemeral', type: 'boolean', default: false, description: 'Send with this chat\'s disappearing-message timer' },
      { name: 'ephemeral-duration', type: 'string', description: 'Set the chat disappearing-message timer before sending, for example 24h, 7d, 90d, or 168h' },
    ],
    path: ['send'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    aliases: [['message'], ['msg']],
    args: [
      { name: 'to', description: 'Chat selector. Used when --to is omitted.' },
      { name: 'message', description: 'Message text. Used when --message and --message-file are omitted.', variadic: true },
    ],
    description: 'Send a text message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'message', type: 'string', description: 'Message text to send' },
      { name: 'message-escapes', type: 'boolean', default: false, description: 'Interpret backslash escapes in --message' },
      { name: 'message-file', type: 'string', description: "Read message text from a file path; '-' reads stdin" },
      { name: 'mention', type: 'string', multiple: true, description: 'User ID to mention' },
      { name: 'no-preview', type: 'boolean', default: false, description: 'Disable automatic link preview' },
      { name: 'ephemeral', type: 'boolean', default: false, description: 'Send with this chat\'s disappearing-message timer' },
      { name: 'ephemeral-duration', type: 'string', description: 'Set the chat disappearing-message timer before sending, for example 24h, 7d, 90d, or 168h' },
    ],
    mcp: true,
    path: ['send', 'text'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    args: [{ name: 'localPath', description: 'Local file path to upload. Used when --file is omitted.' }],
    description: 'Send a file message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', description: 'Local file path to upload' },
      { name: 'caption', type: 'string', description: 'Optional caption for file messages' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
      { name: 'ptt', type: 'boolean', default: false, description: 'Send audio as a voice note' },
    ],
    path: ['send', 'file'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    aliases: [['up'], ['put']],
    args: [{ name: 'localPath', required: true, description: 'Local file path to upload' }],
    description: 'Send a file message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'caption', type: 'string', description: 'Optional caption for file messages' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
      { name: 'ptt', type: 'boolean', default: false, description: 'Send audio as a voice note' },
    ],
    path: ['upload'],
    risk: 'write',
    run: uploadFile,
  },
  {
    args: [{ name: 'localPath', description: 'Local sticker file path to upload. Used when --file is omitted.' }],
    description: 'Send a sticker',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', description: 'Local sticker file path to upload' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
    ],
    path: ['send', 'sticker'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    args: [{ name: 'localPath', description: 'Local voice note file path to upload. Used when --file is omitted.' }],
    description: 'Send a voice note',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', description: 'Local voice note file path to upload' },
      { name: 'duration', type: 'integer', description: 'Duration in seconds' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
    ],
    path: ['send', 'voice'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    aliases: [['send', 'reaction']],
    args: [{ name: 'id', description: 'Message ID to react to. Used when --id is omitted.' }],
    description: 'Send or remove a reaction',
    flags: [
      ...sendChatFlags,
      { name: 'id', type: 'string', description: 'Message ID to react to' },
      { name: 'reaction', type: 'string', default: '+1', description: 'Reaction key; empty string removes the reaction' },
      { name: 'remove', type: 'boolean', default: false, description: 'Remove the reaction' },
      { name: 'post-send-wait', type: 'string', description: 'Compatibility alias for waiting after send, for example 2s or 500ms; 0 disables waiting' },
      { name: 'transaction', type: 'string', description: 'Optional transaction ID for deduplication' },
    ],
    mcp: true,
    path: ['send', 'react'],
    risk: 'write',
    run: sendReact,
  },
  {
    description: 'Send a typing indicator',
    flags: presenceFlags,
    path: ['send', 'presence'],
    risk: 'write',
    run: sendPresence,
  },
  {
    description: 'Send presence indicators',
    flags: presenceFlags,
    path: ['presence'],
    risk: 'write',
    run: sendPresence,
  },
  {
    description: "Send a 'composing' (typing) indicator to a chat",
    flags: [
      ...sendChatFlags,
      { name: 'duration', type: 'integer', description: 'Seconds to keep typing before sending paused' },
    ],
    path: ['presence', 'typing'],
    risk: 'write',
    run: sendPresence,
  },
  {
    description: "Send a 'paused' indicator (stop typing) to a chat",
    flags: sendChatFlags,
    path: ['presence', 'paused'],
    risk: 'write',
    run: sendPresence,
  },
  {
    args: [{ name: 'name', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['target', 'runtime', 'start']],
    description: 'Start a local target runtime',
    path: ['targets', 'runtime', 'start'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['target', 'runtime', 'stop']],
    description: 'Stop a local server runtime',
    path: ['targets', 'runtime', 'stop'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['target', 'runtime', 'restart']],
    description: 'Restart a local server runtime',
    path: ['targets', 'runtime', 'restart'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['target', 'logs']],
    description: 'Print logs for a local Beeper Desktop or Server install',
    flags: [
      { name: 'lines', type: 'integer', default: 200, description: 'Lines to print from each log file' },
      { name: 'files', type: 'integer', default: 5, description: 'Desktop log files to print, newest first' },
      { name: 'all', type: 'boolean', default: false, description: 'Print all matching log files instead of only recent files' },
    ],
    path: ['targets', 'logs'],
    risk: 'read',
    run: targetsLogs,
  },
]

export function commandHelp(command: CommandSpec, globalFlags?: GlobalFlags): string {
  if (globalFlags && !commandVisible(command, globalFlags) && !childCommandRows(command.path, globalFlags).length) return help(globalFlags)
  const path = command.path.join(' ')
  const usagePath = [path, formatUsageAliases(command)].filter(Boolean).join(' ')
  const children = childCommandRows(command.path, globalFlags)
  const argsUsage = command.args?.length ? ` ${command.args.map(formatArgUsage).join(' ')}` : children.length ? ' <command>' : ''
  const lines = [`Usage: beeper ${usagePath}${argsUsage} [flags]`, `Build: ${buildInfo()}`, '', command.description]
  const args = command.args ?? []
  if (args.length) {
    lines.push('', 'Arguments:')
    lines.push(...formatHelpRows(args.map(arg => [formatArgLabel(arg), arg.description ?? ''])))
  }
  lines.push('', 'Flags:')
  lines.push(...formatHelpRows(displayFlags(globalFlagSpecs).map(flag => [formatFlag(flag), formatFlagDescription(flag)])))
  const flags = command.flags ?? []
  if (flags.length) {
    lines.push('')
    lines.push(...formatHelpRows(flags.map(flag => [formatFlag(flag), formatFlagDescription(flag)])))
  }
  if (command.examples?.length) {
    lines.push('', 'Examples:', ...command.examples.map(example => `  ${example}`))
  }
  if (children.length) {
    lines.push('', 'Commands:')
    for (const child of children) {
      lines.push(`  ${formatCommandUsage(child.command, { path: child.displayPath, prefix: command.path })}`, `    ${child.command.description}`, '')
    }
    lines.pop()
  }
  return `${lines.join('\n')}\n`
}

export function help(globalFlags?: GlobalFlags): string {
  const visible = commands.filter(command => globalFlags ? commandVisible(command, globalFlags) : !command.hidden)
  const configRoot = beeperConfigRootInfo()
  const lines = [
    'Usage: beeper <command> [flags]',
    `Build: ${buildInfo()}`,
    '',
    'Beeper CLI for Beeper Desktop and Beeper Server. Built for terminals, scripts, CI, and agents.',
    '',
    'Config:',
    '',
    `    file: ${configPath()}`,
    `    root: ${configRoot.path} (source: ${configRoot.source})`,
    '',
    'Flags:',
  ]
  lines.push(...formatHelpRows(displayFlags(globalFlagSpecs).map(flag => [formatFlag(flag), formatFlagDescription(flag)])))
  lines.push(
    '',
    'Commands:',
  )
  for (const row of rootCommandRows(visible)) {
    lines.push(`  ${row.usage}`, `    ${row.description}`, '')
  }
  lines.push('Run "beeper <command> --help" for more information on a command.')
  return `${lines.join('\n')}\n`
}

function rootCommandRows(visible: CommandSpec[]): Array<{ description: string; sort: string; usage: string }> {
  const rows = new Map<string, { description: string; sort: string; usage: string }>()
  const topLevel = new Set(visible.map(command => command.path[0]).filter((part): part is string => Boolean(part)))
  for (const command of visible) {
    if (command.path.length === 1) {
      const hasChildren = visible.some(candidate =>
        candidate.path.length > 1 && candidate.path[0] === command.path[0]
        || (candidate.aliases ?? []).some(alias => alias.length > 1 && alias[0] === command.path[0]))
      rows.set(command.path[0]!, {
        description: command.description,
        sort: command.path[0]!,
        usage: hasChildren && !command.args?.length ? `${command.path[0]} <command> [flags]` : formatCommandUsage(command),
      })
    }
  }
  for (const command of visible) {
    if (command.path.length <= 1) continue
    const aliases = (command.aliases ?? [])
      .filter(alias => alias.length === 1)
      .map(alias => alias[0]!)
    if (!aliases.length) continue
    const name = aliases[0]!
    if (rows.has(name)) continue
    const alternateAliases = aliases.slice(1)
    rows.set(name, {
      description: `${command.description} (alias for '${command.path.join(' ')}')`,
      sort: name,
      usage: `${name}${alternateAliases.length ? ` (${alternateAliases.join(',')})` : ''}${command.args?.length ? ` ${command.args.map(formatArgUsage).join(' ')}` : ''} [flags]`,
    })
  }
  const me = visible.find(command => command.path.join(' ') === 'me')
  const whoamiAliases = me?.aliases?.filter(alias => alias.length === 1 && alias[0]?.startsWith('who')) ?? []
  if (me && whoamiAliases.length && !rows.has(whoamiAliases[0]![0]!)) {
    const name = whoamiAliases[0]![0]!
    rows.set(name, {
      description: `${me.description} (alias for '${me.path.join(' ')}')`,
      sort: name,
      usage: `${name}${whoamiAliases.length > 1 ? ` (${whoamiAliases.slice(1).map(alias => alias[0]).join(',')})` : ''} [flags]`,
    })
  }
  for (const name of topLevel) {
    if (rows.has(name)) continue
    const aliases = namespaceAliases(name, visible)
    rows.set(name, {
      description: rootNamespaceDescription(name),
      sort: name,
      usage: `${name}${aliases.length ? ` (${aliases.join(',')})` : ''} <command> [flags]`,
    })
  }
  return [...rows.values()].sort((a, b) => rootCommandPriority(a.sort) - rootCommandPriority(b.sort) || a.sort.localeCompare(b.sort))
}

function rootCommandPriority(name: string): number {
  const order = [
    'message',
    'ls',
    'search',
    'open',
    'download',
    'upload',
    'login',
    'logout',
    'status',
    'me',
    'whoami',
    'setup',
    'send',
    'chats',
    'groups',
    'messages',
    'accounts',
    'contacts',
    'presence',
    'media',
    'targets',
    'use',
    'remove',
    'resolve',
    'export',
    'watch',
    'doctor',
    'auth',
    'install',
    'api',
    'config',
    'docs',
    'schema',
    'mcp',
    'agent',
    'exit-codes',
    'completion',
    'help',
    'version',
  ]
  const index = order.indexOf(name)
  return index === -1 ? order.length : index
}

function namespaceAliases(name: string, visible: CommandSpec[]): string[] {
  const allowed = singularNamespaceAliases()[name] ?? []
  const aliases = new Set<string>()
  for (const command of visible) {
    if (command.path[0] !== name) continue
    for (const alias of command.aliases ?? []) {
      if (alias.length < 2) continue
      const aliasRoot = alias[0]
      if (aliasRoot && allowed.includes(aliasRoot)) aliases.add(aliasRoot)
    }
  }
  return [...aliases].sort((a, b) => rootCommandPriority(a) - rootCommandPriority(b) || a.localeCompare(b))
}

function singularNamespaceAliases(): Record<string, string[]> {
  return {
    accounts: ['account'],
    chats: ['chat'],
    contacts: ['contact'],
    groups: ['group'],
    targets: ['target'],
  }
}

function rootNamespaceDescription(name: string): string {
  const descriptions: Record<string, string> = {
    account: 'Manage connected chat accounts',
    accounts: 'Manage connected chat accounts',
    api: 'Call raw Beeper Desktop API endpoints',
    auth: 'Authenticate and manage stored credentials',
    chat: 'List and manage chats',
    chats: 'List and manage chats',
    config: 'Manage configuration',
    contact: 'List and search contacts',
    contacts: 'List and search contacts',
    group: 'List and manage group chats',
    groups: 'List and manage group chats',
    install: 'Install Beeper Desktop or Beeper Server',
    media: 'Download message media',
    messages: 'List, search, edit, and delete messages',
    presence: 'Send presence indicators',
    remove: 'Remove configured resources',
    resolve: 'Resolve Beeper selectors',
    search: 'Search Beeper',
    send: 'Send messages, files, reactions, and presence',
    target: 'Manage Beeper Desktop and Server targets',
    targets: 'Manage Beeper Desktop and Server targets',
    use: 'Select default resources',
  }
  return descriptions[name] ?? `${name} commands`
}

function formatFlag(flag: FlagSpec): string {
  const long = `--${flag.name}${flagValueUsage(flag)}`
  const prefix = flag.short ? `-${flag.short}, ${long}` : `    ${long}`
  const aliases = flag.aliases?.length ? ` (${flag.aliases.map(alias => `--${alias}`).join(', ')})` : ''
  return `${prefix}${aliases}`
}

function formatFlagDescription(flag: FlagSpec): string {
  const env = flag.env?.length ? ` (${flag.env.map(name => `$${name}`).join(',')})` : ''
  return `${flag.description ?? ''}${env}`
}

function formatHelpRows(rows: Array<[string, string]>): string[] {
  const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0)
  return rows.flatMap(([label, description]) => {
    const text = description.trim()
    if (!text) return [`  ${label}`]
    return wrapHelpText(text, 120 - width - 4).map((line, index) => {
      const prefix = index === 0 ? label.padEnd(width + 2) : ''.padEnd(width + 2)
      return `  ${prefix}${line}`
    })
  })
}

function wrapHelpText(text: string, width: number): string[] {
  const limit = Math.max(24, width)
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) {
      line = word
      continue
    }
    if (line.length + 1 + word.length > limit) {
      lines.push(line)
      line = word
      continue
    }
    line = `${line} ${word}`
  }
  if (line) lines.push(line)
  return lines
}

function displayFlags(flags: FlagSpec[]): FlagSpec[] {
  const priority = new Map([
    ['help', 0],
    ['color', 1],
    ['home', 2],
    ['account', 3],
    ['access-token', 4],
    ['enable-commands', 5],
    ['enable-commands-exact', 6],
    ['disable-commands', 7],
    ['json', 8],
    ['plain', 9],
    ['wrap-untrusted', 10],
    ['results-only', 11],
    ['select', 12],
    ['dry-run', 13],
    ['force', 14],
    ['no-input', 15],
    ['verbose', 16],
    ['version', 17],
    ['events', 18],
    ['full', 19],
    ['lock-wait', 20],
    ['read-only', 21],
    ['safety-profile', 22],
    ['target', 23],
    ['timeout', 24],
  ])
  return [...flags].sort((a, b) => (priority.get(a.name) ?? 100) - (priority.get(b.name) ?? 100) || a.name.localeCompare(b.name))
}

function flagValueUsage(flag: FlagSpec): string {
  if (flag.type === 'boolean') return ''
  if (flag.default !== undefined) return `=${JSON.stringify(flag.default)}`
  return `=${flag.placeholder ?? (flag.type === 'integer' ? 'INTEGER' : 'STRING')}`
}

function formatUsageAliases(command: CommandSpec, prefix?: string[], canonical = displayPath(command.path, prefix)): string {
  const aliases = (command.aliases ?? [])
    .filter(alias => !prefix?.length || (alias.length > prefix.length && alias.slice(0, prefix.length).every((part, index) => part === prefix[index])))
    .map(alias => displayPath(alias, prefix))
    .filter(alias => alias !== canonical)
  return aliases.length ? `(${[...new Set(aliases)].join(',')})` : ''
}

function formatCommandUsage(command: CommandSpec, options: { path?: string[]; prefix?: string[] } = {}): string {
  const path = displayPath(options.path ?? command.path, options.prefix)
  const usagePath = [path, formatUsageAliases(command, options.prefix, path)].filter(Boolean).join(' ')
  const args = command.args?.length ? ` ${command.args.map(formatArgUsage).join(' ')}` : ''
  return `${usagePath}${args} [flags]`
}

function displayPath(path: string[], prefix?: string[]): string {
  if (prefix?.length && path.length > prefix.length && path.slice(0, prefix.length).every((part, index) => part === prefix[index])) {
    return path.slice(prefix.length).join(' ')
  }
  return path.join(' ')
}

function formatArgUsage(arg: { name: string; required?: boolean; variadic?: boolean }): string {
  if (arg.variadic) return arg.required ? `<${arg.name}> ...` : `[<${arg.name}> ...]`
  return arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
}

function formatArgLabel(arg: { name: string; required?: boolean; variadic?: boolean }): string {
  if (arg.variadic) return arg.required ? `<${arg.name} ...>` : `[<${arg.name}> ...]`
  return arg.required ? `<${arg.name}>` : `[<${arg.name}>]`
}

function childCommandRows(path: string[], globalFlags?: GlobalFlags): Array<{ command: CommandSpec; displayPath: string[] }> {
  const visible = commands.filter(command => globalFlags ? commandVisible(command, globalFlags) : !command.hidden)
  return visible
    .map(command => {
      const displayPath = commandPathVariants(command).find(variant => variant.length > path.length && variant.slice(0, path.length).every((part, index) => part === path[index]))
      return displayPath ? { command, displayPath } : undefined
    })
    .filter((row): row is { command: CommandSpec; displayPath: string[] } => Boolean(row))
    .sort((a, b) => subcommandPriority(path, a.displayPath) - subcommandPriority(path, b.displayPath) || a.displayPath.join(' ').localeCompare(b.displayPath.join(' ')))
}

function subcommandPriority(parent: string[], displayPath: string[]): number {
  const relative = parent.length ? displayPath.slice(parent.length).join(' ') : displayPath.join(' ')
  const orders: Record<string, string[]> = {
    account: ['list', 'show', 'add', 'use', 'remove'],
    accounts: ['list', 'show', 'add', 'use', 'remove'],
    auth: ['add', 'list', 'email start', 'email response', 'logout', 'status'],
    chat: ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread', 'rename', 'description', 'avatar', 'priority', 'draft', 'remind', 'disappear', 'focus', 'notify-anyway'],
    chats: ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread', 'rename', 'description', 'avatar', 'priority', 'draft', 'remind', 'disappear', 'focus', 'notify-anyway'],
    config: ['get', 'keys', 'set', 'unset', 'list', 'path'],
    contact: ['list', 'show'],
    contacts: ['list', 'show'],
    group: ['list', 'show', 'create', 'rename', 'description'],
    groups: ['list', 'show', 'create', 'rename', 'description'],
    media: ['download', 'message'],
    messages: ['list', 'search', 'context', 'show', 'export', 'forward', 'edit', 'delete', 'revoke'],
    presence: ['typing', 'paused'],
    search: ['all'],
    send: ['text', 'file', 'voice', 'sticker', 'react', 'presence'],
    target: ['list', 'use', 'add', 'remove', 'logs', 'runtime start', 'runtime stop', 'runtime restart', 'tunnel'],
    'target runtime': ['start', 'stop', 'restart'],
    targets: ['list', 'use', 'add', 'remove', 'logs', 'runtime start', 'runtime stop', 'runtime restart', 'tunnel'],
    'targets runtime': ['start', 'stop', 'restart'],
  }
  const order = orders[parent.join(' ')] ?? []
  const index = order.indexOf(relative)
  return index === -1 ? order.length : index
}

async function version(): Promise<Record<string, unknown>> {
  const pkg = await packageInfo()
  return {
    name: pkg.name,
    version: pkg.version,
    commit: process.env.BEEPER_BUILD_COMMIT ?? '',
    date: process.env.BEEPER_BUILD_DATE ?? '',
  }
}

async function status(ctx: CommandContext): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  return {
    auth: {
      authenticated: Boolean(process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken),
      clientID: target.auth?.clientID,
      expiresAt: target.auth?.expiresAt,
      scope: target.auth?.scope,
      source: process.env.BEEPER_ACCESS_TOKEN ? 'env' : target.auth?.source ?? (target.auth?.accessToken ? 'target' : 'none'),
    },
    config: configStatus(config),
    live: await targetLiveStatus(target),
    readiness: await evaluateReadiness({ baseURL: target.baseURL, target: target.id }),
    target: publicTarget(target),
  }
}

async function authList(): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const targets = await listTargets()
  const rows = targets.length ? targets : [await resolveTarget({ target: builtInDesktopTargetID })]
  return { accounts: rows.map(target => ({
    authenticated: Boolean(target.auth?.accessToken),
    baseURL: target.baseURL,
    clientID: target.auth?.clientID,
    default: config.defaultTarget ? config.defaultTarget === target.id : target.id === builtInDesktopTargetID,
    expiresAt: target.auth?.expiresAt,
    scope: target.auth?.scope,
    source: target.auth?.source ?? 'none',
    target: target.id,
    tokenType: target.auth?.tokenType,
    type: target.type,
  })) }
}

async function authStatus(ctx: CommandContext): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  return {
    auth: {
      authenticated: Boolean(process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken),
      clientID: target.auth?.clientID,
      expiresAt: target.auth?.expiresAt,
      scope: target.auth?.scope,
      source: process.env.BEEPER_ACCESS_TOKEN ? 'env' : target.auth?.source ?? (target.auth?.accessToken ? 'target' : 'none'),
      tokenType: process.env.BEEPER_ACCESS_TOKEN ? 'Bearer' : target.auth?.tokenType,
    },
    config: configStatus(config),
    target: {
      baseURL: target.baseURL,
      default: config.defaultTarget ? config.defaultTarget === target.id : target.id === builtInDesktopTargetID,
      id: target.id,
      type: target.type,
    },
  }
}

function configStatus(config: Config): Record<string, unknown> {
  return {
    defaultAccount: config.defaultAccount ?? null,
    defaultTarget: config.defaultTarget ?? builtInDesktopTargetID,
    exists: existsSync(configPath()),
    path: configPath(),
  }
}

async function me(ctx: CommandContext): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const target = await resolveTarget({ target: ctx.globalFlags.target })
  const accountSelectors = stringListFlag(ctx.flags, 'account')
  const request = {
    accounts: accountSelectors,
    defaultAccount: config.defaultAccount,
    target: target.id,
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'me', request }
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, accountSelectors, { allowMultiplePerInput: true, applyDefault: false })
  const accounts = apiItems(await client.accounts.list())
    .filter(row => !accountIDs?.length || accountIDs.includes(accountIDForRow(row)))
    .map(row => ({ ...row, default: accountIDForRow(row) === config.defaultAccount || undefined }))
  return {
    accounts,
    auth: {
      authenticated: Boolean(process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken),
      source: process.env.BEEPER_ACCESS_TOKEN ? 'env' : target.auth?.source ?? (target.auth?.accessToken ? 'target' : 'none'),
    },
    defaultAccount: config.defaultAccount,
    target: publicTarget(target),
  }
}

async function doctor(ctx: CommandContext): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const targets = await listTargets()
  const target = await resolveTarget({ target: ctx.globalFlags.target }).catch(() => undefined)
  const live = target ? await targetLiveStatus(target) : undefined
  const readiness = target && live && (live as Record<string, unknown>).reachable
    ? await evaluateReadiness({ baseURL: target.baseURL, target: target.id }).catch(error => ({ state: 'unknown', message: error instanceof Error ? error.message : String(error) }))
    : undefined
  return {
    config_file: process.env.BEEPER_CLI_CONFIG_DIR ? `${process.env.BEEPER_CLI_CONFIG_DIR}/config.json` : undefined,
    default_target: config.defaultTarget ?? builtInDesktopTargetID,
    default_account: config.defaultAccount,
    targets: targets.length || 1,
    selected_target: target?.id,
    target_type: target?.type,
    reachable: isRecord(live) ? live.reachable : false,
    authenticated: Boolean(process.env.BEEPER_ACCESS_TOKEN || target?.auth?.accessToken),
    readiness: isRecord(readiness) ? readiness.state : undefined,
    next: isRecord(readiness) ? readiness.message : undefined,
  }
}

async function exitCodes(): Promise<Record<string, unknown>> {
  return {
    exit_codes: {
      ok: 0,
      error: ExitCodes.Generic,
      usage: ExitCodes.Usage,
      empty_results: ExitCodes.EmptyResults,
      auth_required: ExitCodes.AuthRequired,
      not_ready: ExitCodes.NotReady,
      not_found: ExitCodes.NotFound,
      ambiguous: ExitCodes.Ambiguous,
      cancelled: 130,
      command_not_found: ExitCodes.CommandNotFound,
    },
  }
}

async function agent(): Promise<Record<string, unknown>> {
  return {
    helpers: [
      { command: 'agent exit-codes', description: 'Print stable exit codes for automation' },
    ],
  }
}

async function docs(ctx: CommandContext): Promise<Record<string, unknown> | string> {
  const url = 'https://github.com/beeper/desktop-api-cli/tree/main/packages/cli'
  if (ctx.flags.url || !ctx.globalFlags.json) return url
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  return {
    url,
    commands: join(root, 'docs', 'commands', 'README.md'),
    package: join(root, 'README.md'),
    relative_commands: 'docs/commands/README.md',
  }
}

async function helpCommand(ctx: CommandContext): Promise<void> {
  const target = commandForHelp(ctx.args, ctx.globalFlags)
  process.stdout.write(target ? commandHelp(target, ctx.globalFlags) : help(ctx.globalFlags))
}

async function schema(ctx: CommandContext): Promise<Record<string, unknown>> {
  const pkg = await packageInfo()
  return buildSchema(commands, String(pkg.version ?? '0'), ctx.args, ctx.globalFlags, {
    includeHidden: Boolean(ctx.flags['include-hidden']),
  })
}

function commandForHelp(args: string[], globalFlags: GlobalFlags): CommandSpec | undefined {
  const parts = args.flatMap(part => part.trim().split(/\s+/)).filter(Boolean)
  if (!parts.length) return undefined
  const exact = commands
    .filter(command => commandVisible(command, globalFlags))
    .find(command => commandPathVariants(command).some(path => path.length === parts.length && path.every((part, index) => part === parts[index])))
  if (exact) return exact
  const hasChildren = commands
    .filter(command => commandVisible(command, globalFlags))
    .some(command => commandPathVariants(command).some(path => parts.length < path.length && parts.every((part, index) => path[index] === part)))
  if (!hasChildren) return undefined
  return {
    description: parts.length === 1 ? rootNamespaceDescription(parts[0]!) : `${parts.join(' ')} commands`,
    path: parts,
    risk: 'read',
    run: async () => undefined,
  }
}

async function mcp(ctx: CommandContext): Promise<void> {
  const pkg = await packageInfo()
  await serveMcp(commands, ctx.globalFlags, {
    allowTools: stringListFlag(ctx.flags, 'allow-tool'),
    allowWrite: Boolean(ctx.flags['allow-write']),
    httpHost: stringFlag(ctx.flags, 'http-host') ?? '127.0.0.1',
    httpPath: stringFlag(ctx.flags, 'http-path') ?? '/mcp',
    httpPort: numberFlag(ctx.flags, 'http-port', 7331),
    listTools: Boolean(ctx.flags['list-tools']),
    maxOutputBytes: numberFlag(ctx.flags, 'max-output-bytes', 102400),
    timeoutSeconds: numberFlag(ctx.flags, 'timeout-seconds', 60),
    transport: stringFlag(ctx.flags, 'transport') === 'http' ? 'http' : 'stdio',
  }, String(pkg.version ?? '0'))
}

async function completion(ctx: CommandContext): Promise<void> {
  const shell = ctx.args[0]
  if (!shell) throw usage('completion requires shell')
  process.stdout.write(completionScript(shell))
}

async function completionShell(ctx: CommandContext): Promise<void> {
  process.stdout.write(completionScript(ctx.commandPath[1] ?? ''))
}

async function configGet(ctx: CommandContext): Promise<Record<string, unknown>> {
  const key = parseConfigKey(ctx.args[0])
  const config = await readConfig()
  return { key, value: config[key] ?? null }
}

async function configKeysCommand(): Promise<Record<string, unknown>> {
  return { keys: [...configKeys] }
}

async function configList(): Promise<Record<string, unknown>> {
  const config = await readConfig()
  return {
    path: configPath(),
    defaultTarget: config.defaultTarget ?? null,
    defaultAccount: config.defaultAccount ?? null,
  }
}

async function configPathCommand(): Promise<Record<string, unknown>> {
  return { path: configPath() }
}

async function configSet(ctx: CommandContext): Promise<Record<string, unknown>> {
  const key = parseConfigKey(ctx.args[0])
  const value = ctx.args[1]
  if (!value) throw usage('config set requires value')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'config.set', request: { key, value } }
  const config = await updateConfig(current => ({ ...current, [key]: value }))
  return { key, saved: true, value: config[key] ?? null }
}

async function configUnset(ctx: CommandContext): Promise<Record<string, unknown>> {
  const key = parseConfigKey(ctx.args[0])
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'config.unset', request: { key } }
  const config = await updateConfig(current => unsetConfigKey(current, key))
  return { key, removed: true, value: config[key] ?? null }
}

function parseConfigKey(value: string | undefined): ConfigKey {
  if (!value) throw usage(`config key is required. Available keys: ${configKeys.join(', ')}`)
  const normalized = value.replaceAll('-', '').replaceAll('_', '').toLowerCase()
  const key = configKeys.find(item => item.toLowerCase() === normalized)
  if (!key) throw usage(`unknown config key "${value}". Available keys: ${configKeys.join(', ')}`)
  return key
}

function unsetConfigKey(config: Config, key: ConfigKey): Config {
  const next = { ...config }
  delete next[key]
  return next
}

async function completeCommand(ctx: CommandContext): Promise<void> {
  const cword = numberFlag(ctx.flags, 'cword', -1)
  const words = ctx.args.length ? ctx.args : ['beeper']
  for (const item of completeWords(words, cword, ctx.globalFlags)) process.stdout.write(`${item}\n`)
}

async function targetsList(): Promise<Record<string, unknown>> {
  const config = await readConfig()
  const targets = await listTargets()
  const rows = targets.length ? targets : [await resolveTarget({ target: builtInDesktopTargetID })]
  return { targets: await Promise.all(rows.map(async target => ({
    baseURL: target.baseURL,
    default: config.defaultTarget ? config.defaultTarget === target.id : target.id === builtInDesktopTargetID,
    id: target.id,
    localProfile: Boolean(target.dataDir),
    name: target.name ?? target.id,
    type: target.type,
    ...await targetLiveStatus(target),
  }))) }
}

async function targetsAdd(ctx: CommandContext): Promise<Record<string, unknown>> {
  const [name, url] = ctx.args
  if (!name || !url) throw usage('targets add requires name and url')
  if (name === builtInDesktopTargetID) throw usage('Target name "desktop" is reserved for the built-in Beeper Desktop target')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'targets.add', request: { default: ctx.flags.default, name, url } }
  if (await readTarget(name)) throw usage(`Target "${name}" already exists`)
  const target: Target = { baseURL: url, id: name, name, type: 'remote' }
  await writeTarget(target)
  if (ctx.flags.default) await updateConfig(config => ({ ...config, defaultTarget: target.id }))
  return { target: publicTarget(target) }
}

async function targetsTunnel(ctx: CommandContext): Promise<undefined | Record<string, unknown>> {
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  const url = new URL(target.baseURL)
  url.search = ''
  url.hash = ''
  const localURL = url.toString().replace(/\/$/, '')
  const request = {
    cloudflaredPath: stringFlag(ctx.flags, 'cloudflared-path') ?? process.env.BEEPER_CLOUDFLARED_PATH,
    install: Boolean(ctx.flags.install),
    localURL,
    retries: numberFlag(ctx.flags, 'retries', 5),
    target: target.id,
    timeoutMs: parseDurationMs(stringFlag(ctx.flags, 'timeout')) ?? 40_000,
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'targets.tunnel', request }

  const started = await startCloudflareTunnel({
    cloudflaredPath: stringFlag(ctx.flags, 'cloudflared-path'),
    debug: ctx.globalFlags.debug,
    install: Boolean(ctx.flags.install),
    retries: numberFlag(ctx.flags, 'retries', 5),
    timeoutMs: parseDurationMs(stringFlag(ctx.flags, 'timeout')) ?? 40_000,
    url: localURL,
  })
  const result = { cloudflaredPath: started.cloudflaredPath, localURL, target: target.id, url: started.url }
  if (ctx.globalFlags.events) writeEvent('tunnel.connected', result)
  if (ctx.flags['url-only']) process.stdout.write(`${started.url}\n`)
  else if (ctx.globalFlags.json || ctx.globalFlags.plain) writeResult(result, ctx.globalFlags)
  else {
    process.stdout.write(`Cloudflare Tunnel connected for ${target.id}\n${started.url} -> ${localURL}\n`)
    process.stderr.write('Press Ctrl-C to stop the tunnel.\n')
  }

  const exit = await waitForTunnelExit(started)
  if (exit.reason === 'process' && exit.code !== 0) {
    throw new Error(`cloudflared exited after the tunnel connected${exit.code === null ? '' : ` with code ${exit.code}`}.\n${started.tryMessage}`)
  }
  return undefined
}

async function targetsRuntime(ctx: CommandContext): Promise<Record<string, unknown>> {
  const action = ctx.commandPath[2]
  if (action !== 'start' && action !== 'stop' && action !== 'restart') throw usage(`Unsupported runtime command: ${ctx.commandPath.join(' ')}`)
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `targets.runtime.${action}`, request: { target: publicTarget(target) } }
  if (action === 'start' && target.type === 'desktop') return { result: await launchDesktopApp(target.dataDir ? target : undefined), target: publicTarget(target) }
  if (!target.dataDir || target.type !== 'server') throw usage(`Target "${target.id}" is not a local Beeper Server install.`)
  if (action === 'start') return { result: await startProfile(target), target: publicTarget(target) }
  if (action === 'stop') {
    await stopProfile(target)
    return { stopped: true, target: publicTarget(target) }
  }
  await stopProfile(target).catch(() => undefined)
  return { restarted: true, result: await startProfile(target), target: publicTarget(target) }
}

async function targetsLogs(ctx: CommandContext): Promise<void> {
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  if (target.type === 'remote') throw usage(`Target "${target.id}" is remote and has no local logs.`)
  const lines = numberFlag(ctx.flags, 'lines', 200)
  if (target.type === 'server') {
    if (!target.dataDir) throw usage(`Target "${target.id}" is not a local Beeper Server install.`)
    await printLogFile(profileLogPath(target.id), lines)
    await printLogFile(profileErrorLogPath(target.id), lines)
    return
  }
  const files = await listLogFiles(desktopLogDir(target.dataDir ? target : undefined))
  const selected = ctx.flags.all ? files : files.slice(0, numberFlag(ctx.flags, 'files', 5))
  for (const file of selected) await printLogFile(file, lines)
}

async function listLogFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listLogFiles(path)
    if (entry.isFile() && entry.name.endsWith('.log')) return [path]
    return []
  }))
  const paths = files.flat()
  const stats = await Promise.all(paths.map(async path => ({ path, mtimeMs: (await stat(path)).mtimeMs })))
  return stats.sort((a, b) => b.mtimeMs - a.mtimeMs).map(item => item.path)
}

async function printLogFile(path: string, lines: number): Promise<void> {
  const content = await readFile(path, 'utf8').catch(() => '')
  if (!content) return
  process.stdout.write(`\n==> ${path} <==\n`)
  if (lines <= 0) process.stdout.write(content.endsWith('\n') ? content : `${content}\n`)
  else {
    const parts = content.split('\n')
    const tail = parts.slice(Math.max(0, parts.length - lines - 1)).join('\n')
    process.stdout.write(tail.endsWith('\n') ? tail : `${tail}\n`)
  }
}

async function installCommand(ctx: CommandContext): Promise<Record<string, unknown>> {
  const type = ctx.commandPath[1]
  if (type !== 'desktop' && type !== 'server') throw usage(`Unsupported install command: ${ctx.commandPath.join(' ')}`)
  const channel = stringFlag(ctx.flags, 'channel') === 'nightly' ? 'nightly' : 'stable'
  const serverEnv = normalizeServerEnv(stringFlag(ctx.flags, 'server-env') ?? 'prod')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `install.${type}`, request: { channel, serverEnv } }
  if (type === 'desktop') await installDesktop({ channel, serverEnv })
  else await installServer({ channel, serverEnv })
  return { installed: type, channel, serverEnv }
}

async function accountsList(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  const selected = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true, applyDefault: false })
  const config = await readConfig()
  const rows = apiItems(await client.accounts.list())
  const items = rows
    .filter(row => !selected?.length || selected.includes(accountIDForRow(row)))
    .map(row => ({ ...row, default: accountIDForRow(row) === config.defaultAccount || undefined }))
  return ctx.flags.ids ? ids(items, 'accountID') : items
}

async function accountsShow(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'accounts.show', request: { selector } }
  const client = await apiClient(ctx)
  const accountID = await resolveAccountID(client, selector)
  const config = await readConfig()
  const item = apiItems(await client.accounts.list()).find(row => accountIDForRow(row) === accountID)
  if (!item) throw new AbortError(`No account matches "${selector}"`, ExitCodes.NotFound, undefined, 'not_found')
  return { ...item, default: accountID === config.defaultAccount || undefined }
}

async function useTarget(ctx: CommandContext): Promise<Record<string, unknown>> {
  const target = await resolveTarget({ target: ctx.args[0]! })
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'use.target', request: { defaultTarget: target.id } }
  await updateConfig(config => ({ ...config, defaultTarget: target.id }))
  return { defaultTarget: target.id }
}

async function useAccount(ctx: CommandContext): Promise<Record<string, unknown>> {
  const input = ctx.args[0]!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'use.account', request: { defaultAccount: input } }
  const client = await apiClient(ctx)
  const accountID = await resolveAccountID(client, input)
  await updateConfig(config => ({ ...config, defaultAccount: accountID }))
  return { defaultAccount: accountID }
}

async function accountsAdd(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  let bridge = ctx.args[0]
  const guided = ctx.flags.guided !== false
  const nonInteractive = ctx.globalFlags.noInput
  const bridges = apiItems(await client.bridges.list())

  if (!bridge) {
    if (ctx.globalFlags.json || ctx.globalFlags.plain) return bridges
    if (guided && !nonInteractive && process.stdin.isTTY) {
      bridge = await chooseBridge(bridges)
    } else {
      printAvailableBridges(bridges)
      return undefined
    }
  }

  const accountType = resolveBridgeChoice(bridges, bridge)
  if (String(accountType.status ?? 'available') !== 'available') {
    const name = String(accountType.displayName ?? accountType.name ?? accountType.id)
    const detail = accountType.statusText ? `: ${String(accountType.statusText)}` : ''
    throw usage(`${name} is not available${detail}`)
  }

  let flowID = stringFlag(ctx.flags, 'flow')
  if (!flowID) {
    const flows = apiItems(await client.bridges.loginFlows.list(String(accountType.id)))
    if (flows.length > 1) {
      if (guided && !nonInteractive && !ctx.globalFlags.json) flowID = await chooseLoginFlow(flows)
      else throw usage(`Multiple sign-in methods are available for ${String(accountType.displayName ?? accountType.id)}. Pass --flow.`)
    } else {
      flowID = flows[0]?.id ? String(flows[0].id) : undefined
    }
    if (!flowID) throw usage(`No login flows returned for ${String(accountType.displayName ?? accountType.id)}.`)
  }

  const cookies = parseKeyValueFlags(stringListFlag(ctx.flags, 'cookie'), '--cookie')
  const fields = parseKeyValueFlags(stringListFlag(ctx.flags, 'field'), '--field')
  const request = {
    bridgeID: String(accountType.id),
    bridgeName: accountType.displayName ?? accountType.name,
    cookieKeys: Object.keys(cookies),
    fieldKeys: Object.keys(fields),
    flowID,
    guided,
    loginID: stringFlag(ctx.flags, 'login-id'),
    nonInteractive,
    webview: Boolean(ctx.flags.webview),
    webviewBackend: stringFlag(ctx.flags, 'webview-backend') ?? 'chrome',
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'accounts.add', request }

  const step = await client.bridges.loginSessions.create(String(accountType.id), {
    flowID,
    loginID: stringFlag(ctx.flags, 'login-id'),
  })
  const result = guided
    ? await runGuidedAccountLogin(client, String(accountType.id), step, {
      cookies,
      fields,
      nonInteractive,
      webview: Boolean(ctx.flags.webview),
      webviewBackend: request.webviewBackend as 'auto' | 'chrome' | 'webkit',
      webviewTimeoutMs: numberFlag(ctx.flags, 'webview-timeout', 120) * 1000,
    })
    : step
  if (ctx.globalFlags.json || ctx.globalFlags.plain) return result
  await printAccountLoginStep(result)
  return undefined
}

async function authServices(ctx: CommandContext): Promise<unknown> {
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'auth.services', request: { target: ctx.globalFlags.target } }
  const client = await apiClient(ctx)
  const bridges = apiItems(await client.bridges.list())
  const services = bridges.map(bridge => ({
    bridge_id: bridge.id,
    name: bridge.displayName ?? bridge.name ?? bridge.id,
    provider: bridge.provider,
    service: bridge.type ?? bridge.network ?? bridge.id,
    status: bridge.status ?? 'available',
    supports_multiple_accounts: bridge.supportsMultipleAccounts,
  }))
  if (ctx.globalFlags.json) return { services }
  if (ctx.globalFlags.plain) return services
  if (ctx.flags.markdown) {
    printBridgeServicesMarkdown(services)
    return undefined
  }
  printAvailableBridges(bridges)
  return undefined
}

async function removeTargetCommand(ctx: CommandContext): Promise<Record<string, unknown>> {
  const input = ctx.args[0]!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'remove.target', request: { id: input } }
  await removeTarget(input)
  return { id: input, removed: true }
}

async function removeAccount(ctx: CommandContext): Promise<Record<string, unknown>> {
  const input = ctx.args[0]!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'remove.account', request: { account: input } }
  const client = await apiClient(ctx)
  const accountID = await resolveAccountID(client, input)
  if (client.accounts.delete) await client.accounts.delete(accountID)
  else if (client.accounts.remove) await client.accounts.remove(accountID)
  else throw usage('This Desktop API does not expose account removal.')
  return { accountID, removed: true }
}

async function contactsList(ctx: CommandContext): Promise<unknown> {
  const queryFlag = stringFlag(ctx.flags, 'query')
  const queryArg = ctx.args[0]
  if (queryFlag && queryArg) throw usage('--query and positional <query> cannot be combined')
  const query = queryFlag ?? queryArg
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true }) ?? await listAccountIDs(client)
  const limit = numberFlag(ctx.flags, 'limit', 50)
  const items: Array<Record<string, unknown>> = []
  for (const accountID of accountIDs) {
    const remaining = limit - items.length
    if (remaining <= 0) break
    const contacts = await collectPage(client.accounts.contacts.list(accountID, { query }), remaining)
    items.push(...contacts.map(item => ({ ...apiRecord(item), accountID })))
  }
  return ctx.flags.ids ? ids(items, 'userID') : items
}

async function contactsShow(ctx: CommandContext): Promise<unknown> {
  const selectorArg = ctx.args[0]
  const jid = stringFlag(ctx.flags, 'jid')
  if (selectorArg && jid) throw usage('--jid and positional <selector> cannot be combined')
  const selector = jid ?? selectorArg
  if (!selector) throw usage('contacts show requires <selector> or --jid')
  const request = {
    accounts: stringListFlag(ctx.flags, 'account'),
    jid,
    limit: numberFlag(ctx.flags, 'limit', 10),
    pick: ctx.flags.pick,
    selector,
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'contacts.show', request }
  const client = await apiClient(ctx)
  const candidates = await contactCandidates(client, selector, stringListFlag(ctx.flags, 'account'), request.limit)
  if (!candidates.length) throw new AbortError(`No contact matches "${selector}"`, ExitCodes.NotFound, undefined, 'not_found')
  const pick = numberFlag(ctx.flags, 'pick', 0)
  if (pick) {
    const selected = candidates[pick - 1]
    if (!selected) throw new AbortError(`--pick ${pick} is out of range; ${candidates.length} candidate(s) available`, ExitCodes.NotFound, undefined, 'not_found')
    return selected
  }
  if (candidates.length > 1) {
    throw new AbortError(`Ambiguous contact "${selector}". Use --pick N:\n${candidates.map((contact, index) => `  ${index + 1}. ${contactLabel(contact)}`).join('\n')}`, ExitCodes.Ambiguous, undefined, 'ambiguous_selector')
  }
  return candidates[0]
}

async function chatsList(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true })
  const query = stringFlag(ctx.flags, 'query')
  if (query) {
    const items = (await collectPage(client.chats.search({ accountIDs, query }), numberFlag(ctx.flags, 'limit', 50)))
      .map(apiRecord)
      .filter(row => matchesChatFilters(row, ctx))
    return ctx.flags.ids ? ids(items, 'localChatID') : items
  }
  const items: Record<string, unknown>[] = []
  for await (const item of client.chats.list({ accountIDs })) {
    const row = apiRecord(item)
    if (matchesChatFilters(row, ctx)) items.push(row)
    if (items.length >= numberFlag(ctx.flags, 'limit', 50)) break
  }
  return ctx.flags.ids ? ids(items, 'localChatID') : items
}

async function groupsList(ctx: CommandContext): Promise<unknown> {
  return chatsList({ ...ctx, flags: { ...ctx.flags, type: 'group' } })
}

async function chatsShow(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  const flagChat = stringFlag(ctx.flags, 'chat')
  const positionalChat = ctx.args[0]
  if (flagChat && positionalChat) throw usage('--chat and positional <chat> cannot be combined')
  const chat = flagChat ?? positionalChat
  if (!chat) throw usage('chats show requires --chat or <chat>')
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  return client.chats.retrieve(chatID, { maxParticipantCount: numberFlag(ctx.flags, 'max-participants', 0) || undefined })
}

async function groupsShow(ctx: CommandContext): Promise<unknown> {
  const flagJid = stringFlag(ctx.flags, 'jid')
  const positionalJid = ctx.args[0]
  if (flagJid && positionalJid) throw usage('--jid and positional <jid> cannot be combined')
  const jid = flagJid ?? positionalJid
  if (!jid) throw usage('groups show requires --jid or <jid>')
  return chatsShow({ ...ctx, args: [], flags: { ...ctx.flags, chat: jid } })
}

async function chatsStart(ctx: CommandContext): Promise<unknown> {
  const user = ctx.args[0]
  if (!user) throw usage('chats start requires user')
  const account = stringFlag(ctx.flags, 'account')
  const title = stringFlag(ctx.flags, 'title')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.start', request: { account, title, user: userQueryFromInput(user) } }
  const client = await apiClient(ctx)
  const accountID = account ? await resolveAccountID(client, account) : await defaultAccountID(client)
  const payload = { accountID, title, user: userQueryFromInput(user) }
  return client.chats.start(payload)
}

async function groupsCreate(ctx: CommandContext): Promise<unknown> {
  const users = stringListFlag(ctx.flags, 'user')
  if (!users.length) throw usage('groups create requires at least one --user')
  const account = stringFlag(ctx.flags, 'account')
  const title = stringFlag(ctx.flags, 'name')!
  const messageText = stringFlag(ctx.flags, 'message')
  const participantIDs = users.map(user => user.trim()).filter(Boolean)
  if (!participantIDs.length) throw usage('groups create requires at least one non-empty --user')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'groups.create', request: { account, messageText, participantIDs, title } }
  const client = await apiClient(ctx)
  const accountID = account ? await resolveAccountID(client, account) : await defaultAccountID(client)
  return client.chats.create({ accountID, messageText, participantIDs, title, type: 'group' })
}

async function groupsRename(ctx: CommandContext): Promise<unknown> {
  return chatsUpdate({ ...ctx, args: [], flags: { ...ctx.flags, chat: groupSelector(ctx), title: stringFlag(ctx.flags, 'name') } }, 'rename', { title: stringFlag(ctx.flags, 'name') })
}

async function groupsDescription(ctx: CommandContext): Promise<unknown> {
  return chatsDescription({ ...ctx, args: [], flags: { ...ctx.flags, chat: groupSelector(ctx), description: stringFlag(ctx.flags, 'description') ?? stringFlag(ctx.flags, 'topic') } })
}

function groupSelector(ctx: CommandContext): string {
  const flagJid = stringFlag(ctx.flags, 'jid')
  const positionalJid = ctx.args[0]
  if (flagJid && positionalJid) throw usage('--jid and positional <jid> cannot be combined')
  const jid = flagJid ?? positionalJid
  if (!jid) throw usage(`${ctx.commandPath.join(' ')} requires --jid or <jid>`)
  return jid
}

async function chatsUpdate(ctx: CommandContext, op: string, update: Record<string, unknown>): Promise<unknown> {
  const chat = chatSelector(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `chats.${op}`, request: { chat, pick: ctx.flags.pick, ...update } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  return client.chats.update(chatID, update)
}

async function chatsSetFlag(ctx: CommandContext): Promise<unknown> {
  const action = ctx.commandPath[1] ?? ''
  const spec = ({
    archive: ['isArchived', true],
    mute: ['isMuted', true],
    pin: ['isPinned', true],
    unarchive: ['isArchived', false],
    unmute: ['isMuted', false],
    unpin: ['isPinned', false],
  } as const)[action]
  if (!spec) throw usage(`Unsupported chat command: ${ctx.commandPath.join(' ')}`)
  const [field, defaultValue] = spec
  return chatsUpdate(ctx, action, { [field]: ctx.flags.clear ? false : defaultValue })
}

async function chatsRename(ctx: CommandContext): Promise<unknown> {
  return chatsUpdate(ctx, 'rename', { title: stringFlag(ctx.flags, 'title') })
}

async function chatsDescription(ctx: CommandContext): Promise<unknown> {
  const clear = Boolean(ctx.flags.clear)
  const description = stringFlag(ctx.flags, 'description')
  if (!clear && !description) throw usage('Provide --description or --clear')
  return chatsUpdate(ctx, 'description', { description: clear ? null : description })
}

async function chatsAvatar(ctx: CommandContext): Promise<unknown> {
  const clear = Boolean(ctx.flags.clear)
  const file = stringFlag(ctx.flags, 'file')
  if (!clear && !file) throw usage('Provide --file or --clear')
  return chatsUpdate(ctx, 'avatar', { imgURL: clear ? null : file })
}

async function chatsPriority(ctx: CommandContext): Promise<unknown> {
  const level = stringFlag(ctx.flags, 'level')!
  const update = level === 'inbox' ? { isArchived: false, isLowPriority: false } : { isLowPriority: true }
  const chat = chatSelector(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.priority', request: { chat, level, pick: ctx.flags.pick, update } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  return client.chats.update(chatID, update)
}

async function chatsRead(ctx: CommandContext): Promise<unknown> {
  const messageID = stringFlag(ctx.flags, 'message')
  const read = ctx.commandPath[1] === 'mark-unread' ? false : !ctx.flags.unread
  const chat = chatSelector(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.read', request: { chat, messageID, pick: ctx.flags.pick, read } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  return read ? client.chats.markRead(chatID, { messageID }) : client.chats.markUnread(chatID, { messageID })
}

async function chatsDraft(ctx: CommandContext): Promise<unknown> {
  const clear = Boolean(ctx.flags.clear)
  const chat = chatSelector(ctx)
  if (!clear && ctx.flags.text === undefined) throw usage('Provide --text TEXT, optionally with --file PATH, or --clear.')
  if (clear && (ctx.flags.text !== undefined || ctx.flags.file)) throw usage('--clear cannot be combined with --text or --file.')
  if (clear) {
    if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.draft', request: { chat, draft: null, pick: ctx.flags.pick } }
    const client = await apiClient(ctx)
    const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
    return client.chats.update(chatID, { draft: null })
  }
  const draft = { file: stringFlag(ctx.flags, 'file'), fileName: stringFlag(ctx.flags, 'filename'), mimeType: stringFlag(ctx.flags, 'mime'), text: stringFlag(ctx.flags, 'text') }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.draft', request: { chat, draft, pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  const upload = draft.file ? await client.assets.upload({ file: createReadStream(draft.file), fileName: draft.fileName, mimeType: draft.mimeType }) : undefined
  return client.chats.update(chatID, { draft: { text: draft.text, attachments: upload?.uploadID ? { [upload.uploadID]: upload } : undefined } })
}

async function chatsRemind(ctx: CommandContext): Promise<unknown> {
  const chat = chatSelector(ctx)
  if (ctx.flags.clear) {
    if (ctx.flags.when || ctx.flags['dismiss-on-message']) throw usage('--clear cannot be combined with --when or --dismiss-on-message')
    if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.remind', request: { chat, pick: ctx.flags.pick, reminder: null } }
    const client = await apiClient(ctx)
    const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
    await client.chats.reminders.delete(chatID)
    return { chatID, reminderCleared: true }
  }
  const when = requiredStringFlag(ctx.flags, 'when')
  const reminder = { dismissOnIncomingMessage: Boolean(ctx.flags['dismiss-on-message']) || undefined, remindAt: when }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.remind', request: { chat, pick: ctx.flags.pick, reminder } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  await client.chats.reminders.create(chatID, { reminder })
  return { chatID, remindAt: when, reminderSet: true }
}

async function chatsDisappear(ctx: CommandContext): Promise<unknown> {
  const messageExpirySeconds = parseDisappearSeconds(requiredStringFlag(ctx.flags, 'seconds'))
  return chatsUpdate(ctx, 'disappear', { messageExpirySeconds })
}

function parseDisappearSeconds(value: string): number | null {
  const raw = value.trim().toLowerCase()
  if (raw === 'off') return null
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw)
    if (Number.isSafeInteger(seconds) && seconds >= 0) return seconds
  }
  const match = raw.match(/^(\d+)(s|m|h|d)$/)
  if (match) {
    const amount = Number(match[1])
    const factors: Record<string, number> = { d: 86_400, h: 3_600, m: 60, s: 1 }
    const seconds = amount * factors[match[2]!]!
    if (Number.isSafeInteger(seconds) && seconds >= 0) return seconds
  }
  throw usage('--seconds must be a positive integer, a duration like 24h/7d/90d, or "off"')
}

async function chatsFocus(ctx: CommandContext): Promise<unknown> {
  const chat = ctx.args[0] ?? stringFlag(ctx.flags, 'chat')
  if (ctx.globalFlags.dryRun) {
    return {
      dry_run: true,
      op: 'chats.focus',
      request: {
        chat,
        draftAttachmentPath: stringFlag(ctx.flags, 'file'),
        draftText: stringFlag(ctx.flags, 'text'),
        messageID: stringFlag(ctx.flags, 'message'),
        pick: ctx.flags.pick,
      },
    }
  }
  const client = await apiClient(ctx)
  if (!chat) throw usage('chats focus requires --chat or chat')
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  const request = {
    chatID,
    draftAttachmentPath: stringFlag(ctx.flags, 'file'),
    draftText: stringFlag(ctx.flags, 'text'),
    messageID: stringFlag(ctx.flags, 'message'),
  }
  return client.focus(request)
}

async function chatsNotifyAnyway(ctx: CommandContext): Promise<unknown> {
  const chat = chatSelector(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.notify-anyway', request: { chat, pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  return client.chats.notifyAnyway(chatID)
}

function chatSelector(ctx: CommandContext): string {
  const flagChat = stringFlag(ctx.flags, 'chat')
  const positionalChat = ctx.args[0]
  if (flagChat && positionalChat) throw usage('--chat and positional <chat> cannot be combined')
  const chat = flagChat ?? positionalChat
  if (!chat) throw usage(`${ctx.commandPath.join(' ')} requires --chat or <chat>`)
  return chat
}

async function unifiedSearch(ctx: CommandContext): Promise<unknown> {
  const query = ctx.args[0]!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'search.all', request: { query } }
  const client = await apiClient(ctx)
  const result = await client.search({ query }) as Record<string, unknown>
  if (ctx.globalFlags.json || ctx.globalFlags.plain) return result
  const results = isRecord(result.results) ? result.results : {}
  const messages = isRecord(results.messages) ? results.messages : {}
  return {
    chats: Array.isArray(results.chats) ? results.chats.length : 0,
    in_groups: Array.isArray(results.in_groups) ? results.in_groups.length : 0,
    messages: Array.isArray(messages.items) ? messages.items.length : 0,
    has_more_messages: messages.hasMore,
    query,
  }
}

async function resolveAccount(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  const client = await apiClient(ctx)
  const rows = apiItems(await client.accounts.list())
  const ids = await resolveAccountIDs(client, [selector], { allowMultiplePerInput: true, applyDefault: false })
  const candidates = rows.filter(row => ids?.includes(String(row.accountID ?? row.id)))
  return resolution(ctx, 'account', selector, candidates.map(account => ({
    accountID: account.accountID,
    bridge: account.bridge,
    id: account.accountID ?? account.id,
    network: account.network,
    raw: account,
    user: account.user,
  })))
}

async function resolveChat(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true })
  const candidates = await collectPage(client.chats.search({ accountIDs, query: selector, scope: 'titles' }), numberFlag(ctx.flags, 'limit', 10))
  const normalized = normalizeSelector(selector)
  const exact = candidates.map(apiRecord).filter(chat =>
    normalizeSelector(chat.id) === normalized ||
    normalizeSelector(chat.localChatID) === normalized ||
    normalizeSelector(chat.title) === normalized
  )
  const matches = exact.length ? exact : candidates.map(apiRecord)
  return resolution(ctx, 'chat', selector, matches.map(chat => ({
    accountID: chat.accountID,
    id: chat.id,
    localChatID: chat.localChatID,
    network: chat.network,
    raw: chat,
    title: chat.title,
  })))
}

async function resolveContact(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  const client = await apiClient(ctx)
  const candidates = await contactCandidates(client, selector, stringListFlag(ctx.flags, 'account'), numberFlag(ctx.flags, 'limit', 10))
  return resolution(ctx, 'contact', selector, candidates.map(contact => ({
    accountID: contact.accountID,
    displayName: contact.displayName ?? contact.fullName ?? contact.name,
    email: contact.email,
    id: contact.id,
    phoneNumber: contact.phoneNumber,
    username: contact.username,
  })))
}

async function contactCandidates(client: any, selector: string, accountSelectors: string[], limit: number): Promise<Record<string, unknown>[]> {
  const accountIDs = await resolveAccountIDs(client, accountSelectors, { allowMultiplePerInput: true }) ?? await listAccountIDs(client)
  const candidates: Record<string, unknown>[] = []
  for (const accountID of accountIDs) {
    try {
      const result = await client.accounts.contacts.search(accountID, { query: selector })
      candidates.push(...apiItems(result).slice(0, limit).map(item => ({ ...item, accountID })))
    } catch (error) {
      if (!ignorableLookupError(error)) throw error
    }
  }
  return candidates.slice(0, limit)
}

function contactLabel(contact: Record<string, unknown>): string {
  const name = contact.displayName ?? contact.fullName ?? contact.name ?? contact.username ?? contact.id ?? contact.userID
  const account = contact.accountID ? ` (${String(contact.accountID)})` : ''
  return `${String(name ?? 'contact')}${account}`
}

async function resolveTargetCommand(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  const normalized = normalizeSelector(selector)
  const targets = await listTargets()
  const rows = targets.some(target => target.id === builtInDesktopTargetID)
    ? targets
    : [await resolveTarget({ target: builtInDesktopTargetID }), ...targets]
  const candidates = rows.filter(target =>
    normalizeSelector(target.id) === normalized ||
    normalizeSelector(target.name) === normalized ||
    normalizeSelector(target.type) === normalized ||
    normalizeSelector(target.baseURL).includes(normalized)
  )
  return resolution(ctx, 'target', selector, candidates.map(target => ({
    baseURL: target.baseURL,
    id: target.id,
    localProfile: Boolean(target.dataDir),
    name: target.name,
    raw: publicTarget(target),
    type: target.type,
  })))
}

async function resolveBridge(ctx: CommandContext): Promise<unknown> {
  const selector = ctx.args[0]!
  const client = await apiClient(ctx)
  const rows = apiItems(await client.bridges.list())
  const normalized = normalizeSelector(selector)
  const candidates = rows.filter(bridge =>
    normalizeSelector(bridge.id) === normalized ||
    normalizeSelector(bridge.type) === normalized ||
    normalizeSelector(bridge.provider) === normalized ||
    normalizeSelector(bridge.name) === normalized ||
    normalizeSelector(bridge.displayName) === normalized ||
    normalizeSelector(bridge.id).includes(normalized) ||
    normalizeSelector(bridge.displayName).includes(normalized)
  )
  return resolution(ctx, 'bridge', selector, candidates.map(bridge => ({
    displayName: bridge.displayName ?? bridge.name,
    id: bridge.id,
    provider: bridge.provider,
    raw: bridge,
    status: bridge.status,
    type: bridge.type,
  })))
}

async function messagesList(ctx: CommandContext): Promise<unknown> {
  const items = await collectListedMessages(ctx)
  return ctx.flags.ids ? ids(items.map(apiRecord), 'messageID') : items
}

async function messagesExport(ctx: CommandContext): Promise<unknown> {
  const request = {
    afterCursor: stringFlag(ctx.flags, 'after-cursor'),
    asc: Boolean(ctx.flags.asc),
    beforeCursor: stringFlag(ctx.flags, 'before-cursor'),
    chat: stringFlag(ctx.flags, 'chat'),
    limit: numberFlag(ctx.flags, 'limit', 1000),
    output: stringFlag(ctx.flags, 'output'),
    pick: ctx.flags.pick,
    sender: messageSenderFilter(ctx),
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'messages.export', request }
  const items = await collectListedMessages(ctx)
  const out = stringFlag(ctx.flags, 'output')
  if (!out) return items
  await writeFile(out, `${JSON.stringify(items, null, 2)}\n`)
  return { count: items.length, path: out }
}

async function collectListedMessages(ctx: CommandContext): Promise<unknown[]> {
  const chat = stringFlag(ctx.flags, 'chat')!
  const before = stringFlag(ctx.flags, 'before-cursor')
  const after = stringFlag(ctx.flags, 'after-cursor')
  if (before && after) throw usage('Use only one of --before-cursor or --after-cursor')
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  let items = await collectMessages(client.messages.list(chatID, {
    cursor: before ?? after,
    direction: before ? 'before' : after ? 'after' : undefined,
  }), numberFlag(ctx.flags, 'limit', 50), messageListFilter(ctx))
  if (ctx.flags.asc) items = [...items].reverse()
  return items
}

async function messagesContext(ctx: CommandContext): Promise<unknown> {
  const id = messageID(ctx)
  const showOnly = ctx.commandPath[1] === 'show'
  const beforeCount = showOnly ? 0 : numberFlag(ctx.flags, 'before', 10)
  const afterCount = showOnly ? 0 : numberFlag(ctx.flags, 'after', 10)
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: showOnly ? 'messages.show' : 'messages.context', request: { after: afterCount, before: beforeCount, chat: stringFlag(ctx.flags, 'chat'), messageID: id, pick: ctx.flags.pick } }
  }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  const message = client.messages.retrieve ? await client.messages.retrieve(id, { chatID }) : undefined
  if (showOnly) return { chatID, message, messageID: id }
  const before = await collectPage(client.messages.list(chatID, { cursor: id, direction: 'before' }), beforeCount)
  const after = await collectPage(client.messages.list(chatID, { cursor: id, direction: 'after' }), afterCount)
  return { after, before, chatID, message, messageID: id }
}

async function messagesForward(ctx: CommandContext): Promise<unknown> {
  const id = messageID(ctx)
  const to = stringFlag(ctx.flags, 'to')!
  const attachmentIndex = numberFlag(ctx.flags, 'attachment-index', 1)
  if (attachmentIndex <= 0) throw usage('--attachment-index must be a positive integer')
  const delivery = sendDelivery(ctx)
  const request = {
    attachmentIndex,
    chat: stringFlag(ctx.flags, 'chat'),
    messageID: id,
    pick: ctx.flags.pick,
    to,
    wait: delivery.wait,
    waitTimeoutMs: delivery.waitTimeoutMs,
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'messages.forward', request }

  const client = await apiClient(ctx)
  const sourceChatID = await chatIDFromFlag(client, ctx, 'chat')
  const targetChatID = await resolveChatID(client, to, chatResolutionOptions(ctx))
  const message = await client.messages.retrieve(id, { chatID: sourceChatID }) as Record<string, unknown>
  const payload = await forwardPayload(client, message, attachmentIndex)
  const sent = await sendMessage(client, { ...payload, chatID: targetChatID, ...delivery })
  return { forwarded: true, sourceChatID, sourceMessageID: id, targetChatID, ...sent }
}

async function forwardPayload(client: any, message: Record<string, unknown>, attachmentIndex: number): Promise<SendPayload> {
  const text = typeof message.text === 'string' ? message.text : ''
  const attachments = Array.isArray(message.attachments) ? message.attachments as Array<Record<string, unknown>> : []
  if (!attachments.length) {
    if (!text) throw usage('source message has no text or forwardable attachment')
    return { text }
  }

  const attachment = attachments[attachmentIndex - 1]
  if (!attachment) throw usage(`source message has no attachment at index ${attachmentIndex}`)
  const url = typeof attachment.id === 'string' ? attachment.id : typeof attachment.srcURL === 'string' ? attachment.srcURL : undefined
  if (!url) throw usage(`source message attachment ${attachmentIndex} has no forwardable URL`)
  const response = url.startsWith('mxc://') || url.startsWith('localmxc://')
    ? await client.assets.serve({ url })
    : await fetch(url)
  if (!response.ok) throw usage(`failed to fetch source attachment: HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const upload = await client.assets.uploadBase64({
    content: buffer.toString('base64'),
    fileName: typeof attachment.fileName === 'string' ? attachment.fileName : undefined,
    mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
  })
  if (!upload?.uploadID) throw new Error('Forward upload did not return an uploadID')
  const attachmentType = forwardAttachmentType(attachment)
  return {
    attachmentType,
    duration: typeof attachment.duration === 'number' ? attachment.duration : upload.duration,
    fileName: upload.fileName ?? (typeof attachment.fileName === 'string' ? attachment.fileName : undefined),
    mimeType: upload.mimeType ?? (typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined),
    text,
    forwardedUpload: upload,
  }
}

function forwardAttachmentType(attachment: Record<string, unknown>): AttachmentType | undefined {
  if (attachment.isSticker) return 'sticker'
  if (attachment.isVoiceNote) return 'voice-note'
  return undefined
}

async function messagesEdit(ctx: CommandContext): Promise<unknown> {
  const id = messageID(ctx)
  const text = stringFlag(ctx.flags, 'message')!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'messages.edit', request: { chat: stringFlag(ctx.flags, 'chat'), messageID: id, pick: ctx.flags.pick, text } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return client.messages.update(id, { chatID, text })
}

async function messagesDelete(ctx: CommandContext): Promise<unknown> {
  const id = messageID(ctx)
  const revoke = ctx.commandPath[1] === 'revoke'
  const forEveryone = revoke || Boolean(ctx.flags['for-everyone'])
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: revoke ? 'messages.revoke' : 'messages.delete', request: { chat: stringFlag(ctx.flags, 'chat'), forEveryone, messageID: id, pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  await client.messages.delete(id, { chatID, forEveryone: forEveryone || undefined })
  return { chatID, deleted: true, forEveryone, messageID: id }
}

function messageID(ctx: CommandContext): string {
  const flagID = stringFlag(ctx.flags, 'id')
  const positionalID = ctx.args[0]
  if (flagID && positionalID) throw usage('--id and positional <id> cannot be combined')
  const id = flagID ?? positionalID
  if (!id) throw usage(`${ctx.commandPath.join(' ')} requires --id or <id>`)
  return id
}

async function watch(ctx: CommandContext): Promise<void> {
  if (ctx.flags['webhook-secret'] && !ctx.flags.webhook) throw usage('--webhook-secret requires --webhook URL')
  const include = stringListFlag(ctx.flags, 'include-type')
  const exclude = stringListFlag(ctx.flags, 'exclude-type')
  if (include.length && exclude.length) throw usage('Use either --include-type or --exclude-type, not both.')
  const filter: EventFilter = {
    include: include.length ? new Set(include) : undefined,
    exclude: exclude.length ? new Set(exclude) : undefined,
  }
  const target = await resolveTarget({ target: ctx.globalFlags.target })
  const token = await targetToken(target, true)
  const baseURL = target.baseURL
  const info = await fetch(new URL('/v1/info', baseURL))
  if (!info.ok) throw usage(`Failed to fetch /v1/info: HTTP ${info.status}`)
  const metadata = await info.json() as { endpoints?: { ws_events?: string } }
  const url = new URL(metadata.endpoints?.ws_events || '/v1/ws', baseURL)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

  const subscribed = stringListFlag(ctx.flags, 'chat')
  const chatIDs = subscribed.length ? subscribed : ['*']
  const webhookURL = stringFlag(ctx.flags, 'webhook')
  const webhook = webhookURL
    ? { inflight: 0, max: numberFlag(ctx.flags, 'webhook-queue', 64), queue: [], secret: stringFlag(ctx.flags, 'webhook-secret'), url: webhookURL } satisfies WebhookConfig
    : undefined
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } })

  ws.addEventListener('open', () => {
    if (ctx.globalFlags.events) writeEvent('watch.open', { subscribed: chatIDs })
    ws.send(JSON.stringify({ chatIDs, type: 'subscriptions.set' }))
  })
  ws.addEventListener('message', event => {
    const body = typeof event.data === 'string' ? event.data : event.data.toString()
    if (!passesFilter(body, filter)) return
    if (ctx.globalFlags.events) writeEvent('watch.message')
    writeWatchEvent(body, ctx.globalFlags.json || ctx.globalFlags.plain)
    if (webhook) forwardWebhook(webhook, body, ctx.globalFlags.events)
  })
  ws.addEventListener('error', () => {
    if (ctx.globalFlags.events) writeEvent('watch.error', { message: 'WebSocket connection failed' })
  })
  ws.addEventListener('close', event => {
    if (ctx.globalFlags.events) writeEvent('watch.close', { code: event.code, reason: event.reason })
  })

  await new Promise<void>(resolve => {
    process.once('SIGINT', () => {
      ws.close(1000)
      resolve()
    })
    ws.addEventListener('close', () => resolve())
  })
}

async function mediaDownload(ctx: CommandContext): Promise<unknown> {
  const out = stringFlag(ctx.flags, 'out') ?? '.'
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'media.download', request: { ...mediaDownloadDryRunRequest(ctx), out } }
  const request = await mediaDownloadRequest(ctx)

  const client = await apiClient(ctx)
  const response = request.url.startsWith('mxc://') || request.url.startsWith('localmxc://')
    ? await client.assets.serve({ url: request.url })
    : await fetch(request.url)
  if (!response.ok) throw usage(`Failed to download media: HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (out === '-') {
    output.write(buffer)
    return undefined
  }

  const path = outputPath(out, request.fileName || fileNameFromURL(request.url, request.mimeType))
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, buffer)
  return { bytes: buffer.length, messageID: request.messageID, path, url: request.url }
}

function mediaDownloadDryRunRequest(ctx: CommandContext): Record<string, unknown> {
  const messageID = mediaMessageID(ctx)
  if (messageID) {
    return { chat: stringFlag(ctx.flags, 'chat'), index: numberFlag(ctx.flags, 'index', 1), messageID, poster: Boolean(ctx.flags.poster) }
  }
  const url = ctx.args[0]
  if (!url) throw usage('media download requires <url> or --id with --chat')
  return { url }
}

async function mediaDownloadRequest(ctx: CommandContext): Promise<{ fileName?: string; messageID?: string; mimeType?: string; url: string }> {
  const messageID = mediaMessageID(ctx)
  if (!messageID) {
    const url = ctx.args[0]
    if (!url) throw usage('media download requires <url> or --id with --chat')
    return { url }
  }
  const chat = stringFlag(ctx.flags, 'chat')
  if (!chat) throw usage('--chat is required when --id is used')
  const index = numberFlag(ctx.flags, 'index', 1)
  if (index <= 0) throw usage('--index must be a positive integer')
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  const message = await client.messages.retrieve(messageID, { chatID }) as { attachments?: Array<Record<string, unknown>> }
  const attachment = message.attachments?.[index - 1]
  if (!attachment) throw usage(`message "${messageID}" has no attachment at index ${index}`)
  const source = ctx.flags.poster ? attachment.posterImg : attachment.id ?? attachment.srcURL
  if (typeof source !== 'string' || !source) throw usage(`message "${messageID}" attachment ${index} has no downloadable URL`)
  return {
    fileName: typeof attachment.fileName === 'string' ? attachment.fileName : undefined,
    messageID,
    mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
    url: source,
  }
}

function mediaMessageID(ctx: CommandContext): string | undefined {
  const flagID = stringFlag(ctx.flags, 'id')
  const isMessageCommand = ctx.commandPath.join(' ') === 'media message'
  if (flagID && !isMessageCommand && ctx.args[0]) throw usage('Use either positional <url> or --id, not both')
  const positionalID = isMessageCommand ? ctx.args[0] : undefined
  if (flagID && positionalID) throw usage('--id and positional <id> cannot be combined')
  return flagID ?? positionalID
}

function outputPath(out: string, fileName: string): string {
  if (out.endsWith('/') || out === '.' || out === '..') return join(out, safeFileName(fileName))
  try {
    const parsed = new URL(out)
    if (parsed.protocol === 'file:') return fileURLToPath(parsed)
  } catch { /* not a URL */ }
  return out.includes('.') ? out : join(out, safeFileName(fileName))
}

function fileNameFromURL(url: string, mimeType?: string): string {
  try {
    const parsed = new URL(url)
    const name = basename(parsed.pathname)
    if (name) return name
  } catch { /* fall through */ }
  return `media${extensionForMimeType(mimeType)}`
}

function safeFileName(value: string): string {
  const normalized = basename(value).replace(/[/\\?%*:|"<>]+/g, '_').trim()
  return normalized.slice(0, 160) || 'media'
}

function extensionForMimeType(mimeType?: string): string {
  if (!mimeType) return ''
  const known: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'video/mp4': '.mp4',
  }
  if (known[mimeType]) return known[mimeType]!
  const subtype = mimeType.split('/')[1]
  return subtype && !subtype.includes('+') ? `.${subtype}` : ''
}

async function exportCommand(ctx: CommandContext): Promise<unknown> {
  const accountSelectors = stringListFlag(ctx.flags, 'account')
  const chatSelectors = stringListFlag(ctx.flags, 'chat')
  const request = {
    accounts: accountSelectors,
    chats: chatSelectors,
    downloadAttachments: !ctx.flags['no-attachments'],
    force: Boolean(ctx.flags.force),
    limitChats: ctx.flags['limit-chats'],
    limitMessages: ctx.flags['limit-messages'],
    maxParticipants: numberFlag(ctx.flags, 'max-participants', 500),
    outDir: stringFlag(ctx.flags, 'out') ?? 'beeper-export',
    pick: ctx.flags.pick,
  }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'export', request }

  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, accountSelectors, { allowMultiplePerInput: true })
  const chatIDs = chatSelectors.length
    ? await Promise.all(chatSelectors.map(chat => resolveChatID(client, chat, chatResolutionOptions(ctx, accountIDs))))
    : undefined
  const manifest = await exportBeeperData(client, {
    accountIDs,
    chatIDs,
    downloadAttachments: request.downloadAttachments,
    force: request.force,
    limitChats: typeof request.limitChats === 'number' ? request.limitChats : undefined,
    limitMessages: typeof request.limitMessages === 'number' ? request.limitMessages : undefined,
    maxParticipants: request.maxParticipants,
    onProgress: message => {
      if (ctx.globalFlags.events) writeEvent('export.progress', { message })
      if (!ctx.globalFlags.json && !ctx.globalFlags.plain) process.stderr.write(`${message}\n`)
    },
    outDir: request.outDir,
  })
  return { ...manifest, outDir: request.outDir }
}

async function messagesSearch(ctx: CommandContext): Promise<unknown> {
  const accountSelectors = stringListFlag(ctx.flags, 'account')
  const chatSelectors = stringListFlag(ctx.flags, 'chat')
  const mediaTypes = stringListFlag(ctx.flags, 'media') as Array<'any' | 'video' | 'image' | 'link' | 'file'>
  if (ctx.flags['has-media'] && !mediaTypes.includes('any')) mediaTypes.unshift('any')
  const hasFilter = Boolean(
    accountSelectors.length || chatSelectors.length || ctx.flags['chat-type']
    || ctx.flags.after || ctx.flags.before || mediaTypes.length || ctx.flags.sender,
  )
  if (!ctx.args[0] && !hasFilter) {
    throw usage('Provide a search query or at least one filter flag (--chat, --sender, --media, etc.).')
  }
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, accountSelectors, { allowMultiplePerInput: true })
  const chatIDs = chatSelectors.length
    ? await Promise.all(chatSelectors.map(chat => resolveChatID(client, chat, chatResolutionOptions(ctx, accountIDs))))
    : undefined
  const items = await collectPage(client.messages.search({
    accountIDs,
    chatIDs,
    chatType: stringFlag(ctx.flags, 'chat-type') as 'group' | 'single' | undefined,
    dateAfter: stringFlag(ctx.flags, 'after'),
    dateBefore: stringFlag(ctx.flags, 'before'),
    excludeLowPriority: ctx.flags['exclude-low-priority'],
    includeMuted: ctx.flags['include-muted'],
    mediaTypes: mediaTypes.length ? mediaTypes : undefined,
    query: ctx.args[0],
    sender: stringFlag(ctx.flags, 'sender') as 'me' | 'others' | (string & {}) | undefined,
  }), numberFlag(ctx.flags, 'limit', 50))
  if (!items.length && ctx.flags['fail-empty']) {
    throw new AbortError('No messages matched the query or filters.', ExitCodes.EmptyResults, undefined, 'empty_results')
  }
  return ctx.flags.ids ? ids(items.map(apiRecord), 'messageID') : items
}

async function apiCommand(ctx: CommandContext): Promise<unknown> {
  const method = String(ctx.args[0] ?? '').toUpperCase()
  const path = ctx.args[1]
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw usage('api request method must be one of: GET, POST, PUT, PATCH, DELETE')
  if (!path) throw usage('api request requires path')
  const body = method === 'GET' ? undefined : jsonBody(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'api.request', request: { body, method, noAuth: ctx.flags['no-auth'], path, target: ctx.globalFlags.target } }
  return appRequest(method, path, { body, target: ctx.globalFlags.target, token: ctx.flags['no-auth'] ? false : undefined })
}

async function sendTextLike(ctx: CommandContext): Promise<unknown> {
  const kind = ctx.commandPath.length === 1 && ctx.commandPath[0] === 'send' ? 'text' : ctx.commandPath[1]
  if (kind !== 'file' && kind !== 'sticker' && kind !== 'text' && kind !== 'voice') throw usage(`Unsupported send command: ${ctx.commandPath.join(' ')}`)
  const to = sendDestination(ctx)
  const payload = await sendPayload(ctx, kind)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `send.${kind}`, request: { chat: to, ...payload } }

  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, to, chatResolutionOptions(ctx))
  const ephemeral = await applySendEphemeral(client, chatID, payload)
  const sent = await sendMessage(client, { ...payload, chatID })
  return ephemeral ? { ...sent, ephemeral } : sent
}

async function uploadFile(ctx: CommandContext): Promise<unknown> {
  if (stringFlag(ctx.flags, 'file')) throw usage('Use positional <localPath> with upload, not --file')
  return sendTextLike({
    ...ctx,
    args: [],
    commandPath: ['send', 'file'],
    flags: { ...ctx.flags, file: ctx.args[0] },
  })
}

function sendDestination(ctx: CommandContext): string {
  const flagValue = stringFlag(ctx.flags, 'to')
  const positional = isTextSend(ctx) ? ctx.args[0] : undefined
  if (flagValue && positional) throw usage('--to and positional <to> cannot be combined')
  const to = flagValue ?? positional
  if (!to) throw usage('--to is required')
  return to
}

function isTextSend(ctx: CommandContext): boolean {
  return (ctx.commandPath.length === 1 && ctx.commandPath[0] === 'send') || ctx.commandPath[1] === 'text'
}

async function sendMessage(client: any, options: SendPayload & {
  chatID: string
}): Promise<Record<string, unknown>> {
  const uploaded = options.forwardedUpload ?? (options.file
    ? await client.assets.upload({
      file: createReadStream(options.file),
      fileName: options.fileName,
      mimeType: options.mimeType,
    })
    : undefined)

  if (options.file && !uploaded?.uploadID) throw new Error('Upload did not return an uploadID')

  const pending = await client.messages.send(options.chatID, {
    attachment: uploaded?.uploadID
      ? {
        uploadID: uploaded.uploadID,
        type: options.attachmentType,
        duration: options.duration ?? uploaded.duration,
        fileName: uploaded.fileName,
        mimeType: options.mimeType ?? uploaded.mimeType,
        size: uploaded.width && uploaded.height ? { height: uploaded.height, width: uploaded.width } : undefined,
      }
      : undefined,
    replyToMessageID: options.replyTo,
    text: options.text,
    mentions: options.mentions?.length ? options.mentions : undefined,
    disableLinkPreview: options.noPreview || undefined,
  })

  if (!options.wait) {
    return {
      ...pending,
      accepted: true,
      state: 'accepted',
      chatID: options.chatID,
      hint: 'Desktop accepted the send request. Pass --wait to wait for the final message or failure.',
    }
  }
  return {
    accepted: true,
    state: 'resolved',
    chatID: options.chatID,
    pendingMessageID: pending.pendingMessageID,
    message: await waitForMessage(client, options.chatID, pending.pendingMessageID, options.waitTimeoutMs),
  }
}

async function applySendEphemeral(client: any, chatID: string, payload: SendPayload): Promise<{ messageExpirySeconds?: number } | undefined> {
  if (payload.messageExpirySeconds === undefined) return payload.ephemeral ? {} : undefined
  await client.chats.update(chatID, { messageExpirySeconds: payload.messageExpirySeconds })
  return { messageExpirySeconds: payload.messageExpirySeconds }
}

async function waitForMessage(client: any, chatID: string, pendingMessageID: string, timeoutMs = 30_000): Promise<unknown> {
  const started = Date.now()
  let lastError: unknown
  while (Date.now() - started < timeoutMs) {
    try {
      return await client.messages.retrieve(pendingMessageID, { chatID })
    } catch (error) {
      lastError = error
      await sleep(750)
    }
  }
  throw new Error(`Timed out waiting for ${pendingMessageID}${lastError instanceof Error ? `: ${lastError.message}` : ''}`)
}

async function sendReact(ctx: CommandContext): Promise<unknown> {
  const id = reactionMessageID(ctx)
  const rawReaction = stringFlag(ctx.flags, 'reaction') ?? '+1'
  const reaction = rawReaction || '+1'
  const transactionID = stringFlag(ctx.flags, 'transaction')
  const remove = Boolean(ctx.flags.remove) || rawReaction === ''
  const to = sendDestination(ctx)
  const postSendWait = stringFlag(ctx.flags, 'post-send-wait')
  const waitTimeoutMs = postSendWait === undefined ? undefined : parseDurationMs(postSendWait)
  if (remove && transactionID) throw usage('--transaction cannot be combined with --remove')
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: 'send.react', request: { chat: to, messageID: id, pick: ctx.flags.pick, reactionKey: reaction, remove, transactionID, wait: waitTimeoutMs === undefined ? undefined : Boolean(waitTimeoutMs && waitTimeoutMs > 0), waitTimeoutMs } }
  }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'to')
  const result = remove
    ? await client.chats.messages.reactions.delete(reaction, { chatID, messageID: id })
    : await client.chats.messages.reactions.add(id, { chatID, reactionKey: reaction, transactionID })
  if (waitTimeoutMs && waitTimeoutMs > 0) await sleep(waitTimeoutMs)
  return result
}

function reactionMessageID(ctx: CommandContext): string {
  const flagID = stringFlag(ctx.flags, 'id')
  const positionalID = ctx.args[0]
  if (flagID && positionalID) throw usage('--id and positional <id> cannot be combined')
  const id = flagID ?? positionalID
  if (!id) throw usage('send react requires --id or <id>')
  return id
}

async function authLogout(ctx: CommandContext): Promise<Record<string, unknown>> {
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  const token = target.auth?.accessToken
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: 'auth.logout', request: { baseURL: target.baseURL, hadToken: Boolean(token), revokeToken: Boolean(token), target: target.id } }
  }
  if (process.env.BEEPER_ACCESS_TOKEN && !target.auth?.accessToken) {
    throw usage('auth logout cannot clear BEEPER_ACCESS_TOKEN from the environment; unset it in the calling process.')
  }
  let revoked = false
  if (token) {
    const response = await fetch(new URL('/oauth/revoke', target.baseURL), {
      body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined)
    revoked = Boolean(response?.ok)
    await writeTarget({ ...target, auth: undefined })
  }
  return { hadToken: Boolean(token), loggedOut: true, revoked }
}

async function authEmailStart(ctx: CommandContext): Promise<unknown> {
  const target = await resolveTarget({ target: ctx.globalFlags.target })
  const email = stringFlag(ctx.flags, 'email')!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'auth.email.start', request: { email, target: target.id } }
  return startEmailSetup(target, email)
}

async function login(ctx: CommandContext): Promise<unknown> {
  const email = ctx.args[0]
  if (!email) throw usage('login requires email')
  return authEmailStart({ ...ctx, flags: { ...ctx.flags, email } })
}

async function authEmailResponse(ctx: CommandContext): Promise<unknown> {
  const target = await resolveTarget({ target: ctx.globalFlags.target })
  const code = stringFlag(ctx.flags, 'code')!
  const setupRequestID = stringFlag(ctx.flags, 'setup-request-id')!
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: 'auth.email.response', request: { baseURL: target.baseURL, force: ctx.globalFlags.force, setupRequestID, target: target.id, username: stringFlag(ctx.flags, 'username') } }
  }
  return finishEmailSetup(target, {
    code,
    json: ctx.globalFlags.json,
    setupRequestID,
    username: stringFlag(ctx.flags, 'username'),
    force: ctx.globalFlags.force,
  })
}

async function apiClient(ctx: CommandContext): Promise<any> {
  const target = await resolveTarget({ target: ctx.globalFlags.target })
  return new BeeperDesktop({
    accessToken: await targetToken(target, target.id === 'desktop'),
    baseURL: target.baseURL,
    logLevel: ctx.globalFlags.debug ? 'debug' : 'warn',
  })
}

async function targetToken(target: Target, scan?: boolean): Promise<string> {
  const token = process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken
  if (token) return token
  const auth = authFromToken(
    await authorizeTarget({ baseURL: target.baseURL, scan }),
    target.type === 'remote' ? 'remote-oauth' : 'desktop-oauth',
  )
  await writeTarget({ ...target, auth })
  return auth.accessToken
}

function jsonBody(ctx: CommandContext): Record<string, unknown> {
  const raw = stringFlag(ctx.flags, 'body') ?? '{}'
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object')
    return parsed as Record<string, unknown>
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw usage(`--body is not valid JSON: ${detail}`)
  }
}

async function sendPayload(ctx: CommandContext, kind: SendKind): Promise<SendPayload> {
  const delivery = sendDelivery(ctx)
  if (kind === 'text') {
    const message = await messageText(ctx)
    return {
      mentions: stringListFlag(ctx.flags, 'mention'),
      noPreview: Boolean(ctx.flags['no-preview']),
      ...sendEphemeral(ctx),
      replyTo: stringFlag(ctx.flags, 'reply-to'),
      replyToSender: stringFlag(ctx.flags, 'reply-to-sender'),
      text: message,
      ...delivery,
    }
  }
  const fileFlag = stringFlag(ctx.flags, 'file')
  const positionalFile = ctx.args[0]
  if (fileFlag && positionalFile) throw usage('--file and positional <localPath> cannot be combined')
  const file = fileFlag ?? positionalFile
  if (!file) throw usage(`${ctx.commandPath.join(' ')} requires --file or <localPath>`)
  const ptt = kind === 'file' && Boolean(ctx.flags.ptt)
  if (ptt && stringFlag(ctx.flags, 'caption') !== undefined) throw usage('--caption cannot be combined with --ptt')
  const attachmentType: AttachmentType | undefined = kind === 'sticker' ? 'sticker' : kind === 'voice' || ptt ? 'voice-note' : undefined
  return {
    attachmentType,
    duration: kind === 'voice' ? numberFlag(ctx.flags, 'duration', 0) || undefined : undefined,
    file,
    fileName: stringFlag(ctx.flags, 'filename'),
    mimeType: stringFlag(ctx.flags, 'mime') ?? (kind === 'sticker' ? 'image/webp' : kind === 'voice' || ptt ? 'audio/ogg' : undefined),
    replyTo: stringFlag(ctx.flags, 'reply-to'),
    replyToSender: stringFlag(ctx.flags, 'reply-to-sender'),
    text: kind === 'file' && !ptt ? stringFlag(ctx.flags, 'caption') ?? '' : '',
    ...delivery,
  }
}

function sendDelivery(ctx: CommandContext): Pick<SendPayload, 'wait' | 'waitTimeoutMs'> {
  const postSendWait = stringFlag(ctx.flags, 'post-send-wait')
  if (postSendWait !== undefined) {
    const waitTimeoutMs = parseDurationMs(postSendWait)
    return { wait: Boolean(waitTimeoutMs && waitTimeoutMs > 0), waitTimeoutMs }
  }
  return { wait: Boolean(ctx.flags.wait), waitTimeoutMs: numberFlag(ctx.flags, 'wait-timeout', 30_000) }
}

function sendEphemeral(ctx: CommandContext): Pick<SendPayload, 'ephemeral' | 'ephemeralDuration' | 'messageExpirySeconds'> {
  const duration = stringFlag(ctx.flags, 'ephemeral-duration')
  if (!ctx.flags.ephemeral && duration === undefined) return {}
  const messageExpirySeconds = duration === undefined ? undefined : parseDisappearSeconds(duration)
  if (messageExpirySeconds === null || messageExpirySeconds === 0) throw usage('--ephemeral-duration must be a positive duration like 24h, 7d, 90d, or 168h')
  return {
    ephemeral: true,
    ephemeralDuration: duration,
    messageExpirySeconds: messageExpirySeconds ?? undefined,
  }
}

async function messageText(ctx: CommandContext): Promise<string> {
  const literal = stringFlag(ctx.flags, 'message')
  const file = stringFlag(ctx.flags, 'message-file')
  const positional = isTextSend(ctx) ? ctx.args.slice(1).join(' ') : ''
  if (literal && file) throw usage('--message and --message-file cannot be combined')
  if (positional && (literal !== undefined || file)) throw usage('positional <message> cannot be combined with --message or --message-file')
  if (file) return file === '-' ? await readStdin() : readFile(file, 'utf8')
  if (literal !== undefined) return ctx.flags['message-escapes'] ? decodeEscapes(literal) : literal
  if (positional) return ctx.flags['message-escapes'] ? decodeEscapes(positional) : positional
  throw usage('send text requires --message or --message-file')
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  return Buffer.concat(chunks).toString('utf8')
}

function decodeEscapes(value: string): string {
  return value.replaceAll(/\\([nrt\\"])/g, (_, escaped: string) => {
    if (escaped === 'n') return '\n'
    if (escaped === 'r') return '\r'
    if (escaped === 't') return '\t'
    return escaped
  })
}

async function sendPresence(ctx: CommandContext): Promise<unknown> {
  const fixedState = ctx.commandPath[0] === 'presence' ? ctx.commandPath[1] : undefined
  const state = (fixedState ?? stringFlag(ctx.flags, 'state') ?? 'typing') as 'typing' | 'paused'
  const duration = ctx.flags.duration === undefined ? undefined : numberFlag(ctx.flags, 'duration', 0)
  if (duration !== undefined && duration <= 0) throw usage('--duration must be a positive integer')
  if (duration !== undefined && state !== 'typing') throw usage('--duration only applies when --state is typing')
  const to = sendDestination(ctx)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'send.presence', request: { chat: to, durationSeconds: duration, pick: ctx.flags.pick, state } }

  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'to')
  const post = (nextState: 'typing' | 'paused') =>
    client.post(`/v1/chats/${encodeURIComponent(chatID)}/typing`, { body: { state: nextState } })
  await post(state)
  if (duration !== undefined) {
    await sleep(duration * 1000)
    await post('paused')
    return { chatID, durationSeconds: duration, sent: true, state: 'paused' }
  }
  return { chatID, sent: true, state }
}

async function chatIDFromFlag(client: any, ctx: CommandContext, name: 'chat' | 'to'): Promise<string> {
  return resolveChatID(client, requiredStringFlag(ctx.flags, name), chatResolutionOptions(ctx))
}

function chatResolutionOptions(ctx: CommandContext, accountIDs?: string[]): { accountIDs?: string[]; noInput?: boolean; pick?: number } {
  return { accountIDs, noInput: ctx.globalFlags.noInput, pick: numberFlag(ctx.flags, 'pick', 0) || undefined }
}

async function defaultAccountID(client: any): Promise<string> {
  const accountIDs = await listAccountIDs(client)
  if (accountIDs.includes('matrix')) return 'matrix'
  if (accountIDs.length === 1 && accountIDs[0]) return accountIDs[0]
  throw usage('Use --account to choose which account should start the chat.')
}

function parseDurationMs(value?: string): number | undefined {
  if (!value) return undefined
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/i)
  if (!match) throw usage(`Invalid duration "${value}". Use values like 500ms, 30s, or 2m.`)
  const amount = Number(match[1])
  const unit = (match[2] ?? 'ms').toLowerCase()
  if (unit === 'ms') return amount
  if (unit === 's') return amount * 1000
  if (unit === 'm') return amount * 60_000
  return amount
}

async function waitForTunnelExit(started: StartedTunnel): Promise<{ code: number | null; reason: 'process' | 'signal' }> {
  return new Promise(resolve => {
    const finish = () => {
      started.stop()
      resolve({ code: 0, reason: 'signal' })
    }
    process.once('SIGINT', finish)
    process.once('SIGTERM', finish)
    started.done.then(({ code }) => {
      process.off('SIGINT', finish)
      process.off('SIGTERM', finish)
      resolve({ code, reason: 'process' })
    })
  })
}

function writeWatchEvent(body: string, raw: boolean): void {
  if (raw) {
    process.stdout.write(`${body}\n`)
    return
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    process.stdout.write([
      String(parsed.type ?? 'event'),
      parsed.chatID ? `chat=${parsed.chatID}` : undefined,
      parsed.messageID ? `message=${parsed.messageID}` : undefined,
      String(parsed.timestamp ?? new Date().toISOString()),
    ].filter(Boolean).join('\t') + '\n')
  } catch {
    process.stdout.write(`raw\t${new Date().toISOString()}\n`)
  }
}

function passesFilter(body: string, filter?: EventFilter): boolean {
  if (!filter || (!filter.include && !filter.exclude)) return true
  let type: string | undefined
  try {
    const parsed = JSON.parse(body) as { type?: unknown }
    if (typeof parsed.type === 'string') type = parsed.type
  } catch {
    return true
  }
  if (!type) return true
  if (filter.include && !filter.include.has(type)) return false
  if (filter.exclude && filter.exclude.has(type)) return false
  return true
}

function forwardWebhook(webhook: WebhookConfig, body: string, events: boolean): void {
  if (webhook.inflight + webhook.queue.length >= webhook.max) {
    if (events) writeEvent('watch.webhook_drop', { reason: 'queue_full', size: webhook.queue.length })
    process.stderr.write(`warning: webhook queue full (${webhook.max}); dropped event\n`)
    return
  }
  webhook.queue.push({ body, secret: webhook.secret })
  void drainWebhook(webhook, events)
}

async function drainWebhook(webhook: WebhookConfig, events: boolean): Promise<void> {
  while (webhook.queue.length > 0) {
    const item = webhook.queue.shift()!
    webhook.inflight += 1
    try {
      const headers = webhookHeaders(item.body, item.secret)
      const response = await fetch(webhook.url, { body: item.body, headers, method: 'POST', signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        if (events) writeEvent('watch.webhook_error', { status: response.status })
        process.stderr.write(`warning: webhook POST ${webhook.url} returned ${response.status}\n`)
      }
    } catch (error) {
      if (events) writeEvent('watch.webhook_error', { message: (error as Error).message })
      process.stderr.write(`warning: webhook POST failed: ${(error as Error).message}\n`)
    } finally {
      webhook.inflight -= 1
    }
  }
}

export function webhookHeaders(body: string, secret?: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (!secret) return headers
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  headers['x-beeper-signature'] = signature
  headers['x-wacli-signature'] = signature
  return headers
}

async function chooseBridge(items: Record<string, unknown>[]): Promise<string> {
  const available = items.filter(item => String(item.status ?? 'available') === 'available')
  if (!available.length) throw usage('No available bridges to connect.')
  output.write('Choose a bridge to connect an account:\n')
  available.forEach((item, index) => {
    const id = String(item.id)
    const name = String(item.displayName ?? item.name ?? id)
    const multiple = item.supportsMultipleAccounts ? 'multiple allowed' : 'single account'
    output.write(`  ${index + 1}. ${name} (${id}) - ${multiple}\n`)
  })
  return promptChoice('Select a bridge: ', available.map(item => String(item.id)), { output })
}

function printAvailableBridges(items: Record<string, unknown>[]): void {
  const sections: Array<[string, Record<string, unknown>[]]> = [
    ['On-Device Accounts', items.filter(item => item.provider === 'local')],
    ['Beeper Cloud Accounts', items.filter(item => item.provider === 'cloud')],
    ['Self-Hosted Accounts', items.filter(item => item.provider === 'self-hosted')],
  ]
  output.write('Choose a bridge to connect an account:\n\n')
  for (const [title, bridges] of sections) {
    if (!bridges.length) continue
    output.write(`${title}\n`)
    for (const bridge of bridges) {
      const id = String(bridge.id)
      const name = String(bridge.displayName ?? bridge.name ?? id)
      const state = String(bridge.status ?? 'available')
      const status = bridge.statusText ?? (state === 'available' ? undefined : state === 'connected' ? `${name} Connected` : state.replaceAll('_', ' '))
      const multiple = bridge.supportsMultipleAccounts ? 'multiple allowed' : 'single account'
      output.write(`  ${name} (${id}) - ${multiple}${status ? ` - ${String(status)}` : ''}\n`)
      if (String(bridge.status ?? 'available') === 'available') output.write(`    beeper accounts add ${id}\n`)
    }
    output.write('\n')
  }
}

function printBridgeServicesMarkdown(services: Record<string, unknown>[]): void {
  output.write('| Bridge ID | Name | Provider | Service | Status | Multiple Accounts |\n')
  output.write('| --- | --- | --- | --- | --- | --- |\n')
  for (const service of services) {
    output.write(`| ${markdownTableCell(service.bridge_id)} | ${markdownTableCell(service.name)} | ${markdownTableCell(service.provider)} | ${markdownTableCell(service.service)} | ${markdownTableCell(service.status)} | ${markdownTableCell(service.supports_multiple_accounts === undefined ? '' : service.supports_multiple_accounts ? 'yes' : 'no')} |\n`)
  }
}

function markdownTableCell(value: unknown): string {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\r\n', '<br>')
    .replaceAll('\n', '<br>')
}

function resolveBridgeChoice(items: Record<string, unknown>[], input: string): Record<string, unknown> {
  const keys = (item: Record<string, unknown>) => [item.id, item.displayName, item.name, item.network, item.provider, item.type]
  const normalized = normalizeSelector(input)
  const exact = items.filter(item => keys(item).some(value => normalizeSelector(value) === normalized))
  if (exact.length === 1) return exact[0]!
  if (exact.length > 1) throw ambiguousBridge(input, exact)
  const partial = items.filter(item => keys(item).some(value => normalizeSelector(value).includes(normalized)))
  if (partial.length === 1) return partial[0]!
  if (partial.length > 1) throw ambiguousBridge(input, partial)
  throw usage(`Unknown bridge "${input}". Run "beeper resolve bridge ${input}" to inspect matches.`)
}

function ambiguousBridge(input: string, matches: Record<string, unknown>[]): Error {
  return usage(`Bridge "${input}" is ambiguous. Use one of: ${matches.map(item => `${String(item.displayName ?? item.name ?? item.id)} (${String(item.id)})`).join(', ')}`)
}

function parseKeyValueFlags(values: string[], flagName: string): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (const value of values) {
    const equalsIndex = value.indexOf('=')
    if (equalsIndex <= 0) throw usage(`${flagName} must use name=value form.`)
    parsed[value.slice(0, equalsIndex)] = value.slice(equalsIndex + 1)
  }
  return parsed
}

async function chooseLoginFlow(flows: Record<string, unknown>[]): Promise<string> {
  output.write('Choose how you want to sign in:\n')
  flows.forEach((flow, index) => {
    const description = flow.description ? ` - ${String(flow.description)}` : ''
    output.write(`  ${index + 1}. ${String(flow.name ?? flow.id)}${description}\n`)
  })
  return promptChoice('Select a sign-in method: ', flows.map(flow => String(flow.id)), { output })
}

function ids(items: Record<string, unknown>[], preferred: string): string[] {
  return items
    .map(item => item[preferred] ?? item.localChatID ?? item.rowID ?? item.id ?? item.chatID ?? item.messageID ?? item.accountID ?? item.userID)
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
}

function accountIDForRow(row: Record<string, unknown>): string {
  return typeof row.accountID === 'string' && row.accountID
    ? row.accountID
    : typeof row.id === 'string' && row.id
      ? row.id
      : ''
}

function resolution(ctx: CommandContext, kind: string, selector: string, candidates: Record<string, unknown>[]): Record<string, unknown> {
  if (!candidates.length) {
    throw new AbortError(`No ${kind} matches "${selector}"`, ExitCodes.NotFound, undefined, 'not_found')
  }
  const pick = numberFlag(ctx.flags, 'pick', 0)
  const selected = pick ? candidates[pick - 1] : candidates.length === 1 ? candidates[0] : undefined
  if (pick && !selected) {
    throw new AbortError(`--pick ${pick} is outside the ${candidates.length} matching ${kind}s`, ExitCodes.NotFound, undefined, 'not_found')
  }
  return {
    candidates: candidates.map((candidate, index) => ({ pick: index + 1, ...candidate })),
    kind,
    selected: selected ? { pick: candidates.indexOf(selected) + 1, ...selected } : null,
    selector,
  }
}

function ignorableLookupError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const shaped = error as Error & { status?: number; statusCode?: number }
  const status = shaped.status ?? shaped.statusCode
  return status === 400 || status === 404 || /\b(400|404)\b|not supported|not found/i.test(error.message)
}

function matchesChatFilters(row: Record<string, unknown>, ctx: CommandContext): boolean {
  const type = stringFlag(ctx.flags, 'type') ?? stringFlag(ctx.flags, 'chat-type')
  if (type && type !== 'any' && row.type !== type) return false
  if (ctx.flags.archived !== undefined && Boolean(row.isArchived) !== ctx.flags.archived) return false
  if (ctx.flags.pinned !== undefined && Boolean(row.isPinned) !== ctx.flags.pinned) return false
  if (ctx.flags.muted !== undefined && Boolean(row.isMuted) !== ctx.flags.muted) return false
  if (ctx.flags['low-priority'] !== undefined && Boolean(row.isLowPriority) !== ctx.flags['low-priority']) return false
  if (ctx.flags.unread !== undefined) {
    const unread = Number(row.unreadCount ?? 0) > 0 || Boolean(row.isMarkedUnread)
    if (unread !== ctx.flags.unread) return false
  }
  return true
}

type MessageListFilter = {
  hasMedia: boolean
  sender?: string
  type?: string
}

async function collectMessages(iterable: AsyncIterable<unknown>, limit: number, filter?: MessageListFilter): Promise<unknown[]> {
  if (!filter || (!filter.sender && !filter.hasMedia && !filter.type)) return collectPage(iterable, limit)
  const items: unknown[] = []
  for await (const item of iterable) {
    if (matchesMessageListFilter(item, filter)) items.push(item)
    if (items.length >= limit) break
  }
  return items
}

function messageListFilter(ctx: CommandContext): MessageListFilter | undefined {
  const sender = messageSenderFilter(ctx)
  const type = stringFlag(ctx.flags, 'type')
  const hasMedia = Boolean(ctx.flags['has-media'])
  return sender || type || hasMedia ? { hasMedia, sender, type } : undefined
}

function messageSenderFilter(ctx: CommandContext): string | undefined {
  const sender = stringFlag(ctx.flags, 'sender')
  const fromMe = Boolean(ctx.flags['from-me'])
  const fromThem = Boolean(ctx.flags['from-them'])
  const count = [Boolean(sender), fromMe, fromThem].filter(Boolean).length
  if (count > 1) throw usage('Use only one of --sender, --from-me, or --from-them')
  if (fromMe) return 'me'
  if (fromThem) return 'others'
  return sender
}

function matchesMessageListFilter(item: unknown, filter: MessageListFilter): boolean {
  if (filter.sender && !matchesSender(item, filter.sender)) return false
  if (filter.hasMedia && !messageHasMedia(item)) return false
  if (filter.type && messageKind(item) !== filter.type) return false
  return true
}

function matchesSender(item: unknown, sender: string): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as { isSender?: boolean; senderID?: string }
  if (sender === 'me') return row.isSender === true
  if (sender === 'others') return row.isSender !== true
  return row.senderID === sender
}

function messageHasMedia(item: unknown): boolean {
  const row = apiRecord(item)
  const attachments = row.attachments ?? row.files ?? row.media
  if (Array.isArray(attachments) && attachments.length > 0) return true
  return Boolean(row.attachment || row.file || row.mediaURL || row.mediaUrl || row.thumbnailURL || row.thumbnailUrl)
}

function messageKind(item: unknown): string {
  const row = apiRecord(item)
  const explicit = stringValue(row.type) ?? stringValue(row.messageType) ?? stringValue(row.kind)
  if (explicit) {
    const normalized = explicit.toLowerCase()
    if (normalized === 'document') return 'document'
    if (normalized === 'file') return 'file'
    if (normalized === 'audio' || normalized === 'voice') return 'audio'
    if (normalized === 'image' || normalized === 'video' || normalized === 'link' || normalized === 'text') return normalized
  }
  const attachment = firstAttachment(row)
  const attachmentType = stringValue(attachment?.type) ?? stringValue(attachment?.mimeType)
  if (attachmentType?.startsWith('image/')) return 'image'
  if (attachmentType?.startsWith('video/')) return 'video'
  if (attachmentType?.startsWith('audio/')) return 'audio'
  if (attachmentType === 'application/pdf' || attachmentType?.startsWith('text/') || attachmentType?.includes('document')) return 'document'
  if (attachmentType) return 'file'
  return messageHasMedia(row) ? 'file' : 'text'
}

function firstAttachment(row: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const key of ['attachments', 'files', 'media']) {
    const value = row[key]
    if (Array.isArray(value) && value[0] && typeof value[0] === 'object') return value[0] as Record<string, unknown>
  }
  for (const key of ['attachment', 'file']) {
    const value = row[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function completionScript(shell: string): string {
  const command = 'beeper'
  if (shell === 'bash') {
    return [
      '#!/usr/bin/env bash',
      '',
      '_beeper_complete() {',
      "  local IFS=$'\\n'",
      '  local completions',
      '  completions=$(beeper __complete --cword "$COMP_CWORD" -- "${COMP_WORDS[@]}")',
      '  COMPREPLY=()',
      '  if [[ -n "$completions" ]]; then',
      '    COMPREPLY=( $completions )',
      '  fi',
      '}',
      '',
      `complete -F _beeper_complete ${command}`,
      '',
    ].join('\n')
  }
  if (shell === 'zsh') {
    return [
      '#compdef beeper',
      '',
      '_beeper() {',
      '  local -a completions',
      '  completions=("${(@f)$(beeper __complete --cword "$((CURRENT - 1))" -- "${words[@]}")}")',
      "  _describe 'values' completions",
      '}',
      '',
      'compdef _beeper beeper',
      '',
    ].join('\n')
  }
  if (shell === 'fish') {
    return [
      'function __beeper_complete',
      '  set -l words (commandline -opc)',
      '  set -l cur (commandline -ct)',
      '',
      '  # Include the current token (partial word being typed) to match bash behavior.',
      '  set words $words $cur',
      '',
      '  # cword points to the last word (the one being completed).',
      '  set -l cword (math (count $words) - 1)',
      '  beeper __complete --cword $cword -- $words',
      'end',
      '',
      `complete -c ${command} -f -a "(__beeper_complete)"`,
      '',
    ].join('\n')
  }
  if (shell === 'powershell' || shell === 'pwsh') {
    return [
      `Register-ArgumentCompleter -CommandName ${command} -ScriptBlock {`,
      '  param($commandName, $wordToComplete, $cursorPosition, $commandAst, $fakeBoundParameter)',
      '  $elements = $commandAst.CommandElements | ForEach-Object { $_.ToString() }',
      '  $cword = $elements.Count - 1',
      '  $completions = beeper __complete --cword $cword -- $elements',
      '  foreach ($completion in $completions) {',
      "    [System.Management.Automation.CompletionResult]::new($completion, $completion, 'ParameterValue', $completion)",
      '  }',
      '}',
      '',
    ].join('\n')
  }
  throw usage('completion shell must be one of: bash, zsh, fish, powershell')
}

function completeWords(words: string[], cword: number, globalFlags: GlobalFlags): string[] {
  const index = normalizeCword(cword, words.length)
  const start = isProgramName(words[0]) ? 1 : 0
  if (index < start) return []
  const current = index < words.length ? words[index] ?? '' : ''
  const consumed = words.slice(start, Math.min(index, words.length))
  if (consumed.includes('--')) return []
  const node = completionNode(consumed, globalFlags)
  if (!node) return []
  const valueSuggestions = previousFlagValueSuggestions(node.flagSpecs, words, index, current)
  if (valueSuggestions) return valueSuggestions
  if (previousFlagNeedsValue(node.flags, words, index)) return []
  const flags = node.flags
  const children = node.children
  const suggestions = current.startsWith('-')
    ? matching([...flags], current)
    : matching([...flags, ...children], current)
  return [...new Set(suggestions)]
}

function completionNode(consumed: string[], globalFlags: GlobalFlags): { children: string[]; command?: CommandSpec; flags: string[]; flagSpecs: FlagSpec[] } | undefined {
  let candidates = commands.filter(command => commandVisible(command, globalFlags))
  let depth = 0
  for (const word of consumed) {
    if (word.startsWith('-')) continue
    const next = candidates.filter(command => commandPathVariants(command).some(path => path[depth] === word))
    if (!next.length) break
    candidates = next
    depth += 1
  }
  const exact = candidates.find(command => commandPathVariants(command).some(path => path.length === depth))
  const children = new Set<string>()
  for (const command of candidates) {
    for (const path of completionChildVariants(command, consumed)) {
      const part = path[depth]
      if (part) children.add(part)
    }
  }
  const flagSpecs = [...(exact?.flags ?? []), ...globalFlagSpecs]
  return {
    children: [...children].sort((a, b) => completionChildPriority(consumed, a) - completionChildPriority(consumed, b) || a.localeCompare(b)),
    command: exact,
    flags: flagTokens(flagSpecs),
    flagSpecs,
  }
}

function completionChildPriority(consumed: string[], child: string): number {
  const parent = consumed.filter(part => !part.startsWith('-')).join(' ')
  const rootOrder = [
    'message',
    'ls',
    'search',
    'open',
    'download',
    'upload',
    'login',
    'logout',
    'status',
    'me',
    'whoami',
    'setup',
    'send',
    'chats',
    'groups',
    'messages',
    'accounts',
    'contacts',
    'presence',
    'media',
    'targets',
    'use',
    'remove',
    'resolve',
    'export',
    'watch',
    'doctor',
    'auth',
    'install',
    'api',
    'config',
    'docs',
    'schema',
    'mcp',
    'agent',
    'exit-codes',
    'completion',
    'help',
    'version',
  ]
  const orders: Record<string, string[]> = {
    '': rootOrder,
    accounts: ['list', 'show', 'add', 'use', 'remove'],
    auth: ['add', 'list', 'email', 'logout', 'status'],
    chats: ['list', 'show', 'start', 'archive', 'unarchive', 'pin', 'unpin', 'mute', 'unmute', 'read', 'mark-read', 'mark-unread', 'rename', 'description', 'avatar', 'priority', 'draft', 'remind', 'disappear', 'focus', 'notify-anyway'],
    config: ['get', 'keys', 'set', 'unset', 'list', 'path'],
    contacts: ['list', 'show'],
    group: ['list', 'show', 'create', 'rename', 'description'],
    groups: ['list', 'show', 'create', 'rename', 'description'],
    media: ['download', 'message'],
    messages: ['list', 'search', 'context', 'show', 'export', 'edit', 'delete', 'revoke'],
    presence: ['typing', 'paused'],
    search: ['all'],
    send: ['text', 'file', 'voice', 'sticker', 'react', 'presence'],
    targets: ['list', 'use', 'add', 'remove', 'logs', 'runtime', 'tunnel'],
    'targets runtime': ['start', 'stop', 'restart'],
  }
  const order = orders[parent] ?? []
  const index = order.indexOf(child)
  return index === -1 ? order.length : index
}

function commandPathVariants(command: CommandSpec): string[][] {
  return [command.path, ...(command.aliases ?? [])]
}

function completionChildVariants(command: CommandSpec, consumed: string[]): string[][] {
  const variants = commandPathVariants(command)
  if (!consumed.length) return variants
  const matching = variants.filter(path => consumed.every((part, index) => path[index] === part))
  return matching.length ? matching : variants.filter(path => path.length > consumed.length)
}

function flagTokens(flags: FlagSpec[]): string[] {
  return flags.flatMap(flag => [
    `--${flag.name}`,
    flag.short ? `-${flag.short}` : undefined,
    ...(flag.aliases ?? []).map(alias => `--${alias}`),
    shouldCompleteNoFlag(flag) ? `--no-${flag.name}` : undefined,
  ]).filter((value): value is string => Boolean(value))
}

function shouldCompleteNoFlag(flag: FlagSpec): boolean {
  return flag.type === 'boolean' && (flag.default === true || Boolean(flag.env?.length))
}

function previousFlagNeedsValue(flags: string[], words: string[], cword: number): boolean {
  const previous = words[cword - 1]
  if (!previous?.startsWith('-') || previous.includes('=')) return false
  const spec = allFlagSpecs().find(flag => flagSpellings(flag).includes(previous))
  return Boolean(spec && spec.type !== 'boolean' && flags.includes(previous))
}

function previousFlagValueSuggestions(flags: FlagSpec[], words: string[], cword: number, current: string): string[] | undefined {
  const previous = words[cword - 1]
  if (!previous?.startsWith('-') || previous.includes('=')) return undefined
  const spec = flags.find(flag => flagSpellings(flag).includes(previous))
  if (!spec || !spec.enum?.length) return undefined
  return matching(spec.enum, current)
}

function allFlagSpecs(): FlagSpec[] {
  return [...globalFlagSpecs, ...commands.flatMap(command => command.flags ?? [])]
}

function flagSpellings(flag: FlagSpec): string[] {
  return [`--${flag.name}`, flag.short ? `-${flag.short}` : undefined, ...(flag.aliases ?? []).map(alias => `--${alias}`)].filter((value): value is string => Boolean(value))
}

function matching(values: string[], prefix: string): string[] {
  return values.filter(value => value.startsWith(prefix))
}

function normalizeCword(cword: number, count: number): number {
  if (cword < 0) return Math.max(0, count - 1)
  return Math.min(cword, count)
}

function isProgramName(word?: string): boolean {
  return !word || word === 'beeper' || word.endsWith('/beeper') || word.endsWith('/dev.js') || word.endsWith('/cli.js')
}

async function packageInfo(): Promise<Record<string, unknown>> {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  return JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
}

function packageInfoSync(): Record<string, unknown> {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>
}

function buildInfo(): string {
  const pkg = packageInfoSync()
  return process.env.BEEPER_BUILD_COMMIT || process.env.BEEPER_BUILD_DATE
    ? [pkg.version, process.env.BEEPER_BUILD_DATE, process.env.BEEPER_BUILD_COMMIT].filter(Boolean).join('-')
    : String(pkg.version ?? '')
}

function beeperConfigRootInfo(): { path: string; source: string } {
  if (process.env.BEEPER_HOME) return { path: process.env.BEEPER_HOME, source: 'BEEPER_HOME' }
  if (process.env.BEEPER_STORE_DIR) return { path: process.env.BEEPER_STORE_DIR, source: 'BEEPER_STORE_DIR' }
  if (process.env.BEEPER_CLI_CONFIG_DIR) return { path: process.env.BEEPER_CLI_CONFIG_DIR, source: 'BEEPER_CLI_CONFIG_DIR' }
  return { path: dirname(configPath()), source: 'default' }
}

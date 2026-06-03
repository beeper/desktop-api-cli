import { createHmac } from 'node:crypto'
import { createReadStream } from 'node:fs'
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
import type { CommandContext, CommandSpec, FlagSpec, GlobalFlags } from './types.js'
import { globalFlagSpecs, numberFlag, requiredStringFlag, stringFlag, stringListFlag } from './parse.js'
import { commandVisible } from './policy.js'
import { buildSchema } from './schema.js'
import { serveMcp } from './mcp.js'
import { usage, writeEvent, writeResult } from './output.js'
import { runSetup } from './setup.js'

type WebhookConfig = { inflight: number; max: number; queue: Array<{ body: string; signature?: string }>; secret?: string; url: string }
type EventFilter = { include?: Set<string>; exclude?: Set<string> }
type AttachmentType = 'sticker' | 'voice-note'
type SendKind = 'file' | 'sticker' | 'text' | 'voice'
type SendPayload = {
  attachmentType?: AttachmentType
  duration?: number
  file?: string
  fileName?: string
  mentions?: string[]
  mimeType?: string
  noPreview?: boolean
  replyTo?: string
  text: string
  wait?: boolean
  waitTimeoutMs?: number
}

const accountFilterFlag: FlagSpec = { name: 'account', short: 'a', aliases: ['acct'], type: 'string', multiple: true, description: 'Limit to account selector' }
const candidateLimitFlag: FlagSpec = { name: 'limit', aliases: ['max'], type: 'integer', default: 10, description: 'Maximum candidates' }
const chatFlag: FlagSpec = { name: 'chat', type: 'string', required: true, description: 'Chat selector' }
const pickCandidateFlag: FlagSpec = { name: 'pick', type: 'integer', description: 'Select the Nth candidate' }
const pickChatFlag: FlagSpec = { name: 'pick', type: 'integer', description: 'Pick the Nth result when selector is ambiguous' }
const configKeys = ['defaultTarget', 'defaultAccount'] as const
type ConfigKey = typeof configKeys[number]

const chatFlags: FlagSpec[] = [
  chatFlag,
  pickChatFlag,
]

const installFlags: FlagSpec[] = [
  { name: 'channel', type: 'string', enum: ['stable', 'nightly'], default: 'stable', description: 'Install release channel' },
  { name: 'server-env', type: 'string', enum: ['local', 'dev', 'staging', 'prod'], default: 'prod', description: 'Server environment' },
]

const sendChatFlags: FlagSpec[] = [
  { name: 'to', type: 'string', required: true, description: 'Chat selector' },
  pickChatFlag,
]

const sendDeliveryFlags: FlagSpec[] = [
  ...sendChatFlags,
  { name: 'reply-to', type: 'string', description: 'Send as a reply to this message ID' },
  { name: 'wait', type: 'boolean', default: false, description: 'Wait until the message leaves pending state' },
  { name: 'wait-timeout', type: 'integer', default: 30_000, description: 'Maximum wait time in ms when --wait is set' },
]

export const commands: CommandSpec[] = [
  {
    description: 'Print CLI version',
    mcp: true,
    output: 'diagnostic',
    path: ['version'],
    risk: 'read',
    run: version,
  },
  {
    args: [{ name: 'target', description: 'Target name. Defaults to the selected target.' }],
    aliases: [['st']],
    description: 'Show selected target and setup readiness',
    mcp: true,
    output: 'status',
    path: ['status'],
    risk: 'read',
    run: status,
  },
  {
    description: 'Run diagnostics for config, target reachability, auth, and readiness',
    mcp: true,
    output: 'diagnostic',
    path: ['doctor'],
    risk: 'read',
    run: doctor,
  },
  {
    aliases: [['agent', 'exit-codes'], ['exitcodes']],
    description: 'Print stable exit codes for automation',
    mcp: true,
    output: 'diagnostic',
    path: ['exit-codes'],
    risk: 'read',
    run: exitCodes,
  },
  {
    args: [{ name: 'command', variadic: true }],
    aliases: [['help-json'], ['helpjson']],
    description: 'Print machine-readable command and flag schema',
    mcp: true,
    path: ['schema'],
    risk: 'read',
    run: schema,
  },
  {
    description: 'Run a typed MCP stdio server',
    flags: [
      { name: 'allow-tool', aliases: ['tool'], type: 'string', multiple: true, description: 'Tool or command allowlist' },
      { name: 'allow-write', type: 'boolean', default: false, description: 'Allow write-risk MCP tools' },
      { name: 'list-tools', type: 'boolean', default: false, description: 'Print enabled MCP tools as JSON and exit' },
      { name: 'max-output-bytes', type: 'integer', default: 102400, description: 'Maximum stdout/stderr bytes captured per tool call' },
      { name: 'timeout-seconds', type: 'integer', default: 60, description: 'Per-tool subprocess timeout' },
    ],
    path: ['mcp'],
    risk: 'read',
    run: mcp,
  },
  {
    args: [{ name: 'shell', required: true, description: 'bash, zsh, fish, or powershell' }],
    description: 'Generate shell completion scripts',
    hidden: false,
    path: ['completion'],
    risk: 'read',
    run: completion,
  },
  {
    aliases: [['config', 'show']],
    args: [{ name: 'key', required: true, description: 'Config key to get' }],
    description: 'Get a config value',
    mcp: true,
    output: 'diagnostic',
    path: ['config', 'get'],
    risk: 'read',
    run: configGet,
  },
  {
    aliases: [['config', 'list-keys'], ['config', 'names']],
    description: 'List available config keys',
    mcp: true,
    path: ['config', 'keys'],
    risk: 'read',
    run: configKeysCommand,
  },
  {
    aliases: [['config', 'ls'], ['config', 'all']],
    description: 'List all config values',
    mcp: true,
    output: 'diagnostic',
    path: ['config', 'list'],
    risk: 'read',
    run: configList,
  },
  {
    aliases: [['config', 'where']],
    description: 'Print config file path',
    mcp: true,
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
    flags: [
      { name: 'local', type: 'boolean', default: false, description: 'Use the local Beeper Desktop session on this device' },
      { name: 'oauth', type: 'boolean', default: false, description: 'Authorize the target with browser OAuth/PKCE' },
      { name: 'remote', type: 'string', description: 'Connect to a remote Beeper Desktop or Server URL' },
      { name: 'server', type: 'boolean', default: false, description: 'Set up a local Beeper Server target' },
      { name: 'desktop', type: 'boolean', default: false, description: 'Set up a local Beeper Desktop target' },
      { name: 'install', type: 'boolean', default: false, description: 'Allow installing a missing local runtime' },
      ...installFlags,
      { name: 'email', type: 'string', description: 'Sign in with an email address' },
      { name: 'username', type: 'string', description: 'Username to use if setup creates a new account' },
    ],
    path: ['setup'],
    risk: 'write',
    run: runSetup,
  },
  {
    aliases: [['targets', 'ls']],
    description: 'List configured Beeper targets',
    mcp: true,
    output: 'targets',
    path: ['targets', 'list'],
    risk: 'read',
    run: targetsList,
  },
  {
    args: [{ name: 'name', required: true }, { name: 'url', required: true }],
    description: 'Add a remote Beeper Desktop or Server target',
    flags: [{ name: 'default', type: 'boolean', default: false, description: 'Set this target as the default after creation' }],
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
    description: 'Clear stored authentication',
    path: ['auth', 'logout'],
    risk: 'write',
    run: authLogout,
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
    args: [{ name: 'selector', required: true, description: 'Target name' }],
    aliases: [['targets', 'use']],
    description: 'Select the default target',
    path: ['use', 'target'],
    risk: 'write',
    run: useTarget,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    aliases: [['accounts', 'use']],
    description: 'Select the default account',
    path: ['use', 'account'],
    risk: 'write',
    run: useAccount,
  },
  {
    args: [{ name: 'bridge' }],
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
    path: ['accounts', 'add'],
    risk: 'write',
    run: accountsAdd,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Target name' }],
    aliases: [['targets', 'remove'], ['targets', 'rm']],
    description: 'Remove a target',
    path: ['remove', 'target'],
    risk: 'destructive',
    run: removeTargetCommand,
  },
  {
    args: [{ name: 'selector', required: true, description: 'Account selector' }],
    aliases: [['accounts', 'remove'], ['accounts', 'rm']],
    description: 'Remove an account',
    path: ['remove', 'account'],
    risk: 'destructive',
    run: removeAccount,
  },
  {
    aliases: [['contacts', 'search'], ['contacts', 'find']],
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
    aliases: [['chats', 'ls']],
    description: 'List chats',
    flags: [
      accountFilterFlag,
      { name: 'archived', type: 'boolean', description: 'Only archived chats; use --no-archived to exclude' },
      { name: 'ids', type: 'boolean', default: false, description: 'Print preferred chat selectors' },
      { name: 'limit', type: 'integer', default: 20, description: 'Maximum chats to print' },
      { name: 'low-priority', type: 'boolean', description: 'Only low-priority chats; use --no-low-priority to exclude' },
      { name: 'muted', type: 'boolean', description: 'Only muted chats; use --no-muted to exclude' },
      { name: 'pinned', type: 'boolean', description: 'Only pinned chats; use --no-pinned to exclude' },
      { name: 'query', type: 'string', description: 'Optional chat lookup query' },
      { name: 'unread', type: 'boolean', description: 'Only unread chats; use --no-unread to exclude' },
    ],
    mcp: true,
    output: 'chats',
    path: ['chats', 'list'],
    risk: 'read',
    run: chatsList,
  },
  {
    description: 'Show chat details',
    flags: [
      chatFlag,
      { name: 'max-participants', type: 'integer', description: 'Limit participants returned in chat details' },
      pickChatFlag,
    ],
    mcp: true,
    path: ['chats', 'show'],
    risk: 'read',
    run: chatsShow,
  },
  {
    args: [{ name: 'user', required: true }],
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
    description: 'Archive or unarchive a chat',
    flags: [...chatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unarchive the chat' }],
    path: ['chats', 'archive'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    description: 'Pin or unpin a chat',
    flags: [...chatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unpin the chat' }],
    path: ['chats', 'pin'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    description: 'Mute or unmute a chat',
    flags: [...chatFlags, { name: 'clear', type: 'boolean', default: false, description: 'Unmute the chat' }],
    path: ['chats', 'mute'],
    risk: 'write',
    run: chatsSetFlag,
  },
  {
    description: 'Rename a chat',
    flags: [...chatFlags, { name: 'title', type: 'string', required: true, description: 'Chat title' }],
    path: ['chats', 'rename'],
    risk: 'write',
    run: chatsRename,
  },
  {
    description: 'Set or clear a chat description',
    flags: [
      ...chatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear or unset the chosen state' },
      { name: 'description', type: 'string', description: 'Chat description' },
    ],
    path: ['chats', 'description'],
    risk: 'write',
    run: chatsDescription,
  },
  {
    description: 'Set or clear a chat avatar',
    flags: [
      ...chatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the avatar' },
      { name: 'file', type: 'string', description: 'Avatar image file path' },
    ],
    path: ['chats', 'avatar'],
    risk: 'write',
    run: chatsAvatar,
  },
  {
    description: 'Set chat priority',
    flags: [...chatFlags, { name: 'level', type: 'string', required: true, enum: ['inbox', 'low'], description: 'Chat priority level' }],
    path: ['chats', 'priority'],
    risk: 'write',
    run: chatsPriority,
  },
  {
    description: 'Mark a chat read or unread',
    flags: [
      ...chatFlags,
      { name: 'message', type: 'string', description: 'Read marker message ID' },
      { name: 'unread', type: 'boolean', default: false, description: 'Mark the chat unread' },
    ],
    path: ['chats', 'read'],
    risk: 'write',
    run: chatsRead,
  },
  {
    description: 'Set or clear a chat draft',
    flags: [
      ...chatFlags,
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
    description: 'Set or clear a chat reminder',
    flags: [
      ...chatFlags,
      { name: 'clear', type: 'boolean', default: false, description: 'Clear the reminder' },
      { name: 'dismiss-on-message', type: 'boolean', default: false, description: 'Dismiss reminder when a new message arrives' },
      { name: 'when', type: 'string', description: 'ISO reminder timestamp' },
    ],
    path: ['chats', 'remind'],
    risk: 'write',
    run: chatsRemind,
  },
  {
    description: 'Set a disappearing-message timer',
    flags: [
      ...chatFlags,
      { name: 'seconds', type: 'string', description: 'Disappearing-message timer in seconds, or off' },
    ],
    path: ['chats', 'disappear'],
    risk: 'write',
    run: chatsDisappear,
  },
  {
    description: 'Focus a chat in Beeper',
    flags: [
      ...chatFlags,
      { name: 'file', type: 'string', description: 'Draft attachment file path' },
      { name: 'message', type: 'string', description: 'Message ID to focus' },
      { name: 'text', type: 'string', description: 'Draft text' },
    ],
    path: ['chats', 'focus'],
    risk: 'write',
    run: chatsFocus,
  },
  {
    description: 'Notify a chat anyway',
    flags: chatFlags,
    path: ['chats', 'notify-anyway'],
    risk: 'write',
    run: chatsNotifyAnyway,
  },
  {
    args: [{ name: 'selector', required: true }],
    description: 'Resolve an account selector',
    flags: [pickCandidateFlag],
    mcp: true,
    path: ['resolve', 'account'],
    risk: 'read',
    run: resolveAccount,
  },
  {
    args: [{ name: 'selector', required: true }],
    description: 'Resolve a bridge selector',
    flags: [pickCandidateFlag],
    mcp: true,
    path: ['resolve', 'bridge'],
    risk: 'read',
    run: resolveBridge,
  },
  {
    args: [{ name: 'selector', required: true }],
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
    args: [{ name: 'selector', required: true }],
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
    args: [{ name: 'selector', required: true }],
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
    flags: [
      { name: 'after-cursor', type: 'string', description: 'Paginate messages newer than this message ID' },
      { name: 'asc', type: 'boolean', default: false, description: 'Order oldest first' },
      { name: 'before-cursor', type: 'string', description: 'Paginate messages older than this message ID' },
      chatFlag,
      { name: 'ids', type: 'boolean', default: false, description: 'Print only message IDs' },
      { name: 'limit', type: 'integer', default: 50, description: 'Maximum messages to print' },
      pickChatFlag,
      { name: 'sender', type: 'string', description: 'me, others, or a specific user ID' },
    ],
    mcp: true,
    output: 'messages',
    path: ['messages', 'list'],
    risk: 'read',
    run: messagesList,
  },
  {
    description: 'Show a message with surrounding context',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', required: true, description: 'Message ID' },
      { name: 'after', type: 'integer', default: 10, description: 'Messages after target' },
      { name: 'before', type: 'integer', default: 10, description: 'Messages before target' },
    ],
    mcp: true,
    path: ['messages', 'context'],
    risk: 'read',
    run: messagesContext,
  },
  {
    description: 'Edit a message',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', required: true, description: 'Message ID' },
      { name: 'message', type: 'string', required: true, description: 'New message text' },
    ],
    path: ['messages', 'edit'],
    risk: 'write',
    run: messagesEdit,
  },
  {
    description: 'Delete a message',
    flags: [
      chatFlag,
      pickChatFlag,
      { name: 'id', type: 'string', required: true, description: 'Message ID' },
      { name: 'for-everyone', type: 'boolean', default: false, description: 'Delete for everyone when supported' },
    ],
    path: ['messages', 'delete'],
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
      { name: 'webhook-queue', type: 'integer', default: 64, description: 'Maximum pending webhook deliveries' },
      { name: 'webhook-secret', type: 'string', description: 'HMAC-SHA256 secret for X-Beeper-Signature' },
    ],
    path: ['watch'],
    risk: 'read',
    run: watch,
  },
  {
    args: [{ name: 'url', required: true }],
    description: 'Download message media',
    flags: [{ name: 'out', type: 'string', default: '.', description: 'Output directory; - streams to stdout' }],
    path: ['media', 'download'],
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
    args: [{ name: 'query' }],
    aliases: [['messages', 'find']],
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
      { name: 'sender', type: 'string', description: 'me, others, or a user ID' },
      { name: 'fail-empty', aliases: ['non-empty', 'require-results'], type: 'boolean', default: false, description: 'Exit with code 3 if no results' },
    ],
    mcp: true,
    output: 'messages',
    path: ['messages', 'search'],
    risk: 'read',
    run: messagesSearch,
  },
  {
    args: [{ name: 'method', required: true }, { name: 'path', required: true }],
    description: 'Call a raw Desktop API path with any supported HTTP method',
    flags: [
      { name: 'body', type: 'string', description: 'JSON request body' },
      { name: 'no-auth', type: 'boolean', default: false, description: 'Call a public API path without a bearer token' },
    ],
    mcp: true,
    path: ['api', 'request'],
    risk: 'write',
    run: apiCommand,
  },
  {
    description: 'Send a text message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'message', type: 'string', description: 'Message text to send' },
      { name: 'message-escapes', type: 'boolean', default: false, description: 'Interpret backslash escapes in --message' },
      { name: 'message-file', type: 'string', description: "Read message text from a file path; '-' reads stdin" },
      { name: 'mention', type: 'string', multiple: true, description: 'User ID to mention' },
      { name: 'no-preview', type: 'boolean', default: false, description: 'Disable automatic link preview' },
    ],
    path: ['send', 'text'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    description: 'Send a file message',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', required: true, description: 'Local file path to upload' },
      { name: 'caption', type: 'string', description: 'Optional caption for file messages' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
    ],
    path: ['send', 'file'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    description: 'Send a sticker',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', required: true, description: 'Local sticker file path to upload' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
    ],
    path: ['send', 'sticker'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    description: 'Send a voice note',
    flags: [
      ...sendDeliveryFlags,
      { name: 'file', type: 'string', required: true, description: 'Local voice note file path to upload' },
      { name: 'duration', type: 'integer', description: 'Duration in seconds' },
      { name: 'filename', type: 'string', description: 'Override displayed filename' },
      { name: 'mime', type: 'string', description: 'Override MIME type' },
    ],
    path: ['send', 'voice'],
    risk: 'write',
    run: sendTextLike,
  },
  {
    description: 'Send or remove a reaction',
    flags: [
      ...sendChatFlags,
      { name: 'id', type: 'string', required: true, description: 'Message ID to react to' },
      { name: 'reaction', type: 'string', required: true, description: 'Reaction key' },
      { name: 'remove', type: 'boolean', default: false, description: 'Remove the reaction' },
      { name: 'transaction', type: 'string', description: 'Optional transaction ID for deduplication' },
    ],
    path: ['send', 'react'],
    risk: 'write',
    run: sendReact,
  },
  {
    description: 'Send a typing indicator',
    flags: [
      ...sendChatFlags,
      { name: 'duration', type: 'integer', description: 'Seconds to keep typing before sending paused' },
      { name: 'state', type: 'string', enum: ['typing', 'paused'], default: 'typing', description: 'Presence indicator to send' },
    ],
    path: ['send', 'presence'],
    risk: 'write',
    run: sendPresence,
  },
  {
    args: [{ name: 'name' }],
    description: 'Start a local target runtime',
    path: ['targets', 'runtime', 'start'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name' }],
    description: 'Stop a local server runtime',
    path: ['targets', 'runtime', 'stop'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name' }],
    description: 'Restart a local server runtime',
    path: ['targets', 'runtime', 'restart'],
    risk: 'write',
    run: targetsRuntime,
  },
  {
    args: [{ name: 'name' }],
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
  if (globalFlags && !commandVisible(command, globalFlags)) return help(globalFlags)
  const path = command.path.join(' ')
  const usageAliases = (command.aliases ?? []).map(alias => alias.join(' ')).join(', ')
  const lines = [`Usage: beeper ${path}${command.args?.length ? ` ${command.args.map(arg => arg.variadic ? `<${arg.name}> ...` : arg.required ? `<${arg.name}>` : `[${arg.name}]`).join(' ')}` : ''} [flags]`, '', command.description]
  if (usageAliases) lines.push('', `Aliases: ${usageAliases}`)
  const args = command.args ?? []
  const flags = command.flags ?? []
  if (args.length) {
    lines.push('', 'Arguments:')
    for (const arg of args) lines.push(`  ${arg.name}${arg.required ? '' : '?'}${arg.variadic ? '...' : ''}\t${arg.description ?? ''}`)
  }
  if (flags.length) {
    lines.push('', 'Flags:')
    for (const flag of flags) lines.push(`  ${formatFlag(flag)}\t${flag.description ?? ''}`)
  }
  if (command.examples?.length) {
    lines.push('', 'Examples:', ...command.examples.map(example => `  ${example}`))
  }
  lines.push('', 'Global flags:')
  for (const flag of globalFlagSpecs) lines.push(`  ${formatFlag(flag)}\t${flag.description ?? ''}`)
  return `${lines.join('\n')}\n`
}

export function help(globalFlags?: GlobalFlags): string {
  const visible = commands.filter(command => globalFlags ? commandVisible(command, globalFlags) : !command.hidden)
  const width = Math.max(...visible.map(command => command.path.join(' ').length)) + 2
  const lines = [
    'Usage: beeper <command> [flags]',
    '',
    'Beeper CLI for Beeper Desktop and Beeper Server. Built for terminals, scripts, CI, and agents.',
    '',
    'Config:',
    '',
    `    file: ${configPath()}`,
    '',
    'Commands:',
  ]
  for (const command of [...visible].sort((a, b) => a.path.join(' ').localeCompare(b.path.join(' ')))) {
    const aliases = command.aliases?.length ? ` (${command.aliases.map(alias => alias.join(' ')).join(', ')})` : ''
    lines.push(`  ${command.path.join(' ').padEnd(width)}${command.description}${aliases}`)
  }
  lines.push('', 'Global flags:')
  for (const flag of globalFlagSpecs) lines.push(`  ${formatFlag(flag)}\t${flag.description ?? ''}`)
  lines.push('', 'Run "beeper <command> --help" for more information on a command.')
  return `${lines.join('\n')}\n`
}

function formatFlag(flag: FlagSpec): string {
  const long = `--${flag.name}${flag.type === 'boolean' ? '' : `=${flag.placeholder ?? 'STRING'}`}`
  const prefix = flag.short ? `-${flag.short}, ${long}` : `    ${long}`
  const aliases = flag.aliases?.length ? ` (${flag.aliases.map(alias => `--${alias}`).join(', ')})` : ''
  const env = flag.env?.length ? ` (${flag.env.map(name => `$${name}`).join(',')})` : ''
  return `${prefix}${aliases}${env}`
}

async function version(): Promise<Record<string, unknown>> {
  const pkg = await packageInfo()
  return { name: pkg.name, version: pkg.version }
}

async function status(ctx: CommandContext): Promise<Record<string, unknown>> {
  const target = await resolveTarget({ target: ctx.args[0] ?? ctx.globalFlags.target })
  return {
    auth: {
      authenticated: Boolean(process.env.BEEPER_ACCESS_TOKEN || target.auth?.accessToken),
      clientID: target.auth?.clientID,
      expiresAt: target.auth?.expiresAt,
      scope: target.auth?.scope,
      source: process.env.BEEPER_ACCESS_TOKEN ? 'env' : target.auth?.source ?? (target.auth?.accessToken ? 'target' : 'none'),
    },
    live: await targetLiveStatus(target),
    readiness: await evaluateReadiness({ baseURL: target.baseURL, target: target.id }),
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

async function schema(ctx: CommandContext): Promise<Record<string, unknown>> {
  const pkg = await packageInfo()
  return buildSchema(commands, String(pkg.version ?? '0'), ctx.args, ctx.globalFlags)
}

async function mcp(ctx: CommandContext): Promise<void> {
  const pkg = await packageInfo()
  await serveMcp(commands, ctx.globalFlags, {
    allowTools: stringListFlag(ctx.flags, 'allow-tool'),
    allowWrite: Boolean(ctx.flags['allow-write']),
    listTools: Boolean(ctx.flags['list-tools']),
    maxOutputBytes: numberFlag(ctx.flags, 'max-output-bytes', 102400),
    timeoutSeconds: numberFlag(ctx.flags, 'timeout-seconds', 60),
  }, String(pkg.version ?? '0'))
}

async function completion(ctx: CommandContext): Promise<void> {
  const shell = ctx.args[0]
  if (!shell) throw usage('completion requires shell')
  process.stdout.write(completionScript(shell))
}

async function configGet(ctx: CommandContext): Promise<Record<string, unknown>> {
  const key = parseConfigKey(ctx.args[0])
  const config = await readConfig()
  return { key, value: config[key] ?? null }
}

async function configKeysCommand(): Promise<string[]> {
  return [...configKeys]
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
  for (const item of completeWords(words, cword)) process.stdout.write(`${item}\n`)
}

async function targetsList(): Promise<unknown[]> {
  const config = await readConfig()
  const targets = await listTargets()
  const rows = targets.length ? targets : [await resolveTarget({ target: builtInDesktopTargetID })]
  return Promise.all(rows.map(async target => ({
    baseURL: target.baseURL,
    default: config.defaultTarget ? config.defaultTarget === target.id : target.id === builtInDesktopTargetID,
    id: target.id,
    localProfile: Boolean(target.dataDir),
    name: target.name ?? target.id,
    type: target.type,
    ...await targetLiveStatus(target),
  })))
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
    .filter(row => !selected?.length || selected.includes(String(row.accountID ?? row.id)))
    .map(row => ({ ...row, default: (row.accountID ?? row.id) === config.defaultAccount || undefined }))
  return ctx.flags.ids ? ids(items, 'accountID') : items
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
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true }) ?? await listAccountIDs(client)
  const limit = numberFlag(ctx.flags, 'limit', 50)
  const query = stringFlag(ctx.flags, 'query')
  const items: Array<Record<string, unknown>> = []
  for (const accountID of accountIDs) {
    const remaining = limit - items.length
    if (remaining <= 0) break
    const contacts = await collectPage(client.accounts.contacts.list(accountID, { query }), remaining)
    items.push(...contacts.map(item => ({ ...apiRecord(item), accountID })))
  }
  return ctx.flags.ids ? ids(items, 'userID') : items
}

async function chatsList(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true })
  const query = stringFlag(ctx.flags, 'query')
  if (query) {
    const items = (await collectPage(client.chats.search({ accountIDs, query }), numberFlag(ctx.flags, 'limit', 20)))
      .map(apiRecord)
      .filter(row => matchesChatFilters(row, ctx))
    return ctx.flags.ids ? ids(items, 'localChatID') : items
  }
  const items: Record<string, unknown>[] = []
  for await (const item of client.chats.list({ accountIDs })) {
    const row = apiRecord(item)
    if (matchesChatFilters(row, ctx)) items.push(row)
    if (items.length >= numberFlag(ctx.flags, 'limit', 20)) break
  }
  return ctx.flags.ids ? ids(items, 'localChatID') : items
}

async function chatsShow(ctx: CommandContext): Promise<unknown> {
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, stringFlag(ctx.flags, 'chat')!, chatResolutionOptions(ctx))
  return client.chats.retrieve(chatID, { maxParticipantCount: numberFlag(ctx.flags, 'max-participants', 0) || undefined })
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

async function chatsUpdate(ctx: CommandContext, op: string, update: Record<string, unknown>): Promise<unknown> {
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `chats.${op}`, request: { chat: stringFlag(ctx.flags, 'chat'), pick: ctx.flags.pick, ...update } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return client.chats.update(chatID, update)
}

async function chatsSetFlag(ctx: CommandContext): Promise<unknown> {
  const action = ctx.commandPath[1] ?? ''
  const field = ({ archive: 'isArchived', mute: 'isMuted', pin: 'isPinned' } as const)[action]
  if (!field) throw usage(`Unsupported chat command: ${ctx.commandPath.join(' ')}`)
  return chatsUpdate(ctx, action, { [field]: !ctx.flags.clear })
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
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.priority', request: { chat: stringFlag(ctx.flags, 'chat'), level, pick: ctx.flags.pick, update } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return client.chats.update(chatID, update)
}

async function chatsRead(ctx: CommandContext): Promise<unknown> {
  const messageID = stringFlag(ctx.flags, 'message')
  const read = !ctx.flags.unread
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.read', request: { chat: stringFlag(ctx.flags, 'chat'), messageID, pick: ctx.flags.pick, read } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return read ? client.chats.markRead(chatID, { messageID }) : client.chats.markUnread(chatID, { messageID })
}

async function chatsDraft(ctx: CommandContext): Promise<unknown> {
  const clear = Boolean(ctx.flags.clear)
  if (!clear && ctx.flags.text === undefined) throw usage('Provide --text TEXT, optionally with --file PATH, or --clear.')
  if (clear && (ctx.flags.text !== undefined || ctx.flags.file)) throw usage('--clear cannot be combined with --text or --file.')
  if (clear) {
    if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.draft', request: { chat: stringFlag(ctx.flags, 'chat'), draft: null, pick: ctx.flags.pick } }
    const client = await apiClient(ctx)
    const chatID = await chatIDFromFlag(client, ctx, 'chat')
    return client.chats.update(chatID, { draft: null })
  }
  const draft = { file: stringFlag(ctx.flags, 'file'), fileName: stringFlag(ctx.flags, 'filename'), mimeType: stringFlag(ctx.flags, 'mime'), text: stringFlag(ctx.flags, 'text') }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.draft', request: { chat: stringFlag(ctx.flags, 'chat'), draft, pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  const upload = draft.file ? await client.assets.upload({ file: createReadStream(draft.file), fileName: draft.fileName, mimeType: draft.mimeType }) : undefined
  return client.chats.update(chatID, { draft: { text: draft.text, attachments: upload?.uploadID ? { [upload.uploadID]: upload } : undefined } })
}

async function chatsRemind(ctx: CommandContext): Promise<unknown> {
  if (ctx.flags.clear) {
    if (ctx.flags.when || ctx.flags['dismiss-on-message']) throw usage('--clear cannot be combined with --when or --dismiss-on-message')
    if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.remind', request: { chat: stringFlag(ctx.flags, 'chat'), pick: ctx.flags.pick, reminder: null } }
    const client = await apiClient(ctx)
    const chatID = await chatIDFromFlag(client, ctx, 'chat')
    await client.chats.reminders.delete(chatID)
    return { chatID, reminderCleared: true }
  }
  const when = requiredStringFlag(ctx.flags, 'when')
  const reminder = { dismissOnIncomingMessage: Boolean(ctx.flags['dismiss-on-message']) || undefined, remindAt: when }
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.remind', request: { chat: stringFlag(ctx.flags, 'chat'), pick: ctx.flags.pick, reminder } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  await client.chats.reminders.create(chatID, { reminder })
  return { chatID, remindAt: when, reminderSet: true }
}

async function chatsDisappear(ctx: CommandContext): Promise<unknown> {
  const raw = requiredStringFlag(ctx.flags, 'seconds').toLowerCase()
  const messageExpirySeconds = raw === 'off' ? null : /^\d+$/.test(raw) ? Number(raw) : NaN
  if (messageExpirySeconds !== null && (!Number.isSafeInteger(messageExpirySeconds) || messageExpirySeconds < 0)) throw usage('--seconds must be a positive integer or "off"')
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.disappear', request: { chat: stringFlag(ctx.flags, 'chat'), messageExpirySeconds, pick: ctx.flags.pick } }
  return chatsUpdate(ctx, 'disappear', { messageExpirySeconds })
}

async function chatsFocus(ctx: CommandContext): Promise<unknown> {
  if (ctx.globalFlags.dryRun) {
    return {
      dry_run: true,
      op: 'chats.focus',
      request: {
        chat: stringFlag(ctx.flags, 'chat'),
        draftAttachmentPath: stringFlag(ctx.flags, 'file'),
        draftText: stringFlag(ctx.flags, 'text'),
        messageID: stringFlag(ctx.flags, 'message'),
        pick: ctx.flags.pick,
      },
    }
  }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  const request = {
    chatID,
    draftAttachmentPath: stringFlag(ctx.flags, 'file'),
    draftText: stringFlag(ctx.flags, 'text'),
    messageID: stringFlag(ctx.flags, 'message'),
  }
  return client.focus(request)
}

async function chatsNotifyAnyway(ctx: CommandContext): Promise<unknown> {
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'chats.notify-anyway', request: { chat: stringFlag(ctx.flags, 'chat'), pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return client.chats.notifyAnyway(chatID)
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
  const accountIDs = await resolveAccountIDs(client, stringListFlag(ctx.flags, 'account'), { allowMultiplePerInput: true }) ?? await listAccountIDs(client)
  const candidates: Record<string, unknown>[] = []
  for (const accountID of accountIDs) {
    try {
      const result = await client.accounts.contacts.search(accountID, { query: selector })
      candidates.push(...apiItems(result).slice(0, numberFlag(ctx.flags, 'limit', 10)).map(item => ({ ...item, accountID })))
    } catch (error) {
      if (!ignorableLookupError(error)) throw error
    }
  }
  return resolution(ctx, 'contact', selector, candidates.map(contact => ({
    accountID: contact.accountID,
    displayName: contact.displayName ?? contact.fullName ?? contact.name,
    email: contact.email,
    id: contact.id,
    phoneNumber: contact.phoneNumber,
    username: contact.username,
  })))
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
  const chat = stringFlag(ctx.flags, 'chat')!
  const before = stringFlag(ctx.flags, 'before-cursor')
  const after = stringFlag(ctx.flags, 'after-cursor')
  if (before && after) throw usage('Use only one of --before-cursor or --after-cursor')
  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, chat, chatResolutionOptions(ctx))
  let items = await collectMessages(client.messages.list(chatID, {
    cursor: before ?? after,
    direction: before ? 'before' : after ? 'after' : undefined,
  }), numberFlag(ctx.flags, 'limit', 50), stringFlag(ctx.flags, 'sender'))
  if (ctx.flags.asc) items = [...items].reverse()
  return ctx.flags.ids ? ids(items.map(apiRecord), 'messageID') : items
}

async function messagesContext(ctx: CommandContext): Promise<unknown> {
  const id = stringFlag(ctx.flags, 'id')!
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: 'messages.context', request: { after: numberFlag(ctx.flags, 'after', 10), before: numberFlag(ctx.flags, 'before', 10), chat: stringFlag(ctx.flags, 'chat'), messageID: id, pick: ctx.flags.pick } }
  }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  const message = client.messages.retrieve ? await client.messages.retrieve(id, { chatID }) : undefined
  const before = await collectPage(client.messages.list(chatID, { cursor: id, direction: 'before' }), numberFlag(ctx.flags, 'before', 10))
  const after = await collectPage(client.messages.list(chatID, { cursor: id, direction: 'after' }), numberFlag(ctx.flags, 'after', 10))
  return { after, before, chatID, message, messageID: id }
}

async function messagesEdit(ctx: CommandContext): Promise<unknown> {
  const id = stringFlag(ctx.flags, 'id')!
  const text = stringFlag(ctx.flags, 'message')!
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'messages.edit', request: { chat: stringFlag(ctx.flags, 'chat'), messageID: id, pick: ctx.flags.pick, text } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  return client.messages.update(id, { chatID, text })
}

async function messagesDelete(ctx: CommandContext): Promise<unknown> {
  const id = stringFlag(ctx.flags, 'id')!
  const forEveryone = Boolean(ctx.flags['for-everyone'])
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'messages.delete', request: { chat: stringFlag(ctx.flags, 'chat'), forEveryone, messageID: id, pick: ctx.flags.pick } }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'chat')
  await client.messages.delete(id, { chatID, forEveryone: forEveryone || undefined })
  return { chatID, deleted: true, forEveryone, messageID: id }
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
  const url = ctx.args[0]
  if (!url) throw usage('media download requires url')
  const out = stringFlag(ctx.flags, 'out') ?? '.'
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: 'media.download', request: { out, url } }

  const client = await apiClient(ctx)
  const response = await client.assets.serve({ url })
  if (!response.ok) throw usage(`Failed to download media: HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (out === '-') {
    output.write(buffer)
    return undefined
  }

  await mkdir(out, { recursive: true })
  const path = join(out, basename(new URL(url).pathname) || 'media')
  await writeFile(path, buffer)
  return { bytes: buffer.length, path }
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
  const kind = ctx.commandPath[1]
  if (kind !== 'file' && kind !== 'sticker' && kind !== 'text' && kind !== 'voice') throw usage(`Unsupported send command: ${ctx.commandPath.join(' ')}`)
  const to = stringFlag(ctx.flags, 'to')!
  const payload = await sendPayload(ctx, kind)
  if (ctx.globalFlags.dryRun) return { dry_run: true, op: `send.${kind}`, request: { chat: to, ...payload } }

  const client = await apiClient(ctx)
  const chatID = await resolveChatID(client, to, chatResolutionOptions(ctx))
  return sendMessage(client, { ...payload, chatID })
}

async function sendMessage(client: any, options: SendPayload & {
  chatID: string
}): Promise<Record<string, unknown>> {
  const uploaded = options.file
    ? await client.assets.upload({
      file: createReadStream(options.file),
      fileName: options.fileName,
      mimeType: options.mimeType,
    })
    : undefined

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
  const id = stringFlag(ctx.flags, 'id')!
  const reaction = stringFlag(ctx.flags, 'reaction')!
  const transactionID = stringFlag(ctx.flags, 'transaction')
  const remove = Boolean(ctx.flags.remove)
  if (remove && transactionID) throw usage('--transaction cannot be combined with --remove')
  if (ctx.globalFlags.dryRun) {
    return { dry_run: true, op: 'send.react', request: { chat: stringFlag(ctx.flags, 'to'), messageID: id, pick: ctx.flags.pick, reactionKey: reaction, remove, transactionID } }
  }
  const client = await apiClient(ctx)
  const chatID = await chatIDFromFlag(client, ctx, 'to')
  if (remove) return client.chats.messages.reactions.delete(reaction, { chatID, messageID: id })
  return client.chats.messages.reactions.add(id, { chatID, reactionKey: reaction, transactionID })
}

async function authLogout(ctx: CommandContext): Promise<Record<string, unknown>> {
  const target = await resolveTarget({ target: ctx.globalFlags.target })
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
  if (kind === 'text') {
    const message = await messageText(ctx)
    return {
      mentions: stringListFlag(ctx.flags, 'mention'),
      noPreview: Boolean(ctx.flags['no-preview']),
      replyTo: stringFlag(ctx.flags, 'reply-to'),
      text: message,
      wait: Boolean(ctx.flags.wait),
      waitTimeoutMs: numberFlag(ctx.flags, 'wait-timeout', 30_000),
    }
  }
  const file = stringFlag(ctx.flags, 'file')!
  const attachmentType: AttachmentType | undefined = kind === 'sticker' ? 'sticker' : kind === 'voice' ? 'voice-note' : undefined
  return {
    attachmentType,
    duration: kind === 'voice' ? numberFlag(ctx.flags, 'duration', 0) || undefined : undefined,
    file,
    fileName: stringFlag(ctx.flags, 'filename'),
    mimeType: stringFlag(ctx.flags, 'mime') ?? (kind === 'sticker' ? 'image/webp' : kind === 'voice' ? 'audio/ogg' : undefined),
    replyTo: stringFlag(ctx.flags, 'reply-to'),
    text: kind === 'file' ? stringFlag(ctx.flags, 'caption') ?? '' : '',
    wait: Boolean(ctx.flags.wait),
    waitTimeoutMs: numberFlag(ctx.flags, 'wait-timeout', 30_000),
  }
}

async function messageText(ctx: CommandContext): Promise<string> {
  const literal = stringFlag(ctx.flags, 'message')
  const file = stringFlag(ctx.flags, 'message-file')
  if (literal && file) throw usage('--message and --message-file cannot be combined')
  if (file) return file === '-' ? await readStdin() : readFile(file, 'utf8')
  if (literal !== undefined) return ctx.flags['message-escapes'] ? decodeEscapes(literal) : literal
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
  const state = (stringFlag(ctx.flags, 'state') ?? 'typing') as 'typing' | 'paused'
  const duration = ctx.flags.duration === undefined ? undefined : numberFlag(ctx.flags, 'duration', 0)
  if (duration !== undefined && duration <= 0) throw usage('--duration must be a positive integer')
  if (duration !== undefined && state !== 'typing') throw usage('--duration only applies when --state is typing')
  const to = stringFlag(ctx.flags, 'to')!
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
  return resolveChatID(client, stringFlag(ctx.flags, name)!, chatResolutionOptions(ctx))
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
  const signature = webhook.secret ? `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}` : undefined
  webhook.queue.push({ body, signature })
  void drainWebhook(webhook, events)
}

async function drainWebhook(webhook: WebhookConfig, events: boolean): Promise<void> {
  while (webhook.queue.length > 0) {
    const item = webhook.queue.shift()!
    webhook.inflight += 1
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (item.signature) headers['x-beeper-signature'] = item.signature
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

async function collectMessages(iterable: AsyncIterable<unknown>, limit: number, sender?: string): Promise<unknown[]> {
  if (!sender) return collectPage(iterable, limit)
  const items: unknown[] = []
  for await (const item of iterable) {
    if (matchesSender(item, sender)) items.push(item)
    if (items.length >= limit) break
  }
  return items
}

function matchesSender(item: unknown, sender: string): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as { isSender?: boolean; senderID?: string }
  if (sender === 'me') return row.isSender === true
  if (sender === 'others') return row.isSender !== true
  return row.senderID === sender
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function completionScript(shell: string): string {
  const command = 'beeper'
  if (shell === 'bash') {
    return [
      '_beeper_complete() {',
      '  local completions',
      '  completions=$(beeper __complete --cword "$COMP_CWORD" -- "${COMP_WORDS[@]}")',
      '  COMPREPLY=( $completions )',
      '}',
      `complete -F _beeper_complete ${command}`,
      '',
    ].join('\n')
  }
  if (shell === 'zsh') {
    return [
      '#compdef beeper',
      '_beeper() {',
      '  local -a completions',
      '  completions=("${(@f)$(beeper __complete --cword "$((CURRENT - 1))" -- "${words[@]}")}")',
      '  _describe "values" completions',
      '}',
      '_beeper "$@"',
      '',
    ].join('\n')
  }
  if (shell === 'fish') {
    return `complete -c ${command} -f -a '(beeper __complete --cword (commandline -t | wc -w) -- (commandline -opc))'\n`
  }
  if (shell === 'powershell' || shell === 'pwsh') {
    return [
      `Register-ArgumentCompleter -Native -CommandName ${command} -ScriptBlock {`,
      '  param($wordToComplete, $commandAst, $cursorPosition)',
      '  $words = $commandAst.ToString().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)',
      '  $cword = [Math]::Max(0, $words.Length - 1)',
      '  beeper __complete --cword $cword -- $words | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, "ParameterValue", $_) }',
      '}',
      '',
    ].join('\n')
  }
  throw usage('completion shell must be one of: bash, zsh, fish, powershell')
}

function completeWords(words: string[], cword: number): string[] {
  const index = normalizeCword(cword, words.length)
  const start = isProgramName(words[0]) ? 1 : 0
  if (index < start) return []
  const current = index < words.length ? words[index] ?? '' : ''
  const consumed = words.slice(start, Math.min(index, words.length))
  if (consumed.includes('--')) return []
  const node = completionNode(consumed)
  if (!node || previousFlagNeedsValue(node.flags, words, index)) return []
  const flags = node.flags
  const children = node.children
  const suggestions = current.startsWith('-')
    ? matching([...flags], current)
    : matching([...children, ...flags], current)
  return [...new Set(suggestions)].sort()
}

function completionNode(consumed: string[]): { children: string[]; command?: CommandSpec; flags: string[] } | undefined {
  let candidates = commands.filter(command => !command.hidden)
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
    for (const path of commandPathVariants(command)) {
      const part = path[depth]
      if (part) children.add(part)
    }
  }
  return {
    children: [...children],
    command: exact,
    flags: flagTokens([...(exact?.flags ?? []), ...globalFlagSpecs]),
  }
}

function commandPathVariants(command: CommandSpec): string[][] {
  return [command.path, ...(command.aliases ?? [])]
}

function flagTokens(flags: FlagSpec[]): string[] {
  return flags.flatMap(flag => [
    `--${flag.name}`,
    flag.short ? `-${flag.short}` : undefined,
    ...(flag.aliases ?? []).map(alias => `--${alias}`),
    flag.type === 'boolean' ? `--no-${flag.name}` : undefined,
  ]).filter((value): value is string => Boolean(value))
}

function previousFlagNeedsValue(flags: string[], words: string[], cword: number): boolean {
  const previous = words[cword - 1]
  if (!previous?.startsWith('-') || previous.includes('=')) return false
  const spec = [...globalFlagSpecs, ...commands.flatMap(command => command.flags ?? [])]
    .find(flag => [`--${flag.name}`, flag.short ? `-${flag.short}` : undefined, ...(flag.aliases ?? []).map(alias => `--${alias}`)].includes(previous))
  return Boolean(spec && spec.type !== 'boolean' && flags.includes(previous))
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

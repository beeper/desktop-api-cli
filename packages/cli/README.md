# beeper — One CLI for all your chats

> Built for you and your agent. Batteries included.

Talks to Beeper Desktop on this machine, to a Beeper Server you self-host, or
to either one running somewhere else. Send and receive across the chat
networks Beeper bridges, from one CLI shaped for scripts, agents, and humans
in a hurry.

**Supported chat networks** (via Beeper's bridges):
WhatsApp · iMessage · Telegram · Discord · Signal · Instagram DMs ·
Facebook Messenger · X (Twitter) DMs · LinkedIn · Slack ·
Google Messages (RCS/SMS) · Google Chat · Matrix · IRC · Bluesky.
Run `beeper bridges list` for the live list on your target.

Command manual: `beeper man` · CLI docs: `beeper docs`

## Features

- **Connects to your Beeper.** Local Beeper Desktop on this machine (default), a Beeper Server you install and manage via the CLI, or a remote Beeper Desktop or Beeper Server authorized over OAuth/PKCE — or a bearer token in CI.
- **Setup that does the work.** `beeper setup` finds Beeper Desktop, offers to launch it, adopts the session. `--server --install` installs and starts a headless server in one step. `--oauth` opens the browser. `--remote URL` does the rest.
- **Every chat, every network.** List, search, start, archive, pin, mute, rename, focus. Read, edit, delete, react. Send text, files, stickers, voice, typing indicators. Download media. Export to JSON or Markdown.
- **Verification first-class.** SAS/QR device verification, recovery-key unlock, `status`/`doctor` to reach an encrypted-ready target — without leaving the shell.
- **Agent-shaped automation.** `--json` everywhere, NDJSON `--events`, `watch` with WebSocket + outbound HMAC-signed webhooks, `rpc` over stdin/stdout, `man --json` tool manifests, raw `api get`/`post`/`request` for Beeper Client API endpoints we haven't wrapped yet.
- **Safe by default.** `--read-only` rejects every mutating command. Writes stay explicit. Plugins extend the CLI without forking it.

## Install

### Homebrew (recommended)

```sh
brew install beeper/tap/cli
```

The installed command is `beeper`.

### npm

```sh
npx beeper-cli --help
npm install -g beeper-cli
```

The package name is `beeper-cli`; the installed command is `beeper`.

### Build from source

This repo is a Bun workspace. From the repo root:

```sh
bun install
bun --filter @beeper/cli run build
bun --filter @beeper/cli run dev -- --help
```

For local CLI development inside `packages/cli`:

```sh
bun run dev -- --help
```

Regenerate this README after command, flag, or argument changes:

```sh
bun run readme
```

## Quick start

The happy path: Beeper Desktop is already on this machine. `beeper setup` finds
it, offers to launch it if it's not running, and adopts the session.

```text
$ beeper setup
Looking for Beeper Desktop… found, not running.
Launch it now? [Y/n] y
▎ Launched   Beeper Desktop
  next       Run `beeper setup` again once it finishes starting.

$ beeper setup
Use this Desktop session for CLI access? [Y/n] y
▎ Connected  desktop
  accounts   whatsapp, telegram, imessage
  endpoint   http://127.0.0.1:23373

$ beeper chats list --limit 3
  10313  Family             3 unread
   8951  Alice              ·
   7204  Eng standup        12 unread

$ beeper messages search "flight"
   8951  Alice    · "your flight is at 6:40, gate B23"   2d ago
  10313  Family   · "what flight are you on?"            1w ago

$ beeper send text --to Family --message "on my way"
▎ Sent       Family
  message    "on my way"
  at         2026-05-18T14:02:11Z

$ beeper export --out ./beeper-export
▎ Exported   ./beeper-export
  chats      214   messages   38,901   attachments 1,205
```

Recipients accept a numeric local chat ID, a full Beeper/Matrix chat ID, an
iMessage chat ID, an exact title, or search text. Ambiguous matches prompt in a
TTY; pass `--pick N` in scripts.

## Connecting a target

A *target* is the Beeper endpoint `beeper` talks to — local Beeper Desktop,
local Beeper Server, or a remote Beeper Desktop or Beeper Server. Pick one of
four paths.

### 1. Local Beeper Desktop (default, recommended)

If Beeper Desktop is installed and signed in here, `beeper setup` discovers it
on `http://127.0.0.1:23373` and adopts the existing session. If it's installed
but not running, `setup` offers to launch it. If it's not installed at all,
`--install` does that in one step.

```text
$ beeper setup --desktop --install
▎ Installed   Beeper Desktop (stable)
▎ Launched    Beeper Desktop
  next        Sign in to Beeper Desktop, then re-run `beeper setup`.

$ beeper setup
▎ Connected   desktop
  accounts    whatsapp, telegram
```

Variants: `beeper setup --local` to skip discovery and force the local path;
`beeper install desktop --channel nightly` for the nightly channel.

### 2. Local Beeper Server (self-hosted, managed by the CLI)

For a headless long-running setup on this machine, install and adopt a local
Beeper Server. The CLI manages the process — `targets start/stop/restart/logs/enable`.

```text
$ beeper setup --server --install
▎ Installed   Beeper Server (stable)
▎ Started     server on http://127.0.0.1:23373
  auth        Opening browser to authorize this server…
▎ Connected   server
  accounts    (none)
  next        Run `beeper accounts add` to connect a network.

$ beeper accounts add
? Which bridge?  whatsapp
  Scan this QR code with WhatsApp on your phone:
    ▄▄▄▄▄▄▄  ▄ ▄  ▄▄▄▄▄▄▄
    █ ███ █  ▄█▄  █ ███ █
    █ ███ █  ▀█▀  █ ███ █
    ▀▀▀▀▀▀▀  ▀ ▀  ▀▀▀▀▀▀▀
▎ Connected   whatsapp · +1•••4242
```

Variants: `beeper install server`, `beeper install server --server-env staging`.

### 3. Remote Desktop or Server via OAuth (PKCE)

For a Beeper Desktop or Server running on another machine, authorize the CLI
through a browser-based OAuth/PKCE flow.

```text
$ beeper setup --remote https://desktop.example.com
▎ Authorizing  https://desktop.example.com
  flow         OAuth (PKCE) — opening browser…
▎ Connected    remote (desktop.example.com)
  accounts     whatsapp, telegram, signal
```

Variants: `beeper setup --oauth` (PKCE against the default Beeper auth);
`beeper targets add remote work https://desktop.example.com --default` to
register additional remotes.

### 4. Bearer token (non-interactive / CI)

For agents, CI, and scripts, hand the CLI a bearer token directly — no
browser, no interactive prompts.

```sh
BEEPER_ACCESS_TOKEN=... beeper chats list --json
BEEPER_ACCESS_TOKEN=... BEEPER_DESKTOP_BASE_URL=https://desktop.example.com \
  beeper messages list --chat 10313 --json
```

Once connected, `beeper accounts add` walks each chat-network bridge through
its own login — QR, code, OAuth, cookie, whatever the bridge requires — so
WhatsApp, Telegram, Discord, iMessage, and the rest show up under `accounts list`.

## Documentation

| Topic | Page | Commands |
| --- | --- | --- |
| **Setup + install** | [setup](docs/setup.md) · [auth](docs/auth.md) | `setup` · `install desktop` · `install server` · `verify` · `status` · `doctor` · `auth status` |
| **Targets** | [targets](docs/targets.md) | `targets list` · `targets add desktop` · `targets add server` · `targets add remote` · `targets use` · `targets status` · `targets logs` |
| **Bridges + accounts** | [accounts](docs/accounts.md) | `bridges list` · `bridges show` · `accounts list` · `accounts add` · `accounts show` · `accounts use` · `accounts remove` |
| **Chats** | [chats](docs/chats.md) | `chats list` · `chats search` · `chats show` · `chats start` · `chats archive` · `chats pin` · `chats mute` · `chats priority` · `chats remind` · `chats rename` · `chats draft` · `chats focus` |
| **Messages** | [messages](docs/messages.md) · [send](docs/send.md) · [presence](docs/presence.md) | `messages list` · `messages search` · `messages export` · `send text` · `send file` · `send sticker` · `send voice` · `send react` · `presence` |
| **Contacts + media** | [contacts](docs/contacts.md) · [media](docs/media.md) · [export](docs/export.md) | `contacts list` · `contacts search` · `media download` · `export` |
| **Automation** | [watch](docs/watch.md) · [rpc](docs/rpc.md) · [api](docs/api.md) | `watch` · `watch --webhook` · `rpc` · `man` · `api get` · `api post` · `api request` |
| **Maintenance** | [config](docs/config.md) · [update](docs/update.md) | `update` · `config` · `completion` · `docs` · `version` |

Use `beeper docs` to open the CLI docs and `beeper man` to print the local
command manual.

## Configuration

Default Beeper Client API target: `http://127.0.0.1:23373`. CLI configuration is
stored under your user config dir; print it with `beeper config path`.

**Global flags:** `--base-url`, `--target`, `--json`, `--events`,
`--full`, `--timeout`, `--read-only`, `--debug`, `--yes`, `--quiet`.

**Environment overrides:**

| Variable | Effect |
| --- | --- |
| `BEEPER_ACCESS_TOKEN` | Bearer token for the selected target. Overrides stored OAuth login. |
| `BEEPER_DESKTOP_BASE_URL` | Beeper Client API base URL (Desktop or Server). Defaults to `http://127.0.0.1:23373`. |
| `BEEPER_READONLY` | `1`/`true`/`yes`/`on` enables read-only mode globally. |
| `BEEPER_CLI_CONFIG_DIR` | Override config directory for testing or isolated profiles. |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Generic runtime error. |
| `2` | Usage error (parsing, validation, missing required flag/arg, read-only refusal). |
| `3` | Auth required (no stored token; sign in or set `BEEPER_ACCESS_TOKEN`). |
| `4` | Target/account not ready (`doctor` reports this when readiness is not `ready`). |
| `5` | Selector matched nothing (unknown target, account, chat, contact). |
| `6` | Ambiguous selector (multiple matches; pass an exact ID or `--pick N`). |

JSON output preserves the same envelope on failure: `{"success":false,"data":null,"error":"...","exitCode":N}` written to stderr.

## Addressing

- Chat arguments accept numeric local chat IDs, full Beeper/Matrix chat IDs, iMessage chat IDs, exact titles, or search text.
- For scripts on the same target/profile, prefer the numeric local chat ID shown by `beeper chats list`; use the full Beeper/Matrix chat ID when the selector must work across targets or profiles.
- Numeric local chat IDs come from the selected Desktop database. Treat them as local to that target/profile.
- Ambiguous chat matches return numbered choices; pass `--pick N` to select one.
- Account arguments accept account IDs, network names, bridge type/id, or account user identity.
- Account filters can expand a network name to multiple matching accounts.
- `contacts search` and `chats start` can search across all accounts when `--account` is omitted.
- `contacts list` accepts the same account selectors as other account-scoped commands.

## Output and scripting

Most commands support:

- app-like text by default, optimized for scanning chats, messages, contacts, accounts, and media
- `--json` for `{"success":true,"data":...,"error":null}` output on stdout
- `--events` for NDJSON lifecycle events on stderr from long-running commands
- `--read-only` to reject commands that modify Beeper or local CLI state
- `--full` to disable truncation
- `--debug` for SDK debug logging
- `--target` or `--base-url` to point at a different target

`man --json` prints a compact command manifest for tools and agents.
`rpc` runs newline-delimited JSON command RPC over stdin/stdout.

## Raw API access

Raw Beeper Client API calls live under `api`, so scripts can reach a new
endpoint before a workflow command exists:

```sh
beeper api get /v1/info
beeper api post /v1/messages/{chatID}/send --body '{"text":"hello"}'
beeper api request DELETE /v1/chats/abc/messages/def/reactions --body '{"reactionKey":"👍"}'
```

## Plugins

Beeper CLI supports optional oclif plugins. List recommended Beeper plugins:

```sh
beeper plugins available
```

Install a published plugin:

```sh
beeper plugins install @beeper/cli-plugin-cloudflare
```

For plugin development, import from `@beeper/cli/plugin-sdk` and expose oclif
commands from your package. Link a local plugin while working on it:

```sh
beeper plugins link ./packages/cli-plugin-cloudflare
beeper targets tunnel --help
```

First-party optional plugins:

| Package | Adds |
| --- | --- |
| `@beeper/cli-plugin-cloudflare` | `targets tunnel` for exposing a selected Beeper target through Cloudflare Tunnel. |


## Command Summary

| Command | Summary |
| --- | --- |
| `setup` | Make the selected target ready for messaging |
| `install desktop` | Install Beeper Desktop locally |
| `install server` | Install Beeper Server locally |
| `targets list` | List configured Beeper targets |
| `bridges list` | List bridges that can connect chat accounts |
| `bridges show` | Show bridge details, login flows, and connected accounts |
| `targets add desktop` | Add a managed Beeper Desktop target |
| `targets add server` | Add a managed Beeper Server target |
| `targets add remote` | Add a remote Beeper Desktop or Server target |
| `targets use` | Set the default target |
| `targets show` | Show target details |
| `targets status` | Check endpoint and process reachability for a target |
| `targets start` | Start a local Server target or open Beeper Desktop |
| `targets stop` | Stop a local Beeper Server target |
| `targets restart` | Restart a local Beeper Server target |
| `targets logs` | Print logs for a local Beeper Desktop or Server install |
| `targets enable` | Enable a local Beeper Server target at login |
| `targets disable` | Disable a local Beeper Server target at login |
| `targets remove` | Remove a target |
| `targets tunnel` | Expose a local Desktop API over a public Cloudflare tunnel |
| `auth status` | Show stored auth for the selected target |
| `auth logout` | Clear stored authentication |
| `auth email start` | Start email sign-in for a target |
| `auth email response` | Finish email sign-in with a verification code |
| `verify` | Finish setup verification or verify another device |
| `verify status` | Show encryption and device-verification readiness |
| `verify approve` | Approve a pending device verification request |
| `verify recovery-key` | Unlock encrypted messages with a recovery key |
| `verify reset-recovery-key` | Create a new encrypted-messages recovery key |
| `verify cancel` | Cancel an in-progress device verification |
| `verify list` | List active verification work |
| `verify start` | Start a device verification request |
| `verify show` | Show the current active verification request |
| `verify sas` | Start emoji verification |
| `verify sas-confirm` | Confirm matching emoji verification |
| `verify qr-scan` | Submit a scanned QR-code verification payload |
| `verify qr-confirm` | Confirm that the other device scanned your QR code |
| `accounts list` | List connected accounts |
| `accounts add` | Connect a chat account by bridge |
| `accounts show` | Show account details |
| `accounts remove` | Remove an account |
| `accounts use` | Select a default account for account-scoped commands |
| `chats list` | List chats |
| `chats search` | Search chats |
| `chats show` | Show chat details |
| `chats start` | Start a chat |
| `chats archive` | Archive a chat |
| `chats unarchive` | Unarchive a chat |
| `chats pin` | Pin a chat |
| `chats unpin` | Unpin a chat |
| `chats mute` | Mute a chat |
| `chats unmute` | Unmute a chat |
| `chats mark-read` | Mark a chat as read |
| `chats mark-unread` | Mark a chat as unread |
| `chats priority` | Move a chat to the Inbox or Low Priority |
| `chats notify-anyway` | Send an iMessage Notify Anyway alert |
| `chats rename` | Rename a chat |
| `chats description` | Set a chat description |
| `chats avatar` | Set a chat avatar |
| `chats draft` | Set or clear a chat draft |
| `chats disappear` | Set disappearing-message expiry |
| `chats remind` | Set a chat reminder |
| `chats unremind` | Clear a chat reminder |
| `chats focus` | Focus Beeper Desktop on a chat |
| `messages list` | List chat messages |
| `messages search` | Search messages across chats |
| `messages show` | Show one message |
| `messages context` | Show message context |
| `messages edit` | Edit a message |
| `messages delete` | Delete a message |
| `messages export` | Export one chat to JSON |
| `send text` | Send a text message |
| `send file` | Send a file |
| `send react` | Send a reaction to a message |
| `send sticker` | Send a sticker |
| `send unreact` | Remove a reaction from a message |
| `send voice` | Send a voice note |
| `presence` | Send a typing (or paused) indicator to a chat |
| `contacts list` | List contacts |
| `contacts search` | Search contacts |
| `contacts show` | Show contact details |
| `media download` | Download message media |
| `export` | Export accounts, chats, messages, Markdown transcripts, and attachments |
| `watch` | Stream Desktop API WebSocket events |
| `rpc` | Run newline-delimited JSON command RPC over stdin/stdout |
| `man` | Print the command manual |
| `doctor` | Probe the target live and report diagnostics |
| `status` | Show selected target and setup readiness |
| `docs` | Open Beeper CLI docs |
| `version` | Print CLI version |
| `completion` | Print shell completion setup |
| `plugins` | Manage Beeper CLI plugins |
| `plugins available` | List recommended optional Beeper CLI plugins |
| `update` | Check and install Beeper updates |
| `config get` | Print CLI configuration |
| `config set` | Set a CLI configuration value |
| `config path` | Print the CLI config path |
| `config reset` | Reset CLI configuration |
| `api get` | Call a raw Desktop API GET path |
| `api post` | Call a raw Desktop API POST path with a JSON body |
| `api request` | Call a raw Desktop API path with any supported HTTP method |

## Command Reference

### `beeper setup`
Make the selected target ready for messaging

```sh
beeper setup
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--channel=<stable\|nightly>` | option | Install release channel Default: stable |
| `--desktop` | boolean | Set up a local Beeper Desktop target |
| `--email=<value>` | option | Sign in with an email address |
| `--install` | boolean | Allow installing missing managed runtime |
| `--local` | boolean | Use the local Beeper Desktop session on this device |
| `--oauth` | boolean | Authorize the target with browser OAuth/PKCE |
| `--remote=<value>` | option | Connect to a remote Beeper Desktop or Server URL |
| `--server` | boolean | Set up a local Beeper Server target |
| `--server-env=<production\|staging>` | option | Server environment. Staging forces nightly. Default: production |
| `--username=<value>` | option | Username to use if setup creates a new account |

Examples:

```sh
beeper setup
beeper setup --local
beeper setup --oauth
beeper setup --remote https://desktop.example.com
beeper setup --desktop --install
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper install desktop`
Install Beeper Desktop locally

```sh
beeper install desktop
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--channel=<stable\|nightly>` | option | Desktop release channel Default: stable |

Examples:

```sh
beeper install desktop
beeper install desktop --channel nightly
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper install server`
Install Beeper Server locally

```sh
beeper install server
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--channel=<stable\|nightly>` | option | Server release channel Default: stable |
| `--server-env=<production\|staging>` | option | Server environment. Staging forces nightly. Default: production |

Examples:

```sh
beeper install server
beeper install server --server-env staging
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets list`
List configured Beeper targets

```sh
beeper targets list
```

Examples:

```sh
beeper targets list
beeper targets list --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper bridges list`
List bridges that can connect chat accounts

```sh
beeper bridges list
```

`bridges list` is the scriptable bridge catalog. Use `accounts add` without an argument for the guided account connection flow.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--available` | boolean | Only bridges available to add (--no-available to exclude) |
| `--provider=<local\|cloud\|self-hosted>` | option | Limit to bridge provider |

Examples:

```sh
beeper bridges list
beeper bridges list --provider local --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper bridges show`
Show bridge details, login flows, and connected accounts

```sh
beeper bridges show <bridge>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `bridge` | yes | Bridge ID, display name, network, or type |

Examples:

```sh
beeper bridges show local-whatsapp
beeper bridges show telegram
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets add desktop`
Add a managed Beeper Desktop target

```sh
beeper targets add desktop [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name (default: "desktop") |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--default` | boolean | Set this target as the default after creation |
| `--port=<value>` | option | TCP port the managed Desktop will expose its API on |
| `--server-env=<production\|staging>` | option | Server environment. Staging forces nightly. Default: production |

Examples:

```sh
beeper targets add desktop work --default
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets add server`
Add a managed Beeper Server target

```sh
beeper targets add server [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name (default: "server") |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--default` | boolean | Set this target as the default after creation |
| `--port=<value>` | option | TCP port the managed Server will expose its API on |
| `--server-env=<production\|staging>` | option | Server environment. Staging forces nightly. Default: production |

Examples:

```sh
beeper targets add server prod --server-env production --default
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets add remote`
Add a remote Beeper Desktop or Server target

```sh
beeper targets add remote <name> <url>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | yes | Local name for the target |
| `url` | yes | Base URL of the remote Desktop or Server API |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--default` | boolean | Set this target as the default after creation |

Examples:

```sh
beeper targets add remote work https://desktop.example.com --default
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets use`
Set the default target

```sh
beeper targets use <name>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | yes | Target name |

Examples:

```sh
beeper targets use work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets show`
Show target details

```sh
beeper targets show [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets show
beeper targets show work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets status`
Check endpoint and process reachability for a target

```sh
beeper targets status [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets status
beeper targets status work --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets start`
Start a local Server target or open Beeper Desktop

```sh
beeper targets start [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets start work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets stop`
Stop a local Beeper Server target

```sh
beeper targets stop [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets stop work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets restart`
Restart a local Beeper Server target

```sh
beeper targets restart [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets restart work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets logs`
Print logs for a local Beeper Desktop or Server install

```sh
beeper targets logs [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--all` | boolean | Print all matching log files instead of only recent files |
| `--files=<value>` | option | Desktop log files to print, newest first Default: 5 |
| `--lines=<value>` | option | Lines to print from each log file Default: 200 |

Examples:

```sh
beeper targets logs work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets enable`
Enable a local Beeper Server target at login

```sh
beeper targets enable [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets enable work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets disable`
Disable a local Beeper Server target at login

```sh
beeper targets disable [name]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | no | Target name. Defaults to the selected target. |

Examples:

```sh
beeper targets disable work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets remove`
Remove a target

```sh
beeper targets remove <name>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `name` | yes | Target name |

Examples:

```sh
beeper targets remove work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper targets tunnel`
Expose a local Desktop API over a public Cloudflare tunnel

```sh
beeper targets tunnel
```

Examples:

```sh
beeper targets tunnel
beeper targets tunnel --target work --read-only
beeper targets tunnel --as work-laptop --port 23373
```

### `beeper auth status`
Show stored auth for the selected target

```sh
beeper auth status
```

Examples:

```sh
beeper auth status
beeper auth status --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper auth logout`
Clear stored authentication

```sh
beeper auth logout
```

Examples:

```sh
beeper auth logout
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper auth email start`
Start email sign-in for a target

```sh
beeper auth email start
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--email=<value>` | option | Email address to sign in with Required. |

Examples:

```sh
beeper auth email start --email you@example.com --target work --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper auth email response`
Finish email sign-in with a verification code

```sh
beeper auth email response
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--code=<value>` | option | Email verification code Required. |
| `--setup-request-id=<value>` | option | Setup request ID from auth email start Required. |
| `--username=<value>` | option | Username to use if setup creates a new account |

Examples:

```sh
beeper auth email response --setup-request-id <id> --code <code> --target work --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify`
Finish setup verification or verify another device

```sh
beeper verify
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--user=<value>` | option | User ID to verify against (defaults to your own account) |

Examples:

```sh
beeper verify
beeper verify --user @alice:beeper.com
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify status`
Show encryption and device-verification readiness

```sh
beeper verify status
```

Examples:

```sh
beeper verify status --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify approve`
Approve a pending device verification request

```sh
beeper verify approve
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |

Examples:

```sh
beeper verify approve --id active
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify recovery-key`
Unlock encrypted messages with a recovery key

```sh
beeper verify recovery-key
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--key=<value>` | option | Recovery key string Required. |

Examples:

```sh
beeper verify recovery-key --key ABCD-EFGH-IJKL
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify reset-recovery-key`
Create a new encrypted-messages recovery key

```sh
beeper verify reset-recovery-key
```

Examples:

```sh
beeper verify reset-recovery-key
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify cancel`
Cancel an in-progress device verification

```sh
beeper verify cancel
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |

Examples:

```sh
beeper verify cancel
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify list`
List active verification work

```sh
beeper verify list
```

Examples:

```sh
beeper verify list
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify start`
Start a device verification request

```sh
beeper verify start
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--user=<value>` | option | User ID to verify with (defaults to your own account) |

Examples:

```sh
beeper verify start --user @alice:beeper.com
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify show`
Show the current active verification request

```sh
beeper verify show
```

Examples:

```sh
beeper verify show --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify sas`
Start emoji verification

```sh
beeper verify sas
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |

Examples:

```sh
beeper verify sas
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify sas-confirm`
Confirm matching emoji verification

```sh
beeper verify sas-confirm
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |

Examples:

```sh
beeper verify sas-confirm
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify qr-scan`
Submit a scanned QR-code verification payload

```sh
beeper verify qr-scan
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |
| `--payload=<value>` | option | Raw QR-code data scanned from the other device Required. |

Examples:

```sh
beeper verify qr-scan --payload "..."
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper verify qr-confirm`
Confirm that the other device scanned your QR code

```sh
beeper verify qr-confirm
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Verification request ID. Defaults to the active request. |

Examples:

```sh
beeper verify qr-confirm
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper accounts list`
List connected accounts

```sh
beeper accounts list
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Filter by account selector |
| `--ids` | boolean | Print only account IDs |

Examples:

```sh
beeper accounts list
beeper accounts list --account whatsapp --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper accounts add`
Connect a chat account by bridge

```sh
beeper accounts add [bridge]
```

`accounts add` without an argument opens the guided bridge chooser. Pass a bridge ID when you already know which chat network connector to use.

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `bridge` | no | Bridge ID, network, or type to connect. Omit to list available bridges. |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--cookie=<value>...` | option | Cookie value for non-interactive login, in name=value form. Repeat for multiple cookies. |
| `--field=<value>...` | option | Field value for non-interactive login, in id=value form. Repeat for multiple fields. |
| `--flow=<value>` | option | Login flow ID. If omitted, Desktop chooses the default flow. |
| `--guided` | boolean | Prompt through login steps until completion |
| `--login-id=<value>` | option | Existing login ID to re-login as |
| `--non-interactive` | boolean | Do not prompt; require --flow, --field, and --cookie values when needed. |
| `--webview` | boolean | Use Bun.WebView to collect cookie login fields when a cookie step is returned. |
| `--webview-backend=<auto\|chrome\|webkit>` | option | Bun.WebView backend for cookie login steps. Default: chrome |
| `--webview-browser-path=<value>` | option | Chromium-family browser executable for interactive webview login. |
| `--webview-timeout=<value>` | option | Seconds to wait for Bun.WebView cookie collection. Default: 120 |

Examples:

```sh
beeper accounts add
beeper accounts add local-whatsapp
beeper accounts add discord --non-interactive --cookie sessiontoken=...
beeper accounts add discord --webview --webview-backend chrome
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper accounts show`
Show account details

```sh
beeper accounts show <account>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `account` | yes | Account selector (ID, network, bridge, or user identity) |

Examples:

```sh
beeper accounts show whatsapp-main
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper accounts remove`
Remove an account

```sh
beeper accounts remove <account>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `account` | yes | Account selector (ID, network, bridge, or user identity) |

Examples:

```sh
beeper accounts remove whatsapp-main
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper accounts use`
Select a default account for account-scoped commands

```sh
beeper accounts use <account>
```

Persists the choice in CLI config. Account-scoped commands that take --account fall back to this default when --account is omitted. Use `beeper accounts use ""` (or `beeper config set defaultAccount ""`) to clear.

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `account` | yes | Account selector (ID, network, bridge, user identity), or "" to clear. |

Examples:

```sh
beeper accounts use whatsapp-main
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats list`
List chats

```sh
beeper chats list
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to Account ID, network, bridge, or account user |
| `--archived` | boolean | Only archived chats (--no-archived to exclude) |
| `--ids` | boolean | Print preferred chat selectors, using numeric local chat IDs when available |
| `--limit=<value>` | option | Maximum chats to print Default: 20 |
| `--low-priority` | boolean | Only Low Priority chats (--no-low-priority to exclude) |
| `--muted` | boolean | Only muted chats (--no-muted to exclude) |
| `--pinned` | boolean | Only pinned chats (--no-pinned to exclude) |
| `--unread` | boolean | Only chats with unread messages (--no-unread to exclude) |

Examples:

```sh
beeper chats list
beeper chats list --pinned --limit 50
beeper chats list --unread --no-muted --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats search`
Search chats

```sh
beeper chats search <query>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `query` | yes | Search query (title, participant, or network) |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to Account ID, network, bridge, or account user |
| `--ids` | boolean | Print preferred chat selectors, using numeric local chat IDs when available |
| `--limit=<value>` | option | Maximum chats to print Default: 20 |

Examples:

```sh
beeper chats search Family
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats show`
Show chat details

```sh
beeper chats show
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--max-participants=<value>` | option | Limit number of participants returned in chat details |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats show --chat 10313
beeper chats show --chat '!plUOsWkvMmJmJPVAjS:beeper.com'
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats start`
Start a chat

```sh
beeper chats start <user>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `user` | yes | User ID, phone number, email, or display name |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>` | option | Account selector. Defaults to the single available account or the matrix account. |
| `--title=<value>` | option | Optional initial title for a new group chat |

Examples:

```sh
beeper chats start +15551234567
beeper chats start @alice:beeper.com --title "Alice"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats archive`
Archive a chat

```sh
beeper chats archive
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats archive --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats unarchive`
Unarchive a chat

```sh
beeper chats unarchive
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats unarchive --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats pin`
Pin a chat

```sh
beeper chats pin
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats pin --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats unpin`
Unpin a chat

```sh
beeper chats unpin
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats unpin --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats mute`
Mute a chat

```sh
beeper chats mute
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats mute --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats unmute`
Unmute a chat

```sh
beeper chats unmute
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats unmute --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats mark-read`
Mark a chat as read

```sh
beeper chats mark-read
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--message=<value>` | option | Mark read at (or unread starting from) this message ID |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats mark-read --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats mark-unread`
Mark a chat as unread

```sh
beeper chats mark-unread
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--message=<value>` | option | Mark read at (or unread starting from) this message ID |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats mark-unread --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats priority`
Move a chat to the Inbox or Low Priority

```sh
beeper chats priority
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--level=<inbox\|low>` | option | Destination: inbox (default mailbox) or low (Low Priority) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats priority --chat 10313 --level inbox
beeper chats priority --chat '!plUOsWkvMmJmJPVAjS:beeper.com' --level low
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats notify-anyway`
Send an iMessage Notify Anyway alert

```sh
beeper chats notify-anyway
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats notify-anyway --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats rename`
Rename a chat

```sh
beeper chats rename
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--title=<value>` | option | New chat title Required. |

Examples:

```sh
beeper chats rename --chat 10313 --title "Family"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats description`
Set a chat description

```sh
beeper chats description
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--clear` | boolean | Clear the existing description instead of setting one |
| `--description=<value>` | option | New chat description |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats description --chat 10313 --description "Engineering chat"
beeper chats description --chat 10313 --clear
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats avatar`
Set a chat avatar

```sh
beeper chats avatar
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--clear` | boolean | Clear the existing avatar instead of setting a new one |
| `--file=<value>` | option | Image file to upload as the new avatar |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats avatar --chat 10313 --file ./team.png
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats draft`
Set or clear a chat draft

```sh
beeper chats draft
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--clear` | boolean | Clear the existing draft instead of setting one |
| `--file=<value>` | option | Attachment file to upload with the draft |
| `--filename=<value>` | option | Override the displayed filename of the attachment |
| `--mime=<value>` | option | Override MIME type detection for the attachment |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--text=<value>` | option | Draft text. Omit and pass --clear to remove the draft. |

Examples:

```sh
beeper chats draft --chat 10313 --text "on my way"
beeper chats draft --chat 10313 --clear
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats disappear`
Set disappearing-message expiry

```sh
beeper chats disappear
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--seconds=<value>` | option | Timer in seconds, or "off" to disable Required. |

Examples:

```sh
beeper chats disappear --chat 10313 --seconds 86400
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats remind`
Set a chat reminder

```sh
beeper chats remind
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--dismiss-on-message` | boolean | Dismiss the reminder automatically when a new message arrives |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--when=<value>` | option | ISO timestamp when the reminder should trigger Required. |

Examples:

```sh
beeper chats remind --chat 10313 --when 2026-06-01T09:00:00Z
beeper chats remind --chat 10313 --when 2026-06-01T09:00:00Z --dismiss-on-message
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats unremind`
Clear a chat reminder

```sh
beeper chats unremind
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats unremind --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper chats focus`
Focus Beeper Desktop on a chat

```sh
beeper chats focus
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--attachment=<value>` | option | Prefill the chat composer with this attachment file path |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--draft=<value>` | option | Prefill the chat composer with this draft text |
| `--message=<value>` | option | Scroll Desktop to this message ID after focusing |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper chats focus --chat 10313
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages list`
List chat messages

```sh
beeper messages list
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--after-cursor=<value>` | option | Paginate messages newer than this message ID |
| `--asc` | boolean | Order oldest first (default: newest first) |
| `--before-cursor=<value>` | option | Paginate messages older than this message ID |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--ids` | boolean | Print only message IDs |
| `--limit=<value>` | option | Maximum messages to print Default: 50 |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--sender=<value>` | option | Filter by sender: me, others, or a specific user ID (client-side) |

Examples:

```sh
beeper messages list --chat 10313 --limit 50
beeper messages list --chat 10313 --before-cursor "<messageID>" --limit 100
beeper messages list --chat 10313 --sender me --asc
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages search`
Search messages across chats

```sh
beeper messages search [query]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `query` | no | Search text (literal word match) |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to an account selector. Repeat for multiple. |
| `--after=<value>` | option | Only messages at or after this ISO timestamp |
| `--before=<value>` | option | Only messages at or before this ISO timestamp |
| `--chat=<value>...` | option | Limit to a chat selector. Repeat for multiple. |
| `--chat-type=<group\|single>` | option | Only group chats or direct messages |
| `--exclude-low-priority` | boolean | Exclude low-priority chats |
| `--ids` | boolean | Print only message IDs |
| `--include-muted` | boolean | Include muted chats |
| `--limit=<value>` | option | Maximum results Default: 50 |
| `--media=<any\|video\|image\|link\|file>...` | option | Filter by media type. Repeat for multiple. |
| `--sender=<value>` | option | me, others, or a user ID |

Examples:

```sh
beeper messages search invoice
beeper messages search --chat 10313 --sender me --media image
beeper messages search "flight" --after 2026-01-01 --before 2026-02-01
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages show`
Show one message

```sh
beeper messages show
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--id=<value>` | option | Message ID, pendingMessageID, or Matrix event ID Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper messages show --chat 10313 --id <messageID>
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages context`
Show message context

```sh
beeper messages context
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--after=<value>` | option | Number of messages to include after the target Default: 10 |
| `--before=<value>` | option | Number of messages to include before the target Default: 10 |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--id=<value>` | option | Target message ID to center the window on Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper messages context --chat 10313 --id <messageID> --before 5 --after 5
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages edit`
Edit a message

```sh
beeper messages edit
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--id=<value>` | option | Message ID to edit (must be one of your own messages with no attachments) Required. |
| `--message=<value>` | option | New message text Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper messages edit --chat 10313 --id <messageID> --message "fixed"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages delete`
Delete a message

```sh
beeper messages delete
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--for-everyone` | boolean | Delete for everyone when the network supports it (otherwise deletes only for you) |
| `--id=<value>` | option | Message ID to delete (final message ID; pending IDs are rejected) Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper messages delete --chat 10313 --id <messageID> --for-everyone
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper messages export`
Export one chat to JSON

```sh
beeper messages export
```

Lightweight per-chat JSON export. For a full export with transcripts, attachments, and multiple chats, use `beeper export`.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--after=<value>` | option | Only messages at or after this ISO timestamp (client-side filter) |
| `--after-cursor=<value>` | option | Paginate messages newer than this message ID |
| `--asc` | boolean | Order oldest first (default: newest first) |
| `--before=<value>` | option | Only messages at or before this ISO timestamp (client-side filter) |
| `--before-cursor=<value>` | option | Paginate messages older than this message ID |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--limit=<value>` | option | Maximum messages to export |
| `-o, --output=<value>` | option | Output path; - writes JSON to stdout Default: - |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper messages export --chat 10313 --output chat.json
beeper messages export --chat 8951 --after 2026-01-01T00:00:00Z --output -
beeper messages export --chat '!plUOsWkvMmJmJPVAjS:beeper.com' --before-cursor "<messageID>" --limit 500
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send text`
Send a text message

```sh
beeper send text
```

Returns when Desktop accepts the send request. Pass `--wait` to wait until the message leaves the pending state or fails.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--mention=<value>...` | option | User ID to @-mention (repeatable) |
| `--message=<value>` | option | Message text to send Required. |
| `--no-preview` | boolean | Disable automatic link preview for URLs in the message |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reply-to=<value>` | option | Send as a reply to this message ID |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--wait` | boolean | Wait for the message to leave the pending state (or fail) before returning |
| `--wait-timeout=<value>` | option | Maximum wait time in ms when --wait is set Default: 30000 |

Examples:

```sh
beeper send text --to 10313 --message "on my way"
beeper send text --to 8951 --message "hi"
beeper send text --to "Family" --message "hi" --pick 1
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send file`
Send a file

```sh
beeper send file
```

Returns when Desktop accepts the send request. Pass `--wait` to wait until the message leaves the pending state or fails.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--caption=<value>` | option | Optional caption to send alongside the file |
| `--file=<value>` | option | Local file path to upload (max 500 MB) Required. |
| `--filename=<value>` | option | Override the displayed filename |
| `--mime=<value>` | option | Override MIME type detection |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reply-to=<value>` | option | Send as a reply to this message ID |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--wait` | boolean | Wait for the message to leave the pending state (or fail) before returning |
| `--wait-timeout=<value>` | option | Maximum wait time in ms when --wait is set Default: 30000 |

Examples:

```sh
beeper send file --to 8951 --file ./photo.jpg --caption "from today"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send react`
Send a reaction to a message

```sh
beeper send react
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Message ID to react to Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reaction=<value>` | option | Reaction key (emoji, shortcode, or custom emoji key) Required. |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--transaction=<value>` | option | Optional transaction ID for deduplication |

Examples:

```sh
beeper send react --to 10313 --id <messageID> --reaction "+1"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send sticker`
Send a sticker

```sh
beeper send sticker
```

Uploads the file and sends as a sticker message. Defaults --mime to image/webp.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--file=<value>` | option | Sticker file (typically 512x512 WebP) Required. |
| `--filename=<value>` | option | Override the displayed filename |
| `--mime=<value>` | option | MIME type for the sticker (default: image/webp) Default: image/webp |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reply-to=<value>` | option | Send as a reply to this message ID |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--wait` | boolean | Wait for the message to leave the pending state (or fail) before returning |
| `--wait-timeout=<value>` | option | Maximum wait time in ms when --wait is set Default: 30000 |

Examples:

```sh
beeper send sticker --to 10313 --file ./hi.webp
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send unreact`
Remove a reaction from a message

```sh
beeper send unreact
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--id=<value>` | option | Message ID whose reaction to remove Required. |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reaction=<value>` | option | Reaction key to remove (emoji, shortcode, or custom emoji key) Required. |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--transaction=<value>` | option | Optional transaction ID for deduplication |

Examples:

```sh
beeper send unreact --to 10313 --id <messageID> --reaction "+1"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper send voice`
Send a voice note

```sh
beeper send voice
```

Uploads the audio file and sends as a voice note. Defaults --mime to audio/ogg.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--duration=<value>` | option | Voice note duration in seconds (overrides upload-detected duration) |
| `--file=<value>` | option | Voice note audio file (OGG/Opus recommended) Required. |
| `--filename=<value>` | option | Override the displayed filename |
| `--mime=<value>` | option | MIME type for the voice note (default: audio/ogg) Default: audio/ogg |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--reply-to=<value>` | option | Send as a reply to this message ID |
| `--to=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--wait` | boolean | Wait for the message to leave the pending state (or fail) before returning |
| `--wait-timeout=<value>` | option | Maximum wait time in ms when --wait is set Default: 30000 |

Examples:

```sh
beeper send voice --to 10313 --file ./note.ogg
beeper send voice --to 10313 --file ./note.ogg --duration 12
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper presence`
Send a typing (or paused) indicator to a chat

```sh
beeper presence
```

Requires server-side support. Networks without typing notifications return an error.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--chat=<value>` | option | Chat selector (ID, local ID, title, or search text) Required. |
| `--duration=<value>` | option | When --state is typing, send paused automatically after this many seconds |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |
| `--state=<typing\|paused>` | option | Indicator to send Default: typing |

Examples:

```sh
beeper presence --chat 10313
beeper presence --chat 10313 --state paused
beeper presence --chat 10313 --duration 5
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper contacts list`
List contacts

```sh
beeper contacts list
```

List merged contacts for a specific account with cursor-based pagination.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to Account ID, network, bridge, or account user |
| `--ids` | boolean | Print only contact user IDs |
| `--limit=<value>` | option | Maximum contacts to print Default: 50 |
| `--query=<value>` | option | Optional blended contact lookup query |

Examples:

```sh
beeper contacts list --account whatsapp --query alice
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper contacts search`
Search contacts

```sh
beeper contacts search <query>
```

Search contacts on a specific account using merged account contacts, network search, and exact identifier lookup.

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `query` | yes | Contact search query |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Account ID, network, bridge, or account user. Omit to search every account. |

Examples:

```sh
beeper contacts search alice
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper contacts show`
Show contact details

```sh
beeper contacts show <id>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `id` | yes | Contact user ID, display name, or phone/handle |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to account ID, network, bridge, or account user |

Examples:

```sh
beeper contacts show "Alice" --account whatsapp
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper media download`
Download message media

```sh
beeper media download <url>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `url` | yes | mxc:// or localmxc:// URL |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `-o, --out=<value>` | option | Output directory; pass - to stream the file to stdout Default: . |

Examples:

```sh
beeper media download mxc://beeper.com/abc --out ./downloads
beeper media download mxc://beeper.com/abc -o - > photo.jpg
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper export`
Export accounts, chats, messages, Markdown transcripts, and attachments

```sh
beeper export
```

Creates a resumable Beeper Desktop export using the official Desktop API SDK. The export directory contains accounts.json, chats.json, manifest.json, and one directory per chat with chat.json, messages.json, messages.markdown, messages.html, downloaded attachments, and checkpoint state for interrupted runs.

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--account=<value>...` | option | Limit to an account selector. Repeat to include more accounts. |
| `--chat=<value>...` | option | Limit to a chat selector. Repeat to include more chats. |
| `--force` | boolean | Re-export chats even if checkpoint state says they are complete. |
| `--limit-chats=<value>` | option | Maximum chats to export. Intended for testing large exports. |
| `--limit-messages=<value>` | option | Maximum messages per chat. Intended for testing large exports. |
| `--max-participants=<value>` | option | Maximum participants to include in each chat.json. Default: 500 |
| `--no-attachments` | boolean | Skip downloading message attachments. |
| `-o, --out=<value>` | option | Export directory. Default: beeper-export |
| `--pick=<value>` | option | Pick the Nth result when the selector is ambiguous (1-indexed) |

Examples:

```sh
beeper export --out ./beeper-export
beeper export --chat 10313 --out ./chat
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper watch`
Stream Desktop API WebSocket events

```sh
beeper watch
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `-c, --chat=<value>...` | option | Chat ID to subscribe to. Defaults to all chats. |
| `--exclude-type=<chat.upserted\|chat.deleted\|message.upserted\|message.deleted>...` | option | Drop events of these types. Repeat for multiple. |
| `--include-type=<chat.upserted\|chat.deleted\|message.upserted\|message.deleted>...` | option | Only forward events of these types. Repeat for multiple. |
| `--webhook=<value>` | option | Forward each event to this URL as a POST request (best-effort, fire-and-forget) |
| `--webhook-queue=<value>` | option | Maximum pending webhook deliveries before dropping events Default: 64 |
| `--webhook-secret=<value>` | option | HMAC-SHA256 secret. Signs payloads with X-Beeper-Signature: sha256=<hex> |

Examples:

```sh
beeper watch
beeper watch --chat 10313 --json
beeper watch --include-type message.upserted --include-type message.deleted
beeper watch --webhook https://example.com/hook --webhook-secret "$BEEPER_WEBHOOK_SECRET"
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper rpc`
Run newline-delimited JSON command RPC over stdin/stdout

```sh
beeper rpc
```

Reads JSON lines like {"id":1,"command":"send text --to 10313 --message hello"} or {"id":1,"args":["status","--json"]}.

Examples:

```sh
printf '{"id":1,"command":"chats list --json"}\n' | beeper rpc
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper man`
Print the command manual

```sh
beeper man
```

Examples:

```sh
beeper man
beeper man --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper doctor`
Probe the target live and report diagnostics

```sh
beeper doctor
```

Active reachability check plus readiness diagnostics. Exits non-zero when the target is not ready. For a cheap snapshot use `beeper status`.

Examples:

```sh
beeper doctor
beeper doctor --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper status`
Show selected target and setup readiness

```sh
beeper status
```

Read-only readiness snapshot for the selected target. For active reachability checks and diagnostics, run `beeper doctor`.

Examples:

```sh
beeper status
beeper status --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper docs`
Open Beeper CLI docs

```sh
beeper docs
```

Examples:

```sh
beeper docs
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper version`
Print CLI version

```sh
beeper version
```

Examples:

```sh
beeper version
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper completion`
Print shell completion setup

```sh
beeper completion [shell]
```

Print static shell completion setup for bash, zsh, fish, or PowerShell. Pass `--semantic` to print a small supplementary snippet that adds live suggestions for `--chat`, `--to`, `--account`, and `--target` by calling back into `beeper _complete`. Source it after the static completion setup.

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `shell` | no | Shell to set up (bash, zsh, fish, or powershell) |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `-r, --refresh-cache` | boolean | Refresh the autocomplete cache before printing setup |
| `--semantic` | boolean | Print a semantic-completion snippet (chats/accounts/targets) for bash or zsh |

Examples:

```sh
beeper completion
```

### `beeper plugins`
Manage Beeper CLI plugins

```sh
beeper plugins
```

List recommended Beeper CLI plugins, or use oclif plugin commands to install, link, update, and remove plugins.

Examples:

```sh
beeper plugins
beeper plugins install @beeper/cli-plugin-cloudflare
```

### `beeper plugins available`
List recommended optional Beeper CLI plugins

```sh
beeper plugins available
```

Examples:

```sh
beeper plugins available
beeper plugins available --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper update`
Check and install Beeper updates

```sh
beeper update
```

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--check` | boolean | Only check for updates; do not install |
| `--cli` | boolean | Check the Beeper CLI package |
| `--desktop` | boolean | Check the CLI-owned Desktop install |
| `--server` | boolean | Check the CLI-owned Server install |

Examples:

```sh
beeper update --check
beeper update --cli
beeper update --server
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper config get`
Print CLI configuration

```sh
beeper config get [key]
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `key` | no | Optional config key to print |

Examples:

```sh
beeper config get
beeper config get defaultTarget
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper config set`
Set a CLI configuration value

```sh
beeper config set <key> <value>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `key` | yes | Config key to set |
| `value` | yes | Config value (pass "" to clear) |

Examples:

```sh
beeper config set defaultTarget work
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper config path`
Print the CLI config path

```sh
beeper config path
```

Examples:

```sh
beeper config path
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper config reset`
Reset CLI configuration

```sh
beeper config reset
```

Examples:

```sh
beeper config reset
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper api get`
Call a raw Desktop API GET path

```sh
beeper api get <path>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `path` | yes | API path, for example /v1/info |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--no-auth` | boolean | Call a public API path without a bearer token |

Examples:

```sh
beeper api get /v1/info
beeper api get /v1/chats --json
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper api post`
Call a raw Desktop API POST path with a JSON body

```sh
beeper api post <path>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `path` | yes | API path, for example /v1/messages/{chatID}/send |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--body=<value>` | option | JSON request body Default: {} |
| `--no-auth` | boolean | Call a public API path without a bearer token |

Examples:

```sh
beeper api post /v1/chats/abc/read --body '{"messageID":"x"}'
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

### `beeper api request`
Call a raw Desktop API path with any supported HTTP method

```sh
beeper api request <method> <path>
```

Arguments:

| Name | Required | Description |
| --- | --- | --- |
| `method` | yes | HTTP method |
| `path` | yes | API path, for example /v1/info |

Flags:

| Flag | Type | Description |
| --- | --- | --- |
| `--body=<value>` | option | JSON request body |
| `--no-auth` | boolean | Call a public API path without a bearer token |

Examples:

```sh
beeper api request DELETE /v1/chats/abc/messages/def/reactions --body '{"reactionKey":"👍"}'
```

Global flags: `--base-url`, `--target`, `--debug`, `--events`, `--full`, `--json`, `--quiet`, `--read-only`, `--timeout`, `--yes`.

## Publishing

Beeper CLI releases ship signed macOS Bun binaries inside versioned archives and
a thin npm package that downloads, verifies, extracts, and runs the matching
GitHub Release archive.

For now, publishing runs from a local macOS machine:

```sh
bun run release 0.6.1
```

The local release command:

- builds standalone Bun binaries
- signs and notarizes macOS binaries when local signing credentials are available
- uploads versioned macOS and Linux archives to the GitHub release
- publishes `beeper-cli` to npm as a thin binary launcher package
- updates `beeper/homebrew-tap` with the pinned archive SHA

Required local credentials:

- GitHub CLI authenticated with release and tap access
- npm auth for publishing `beeper-cli`
- local Developer ID signing identity, or Fastlane match access via a
  `MOBILE_SECRETS_FILE` path exported in your shell
- `HOMEBREW_TAP_GITHUB_TOKEN` for updating the tap

## Inspiration

- [wacli](https://wacli.sh/) — scriptable WhatsApp CLI whose command-line product shape we borrow from.

## License

MIT — see [`packages/cli/LICENSE`](packages/cli/LICENSE).

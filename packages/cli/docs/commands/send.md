# beeper send
Send a text message
## Usage
```sh
beeper send [<to>] [<message> ...] [flags]
```
## Arguments

| Name | Description |
| --- | --- |
| `[<to>]` | Chat selector. Used when --to is omitted. |
| `[<message> ...]` | Message text. Used when --message and --message-file are omitted. |

## Flags

| Name | Description |
| --- | --- |
| `--to=STRING` | Chat selector |
| `--pick=INTEGER` | Pick the Nth result when selector is ambiguous |
| `--reply-to=STRING` | Send as a reply to this message ID |
| `--reply-to-sender=STRING` | Accepted for compatibility; Beeper replies only need --reply-to |
| `--wait` | Wait until the message leaves pending state Default: `false`. |
| `--wait-timeout=30000` | Maximum wait time in ms when --wait is set Default: `30000`. |
| `--post-send-wait=STRING` | Compatibility alias for waiting after send, for example 2s or 500ms; 0 disables waiting |
| `--message=STRING` | Message text to send |
| `--message-escapes` | Interpret backslash escapes in --message Default: `false`. |
| `--message-file=STRING` | Read message text from a file path; '-' reads stdin |
| `--mention=STRING` | User ID to mention Repeatable. |
| `--no-preview` | Disable automatic link preview Default: `false`. |
| `--ephemeral` | Send with this chat's disappearing-message timer Default: `false`. |
| `--ephemeral-duration=STRING` | Set the chat disappearing-message timer before sending, for example 24h, 7d, 90d, or 168h |

## Global Flags

| Name | Description |
| --- | --- |
| `-h, --help` | Show context-sensitive help Default: `false`. |
| `--color="auto"` | Color output: auto\|always\|never Default: `auto`. Values: `auto`, `always`, `never`. Env: `BEEPER_COLOR`. |
| `--home=STRING, --store` | Override Beeper CLI config/data/state/cache root Env: `BEEPER_HOME`, `BEEPER_STORE_DIR`, `BEEPER_CLI_CONFIG_DIR`. |
| `-a, --account=STRING, --acct` | Account selector for account-aware commands Env: `BEEPER_ACCOUNT`. Repeatable. |
| `--access-token=STRING` | Use provided access token directly (bypasses stored target auth) Env: `BEEPER_ACCESS_TOKEN`. |
| `--enable-commands=STRING` | Comma-separated enabled command prefixes; dot paths allowed Env: `BEEPER_ENABLE_COMMANDS`. |
| `--enable-commands-exact=STRING` | Comma-separated exact enabled commands; parent commands do not enable children Env: `BEEPER_ENABLE_COMMANDS_EXACT`. |
| `--disable-commands=STRING` | Comma-separated command prefixes to block; dot paths allowed Env: `BEEPER_DISABLE_COMMANDS`. |
| `-j, --json, --machine` | Output JSON to stdout (best for scripting) Default: `false`. Env: `BEEPER_JSON`. |
| `-p, --plain, --tsv` | Output stable, parseable text to stdout (TSV-like; no colors) Default: `false`. Env: `BEEPER_PLAIN`. |
| `--wrap-untrusted` | In JSON/raw output, wrap fetched text fields in untrusted-content markers Default: `false`. Env: `BEEPER_WRAP_UNTRUSTED`. |
| `--results-only` | In JSON mode, emit only the primary result Default: `false`. |
| `--select=STRING, --fields, --project` | In JSON mode, select comma-separated fields; dot paths allowed Env: `BEEPER_SELECT`, `BEEPER_FIELDS`, `BEEPER_PROJECT`. |
| `-n, --dry-run, --dryrun, --noop, --preview` | Do not make changes; print intended actions and exit successfully Default: `false`. Env: `BEEPER_DRY_RUN`. |
| `-y, --force, --assume-yes, --yes` | Skip confirmations for destructive commands Default: `false`. |
| `--no-input, --non-interactive, --noninteractive` | Never prompt; fail instead (useful for CI) Default: `false`. |
| `-v, --verbose, --debug` | Enable verbose logging Default: `false`. Env: `BEEPER_DEBUG`. |
| `--version` | Print version and exit Default: `false`. |
| `--events` | Emit machine-readable NDJSON lifecycle events on stderr Default: `false`. Env: `BEEPER_EVENTS`. |
| `--full` | Disable truncation in human table output Default: `false`. |
| `--lock-wait=STRING` | Accepted for compatibility; Beeper CLI does not use a local store lock |
| `--read-only, --readonly` | Reject commands that intentionally write Beeper or local CLI state Default: `false`. Env: `BEEPER_READONLY`. |
| `--safety-profile=STRING` | Safety profile name or YAML path |
| `--target=STRING` | Target name or URL Env: `BEEPER_TARGET`. |
| `--timeout=STRING` | Command timeout, for example 30s, 2m, 5m0s, or 1h30m Env: `BEEPER_TIMEOUT`. |

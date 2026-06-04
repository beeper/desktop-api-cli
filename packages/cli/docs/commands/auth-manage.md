# beeper auth manage
Make the selected target ready for messaging
## Usage
```sh
beeper auth manage (auth setup,auth connect) [flags]
```
## Aliases

- `beeper auth setup`
- `beeper auth connect`

## Flags

| Name | Description |
| --- | --- |
| `--local` | Use the local Beeper Desktop session on this device Default: `false`. |
| `--oauth` | Authorize the target with browser OAuth/PKCE Default: `false`. |
| `--remote=STRING` | Connect to a remote Beeper Desktop or Server URL |
| `--server` | Set up a local Beeper Server target Default: `false`. |
| `--desktop` | Set up a local Beeper Desktop target Default: `false`. |
| `--install` | Allow installing a missing local runtime Default: `false`. |
| `--channel="stable"` | Install release channel Default: `stable`. Values: `stable`, `nightly`. |
| `--server-env="prod"` | Server environment Default: `prod`. Values: `local`, `dev`, `staging`, `prod`. |
| `--email=STRING` | Sign in with an email address |
| `--username=STRING` | Username to use if setup creates a new account |

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

## Examples

```sh
beeper auth manage
```
```sh
beeper auth manage --local
```
```sh
beeper auth manage --oauth
```

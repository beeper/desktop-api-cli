# beeper config unset
Unset a config value
## Usage
```sh
beeper config unset (config rm,config del,config remove) <key> [flags]
```
## Aliases

- `beeper config rm`
- `beeper config del`
- `beeper config remove`

## Arguments

| Name | Description |
| --- | --- |
| `<key>` | Config key to unset |

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

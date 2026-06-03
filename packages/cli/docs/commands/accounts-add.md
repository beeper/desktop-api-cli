# beeper accounts add
Connect a chat account by bridge
## Usage
```sh
beeper accounts add [bridge] [flags]
```
## Arguments

| Name | Description |
| --- | --- |
| `[bridge]` |  |

## Flags

| Name | Description |
| --- | --- |
| `--cookie <value>` | Cookie value in name=value form Repeatable. |
| `--field <value>` | Field value in id=value form Repeatable. |
| `--flow <value>` | Login flow ID |
| `--guided` | Prompt through login steps Default: `true`. |
| `--login-id <value>` | Existing login ID to re-login as |
| `--webview` | Use Bun.WebView for cookie login steps Default: `false`. |
| `--webview-backend <value>` | Bun.WebView backend Default: `chrome`. Values: `auto`, `chrome`, `webkit`. |
| `--webview-timeout <value>` | Seconds to wait for WebView cookie collection Default: `120`. |

## Global Flags

| Name | Description |
| --- | --- |
| `--access-token <value>` | Use provided access token directly Env: `BEEPER_ACCESS_TOKEN`. |
| `-a, --account <value>, --acct` | Account selector for account-aware commands Repeatable. |
| `--color <value>` | Color output: auto\|always\|never Default: `auto`. Values: `auto`, `always`, `never`. |
| `--debug` | Default: `false`. |
| `--disable-commands <value>` | Comma-separated command prefixes to block |
| `-n, --dry-run, --dryrun, --noop, --preview` | Do not make changes; print intended actions Default: `false`. |
| `--enable-commands <value>` | Comma-separated enabled command prefixes |
| `--enable-commands-exact <value>` | Comma-separated exact enabled commands |
| `--events` | Default: `false`. |
| `-y, --force, --assume-yes, --yes` | Skip confirmations for destructive commands Default: `false`. |
| `--full` | Disable truncation in human table output Default: `false`. |
| `--home <value>` | Override Beeper CLI config/data root Env: `BEEPER_CLI_CONFIG_DIR`. |
| `-j, --json, --machine` | Output JSON to stdout Default: `false`. |
| `--no-input, --non-interactive, --noninteractive` | Never prompt; fail instead Default: `false`. |
| `-p, --plain, --tsv` | Output stable TSV-like text Default: `false`. |
| `--read-only` | Reject commands that intentionally write Default: `false`. Env: `BEEPER_READONLY`. |
| `--results-only` | In JSON mode, emit only the primary result Default: `false`. |
| `--safety-profile <value>` | Safety profile name or YAML path |
| `--select <value>, --fields, --project` | Select comma-separated JSON fields |
| `--target <value>` | Target name or URL |
| `--timeout <value>` | Command timeout, for example 30s or 2m |
| `-v, --version` | Print version and exit Default: `false`. |
| `--wrap-untrusted` | Wrap fetched text fields in untrusted-content markers Default: `false`. |

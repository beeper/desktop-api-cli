# beeper chats list
List chats
## Usage
```sh
beeper chats list [flags]
```
## Aliases

- `beeper chats ls`

## Flags

| Name | Description |
| --- | --- |
| `-a, --account <value>, --acct` | Limit to account selector Repeatable. |
| `--archived` | Only archived chats; use --no-archived to exclude |
| `--ids` | Print preferred chat selectors Default: `false`. |
| `--limit <value>` | Maximum chats to print Default: `20`. |
| `--low-priority` | Only low-priority chats; use --no-low-priority to exclude |
| `--muted` | Only muted chats; use --no-muted to exclude |
| `--pinned` | Only pinned chats; use --no-pinned to exclude |
| `--query <value>` | Optional chat lookup query |
| `--unread` | Only unread chats; use --no-unread to exclude |

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

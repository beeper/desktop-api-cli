# beeper messages search
Search messages across chats
## Usage
```sh
beeper messages search [query] [flags]
```
## Aliases

- `beeper messages find`

## Arguments

| Name | Description |
| --- | --- |
| `[query]` |  |

## Flags

| Name | Description |
| --- | --- |
| `-a, --account <value>, --acct` | Limit to account selector Repeatable. |
| `--chat <value>` | Limit to a chat selector Repeatable. |
| `--chat-type <value>` | Only group chats or direct messages Values: `group`, `single`. |
| `--after <value>` | Only messages at or after this ISO timestamp |
| `--before <value>` | Only messages at or before this ISO timestamp |
| `--exclude-low-priority` | Exclude low-priority chats |
| `--ids` | Print only message IDs Default: `false`. |
| `--include-muted` | Include muted chats Default: `true`. |
| `--limit <value>, --max` | Maximum results Default: `50`. |
| `--media <value>` | Filter by media type Values: `any`, `video`, `image`, `link`, `file`. Repeatable. |
| `--sender <value>` | me, others, or a user ID |
| `--fail-empty, --non-empty, --require-results` | Exit with code 3 if no results Default: `false`. |

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

## Examples

```sh
beeper messages search "quarterly report"
```
```sh
beeper messages search --chat "Work" --sender me --limit 20
```

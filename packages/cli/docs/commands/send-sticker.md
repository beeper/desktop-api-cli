# beeper send sticker
Send a sticker
## Usage
```sh
beeper send sticker [flags]
```
## Flags

| Name | Description |
| --- | --- |
| `--to <value>` | Chat selector Required. |
| `--pick <value>` | Pick the Nth result when selector is ambiguous |
| `--reply-to <value>` | Send as a reply to this message ID |
| `--wait` | Wait until the message leaves pending state Default: `false`. |
| `--wait-timeout <value>` | Maximum wait time in ms when --wait is set Default: `30000`. |
| `--file <value>` | Local sticker file path to upload Required. |
| `--filename <value>` | Override displayed filename |
| `--mime <value>` | Override MIME type |

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

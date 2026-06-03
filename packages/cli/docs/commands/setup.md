# beeper setup
Make the selected target ready for messaging
## Usage
```sh
beeper setup [flags]
```
## Flags

| Name | Description |
| --- | --- |
| `--local` | Use the local Beeper Desktop session on this device Default: `false`. |
| `--oauth` | Authorize the target with browser OAuth/PKCE Default: `false`. |
| `--remote <value>` | Connect to a remote Beeper Desktop or Server URL |
| `--server` | Set up a local Beeper Server target Default: `false`. |
| `--desktop` | Set up a local Beeper Desktop target Default: `false`. |
| `--install` | Allow installing a missing local runtime Default: `false`. |
| `--channel <value>` | Install release channel Default: `stable`. Values: `stable`, `nightly`. |
| `--server-env <value>` | Server environment Default: `prod`. Values: `local`, `dev`, `staging`, `prod`. |
| `--email <value>` | Sign in with an email address |
| `--username <value>` | Username to use if setup creates a new account |

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
beeper setup
```
```sh
beeper setup --local
```
```sh
beeper setup --remote https://desktop.example.com
```
```sh
beeper setup --desktop --install
```

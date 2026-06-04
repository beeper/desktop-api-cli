# beeper

Beeper CLI for Beeper Desktop and Beeper Server. It talks to a selected target,
keeps setup interactive, and exposes a scriptable command surface for humans,
shell scripts, and agents.

## Install

```sh
npm install -g beeper-cli
beeper --help
```

For source builds:

```sh
bun install
bun run check
bun packages/cli/bin/dev.js --help
```

## Quick Start

```sh
beeper setup
beeper targets list
beeper doctor
beeper status
beeper chats list --limit 10
beeper messages search "flight"
beeper send text --to "Family" --message "on my way"
```

`beeper setup` preserves the interactive setup flow: it discovers local Beeper
Desktop, can install or launch Desktop, can install and start Beeper Server,
and can adopt remote targets. Use `--no-input` when running non-interactively.

## Command Reference

The live command registry is the source of truth. Use:

```sh
beeper --help
beeper docs
beeper schema --json
beeper exit-codes --json
beeper <command> --help
```

Generated command docs live in [docs/commands/README.md](docs/commands/README.md)
and are rebuilt from the live registry with
`bun run --cwd packages/cli docs:commands`.

Current command groups:

- `setup`, `status` (`st`), `doctor`, `docs` (`help-docs`), `help`, `version`, `agent`, `exit-codes` (`agent exit-codes`, `agent exitcodes`, `agent exit-code`), `schema`
- `config get` (`config show`), `config keys` (`config list-keys`, `config names`), `config list` (`config ls`, `config all`), `config path` (`config where`), `config set` (`config add`, `config update`), `config unset` (`config rm`, `config del`, `config remove`)
- `accounts use` (`use account`, `account use`), `targets use` (`use target`, `target use`), `accounts remove` (`remove account`, `accounts rm`), `targets remove` (`remove target`, `targets rm`)
- `login`, `auth email start`, `auth email response`, `auth logout` (`logout`)
- `targets add`, `targets list` (`targets ls`), `targets runtime start`, `targets runtime stop`, `targets runtime restart`, `targets logs`, `targets tunnel`
- `install desktop`, `install server`
- `accounts add`, `accounts list`
- `chats list` (`chats ls`, `ls`, `list`), `chats show`, `chats start`, `chats archive`, `chats pin`, `chats mute`, `chats read`, `chats rename`, `chats description`, `chats avatar`, `chats priority`, `chats draft`, `chats remind`, `chats disappear`, `chats focus` (`open`, `focus`), `chats notify-anyway`
- `messages list` (`messages ls`), `messages search` (`messages find`, `search`, `find`), `messages context`, `messages edit`, `messages delete`
- `send text` (`message`, `msg`), `send file`, `send sticker`, `send voice`, `send react`, `send presence` (`presence`)
- `contacts list` (`contacts search`, `contacts find`)
- `media download` (`download`, `dl`), `export`, `watch`
- `api request`, `mcp`, `completion` (`completion bash`, `completion zsh`, `completion fish`, `completion powershell`)
- `resolve account`, `resolve bridge`, `resolve chat`, `resolve contact`, `resolve target`

## Global Flags

- Output: `--json`/`-j`/`BEEPER_JSON`, `BEEPER_AUTO_JSON` for piped stdout, `--plain`/`-p`/`--tsv`/`BEEPER_PLAIN`, `--select`/`--fields`/`--project`/`BEEPER_SELECT`/`BEEPER_FIELDS`/`BEEPER_PROJECT`, `--results-only`, `--full`, `--events`/`BEEPER_EVENTS`, `--verbose`/`-v`/`--debug`/`BEEPER_DEBUG`
- Targeting/config: `--target`/`BEEPER_TARGET`, `--account`/`-a`/`BEEPER_ACCOUNT`, `--home`/`--store`/`BEEPER_HOME`/`BEEPER_STORE_DIR`/`BEEPER_CLI_CONFIG_DIR`, `--access-token`
- Safety: `--dry-run`/`-n`/`BEEPER_DRY_RUN`, `--read-only`/`--readonly`/`BEEPER_READONLY`, `--timeout`/`BEEPER_TIMEOUT`, `--safety-profile`, `--enable-commands`/`BEEPER_ENABLE_COMMANDS`, `--enable-commands-exact`/`BEEPER_ENABLE_COMMANDS_EXACT`, `--disable-commands`/`BEEPER_DISABLE_COMMANDS`, `--wrap-untrusted`/`BEEPER_WRAP_UNTRUSTED`
- Interaction: `--no-input`, `--force`/`-y`

Human output uses stable tables and diagnostic summaries. Use `--json` for raw
objects, `--select=id,name` to project JSON fields, and `--plain` for TSV-like
text.

Durations accept compact forms like `500ms`, `30s`, `2m`, `5m0s`, and `1h30m`.

`mcp` exposes a curated read-only tool set by default. Use `mcp --list-tools`
to inspect canonical tool names such as `messages_search`, `messages_context`,
and `targets_list`. Use `mcp --allow-tool messages.*` or
`mcp --allow-tool targets_list` to restrict it. Use `mcp --allow-write` only
when the curated write tools (`send_text`, `send_react`, `chats_read`, and
`messages_edit`) should be available. The default transport is stdio; use
`mcp --transport http` to run a Streamable HTTP server on
`http://127.0.0.1:7331/mcp`, with `--http-host`, `--http-port`, and
`--http-path` available for binding changes.

## Targets

A target is the endpoint the CLI talks to. It can be local Desktop, local
Server, or a remote Desktop/Server.

```sh
beeper setup --desktop
beeper setup --server --install
beeper targets add work https://desktop.example.com --default
beeper targets tunnel work --url-only
```

## Safety Profiles

Safety profiles live in `packages/cli/safety-profiles/`:

- `readonly.yaml`: blocks mutating commands.
- `agent-safe.yaml`: allows common read and messaging workflows, blocks high-risk operations.
- `full.yaml`: leaves command policy unrestricted.

Use them with:

```sh
beeper --safety-profile packages/cli/safety-profiles/readonly.yaml chats list
```

## Development

```sh
bun --filter beeper-cli run typecheck
bun --filter beeper-cli run test
bun --filter beeper-cli run build
bun run check
```

In this repository checkout, the direct package form also works:

```sh
bun run --cwd packages/cli typecheck
bun run --cwd packages/cli docs:commands
bun run --cwd packages/cli test
bun run --cwd packages/cli build
```

The package entrypoint is `packages/cli/bin/cli.js`; local development uses
`packages/cli/bin/dev.js`.

## License

MIT. See `LICENSE`.

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
beeper schema --json
beeper exit-codes --json
beeper <command> --help
```

Generated command docs live in [docs/commands/README.md](docs/commands/README.md)
and are rebuilt from the live registry with
`bun run --cwd packages/cli docs:commands`.

Current command groups:

- `setup`, `status` (`st`), `doctor`, `version`, `exit-codes`, `schema`
- `config get` (`config show`), `config keys` (`config list-keys`, `config names`), `config list` (`config ls`, `config all`), `config path` (`config where`), `config set` (`config add`, `config update`), `config unset` (`config rm`, `config del`, `config remove`)
- `use account` (`accounts use`), `use target` (`targets use`), `remove account` (`accounts remove`, `accounts rm`), `remove target` (`targets remove`, `targets rm`)
- `auth email start`, `auth email response`, `auth logout`
- `targets add`, `targets list` (`targets ls`), `targets runtime start`, `targets runtime stop`, `targets runtime restart`, `targets logs`, `targets tunnel`
- `install desktop`, `install server`
- `accounts add`, `accounts list`
- `chats list` (`chats ls`), `chats show`, `chats start`, `chats archive`, `chats pin`, `chats mute`, `chats read`, `chats rename`, `chats description`, `chats avatar`, `chats priority`, `chats draft`, `chats remind`, `chats disappear`, `chats focus`, `chats notify-anyway`
- `messages list` (`messages ls`), `messages search` (`messages find`), `messages context`, `messages edit`, `messages delete`
- `send text`, `send file`, `send sticker`, `send voice`, `send react`, `send presence`
- `contacts list` (`contacts search`, `contacts find`)
- `media download`, `export`, `watch`
- `api request`, `mcp`, `completion`
- `resolve account`, `resolve bridge`, `resolve chat`, `resolve contact`, `resolve target`

## Global Flags

- Output: `--json`/`-j`, `--plain`/`-p`/`--tsv`, `--select`/`--fields`, `--results-only`, `--full`, `--events`, `--debug`
- Targeting/config: `--target`, `--account`/`-a`, `--home`, `--access-token`
- Safety: `--dry-run`/`-n`, `--read-only`/`BEEPER_READONLY`, `--timeout`, `--safety-profile`, `--enable-commands`, `--enable-commands-exact`, `--disable-commands`, `--wrap-untrusted`
- Interaction: `--no-input`, `--force`/`-y`

Human output uses stable tables and diagnostic summaries. Use `--json` for raw
objects, `--select=id,name` to project JSON fields, and `--plain` for TSV-like
text.

`mcp` exposes read-only tools by default. Use `mcp --list-tools` to inspect the
enabled tool set, `mcp --allow-tool messages.*` to restrict it, and
`mcp --allow-write` only when write-risk tools should be available.

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

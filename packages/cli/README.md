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
bun --filter beeper-cli run dev -- --help
```

## Quick Start

```sh
beeper setup
beeper targets list
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
beeper <command> --help
```

Current command groups:

- `setup`, `status`, `version`, `schema`
- `use account`, `use target`, `remove account`, `remove target`
- `auth email start`, `auth email response`, `auth logout`
- `targets add`, `targets list`, `targets runtime start`, `targets runtime stop`, `targets runtime restart`, `targets logs`, `targets tunnel`
- `install desktop`, `install server`
- `accounts add`, `accounts list`
- `chats list`, `chats show`, `chats start`, `chats archive`, `chats pin`, `chats mute`, `chats read`, `chats rename`, `chats description`, `chats avatar`, `chats priority`, `chats draft`, `chats remind`, `chats disappear`, `chats focus`, `chats notify-anyway`
- `messages list`, `messages search`, `messages context`, `messages edit`, `messages delete`
- `send text`, `send file`, `send sticker`, `send voice`, `send react`, `send presence`
- `contacts list`
- `media download`, `export`, `watch`
- `api request`, `mcp`
- `resolve account`, `resolve bridge`, `resolve chat`, `resolve contact`, `resolve target`

## Global Flags

- Output: `--json`, `--plain`, `--events`, `--debug`
- Targeting: `--target`
- Safety: `--dry-run`, `--safety-profile`, `--wrap-untrusted`
- Interaction: `--no-input`, `--force`

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

The package entrypoint is `packages/cli/bin/cli.js`; local development uses
`packages/cli/bin/dev.js`.

## License

MIT. See `LICENSE`.

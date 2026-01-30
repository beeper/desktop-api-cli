# Beeper Desktop CLI

The official CLI for the [Beeper Desktop REST API](https://developers.beeper.com/desktop-api/).

<!-- x-release-please-start-version -->

## Installation

### Installing with Go

To test or install the CLI locally, you need [Go](https://go.dev/doc/install) version 1.22 or later installed.

```sh
go install 'github.com/beeper/desktop-api-cli/cmd/beeper-desktop-api@latest'
```

Once you have run `go install`, the binary is placed in your Go bin directory:

- **Default location**: `$HOME/go/bin` (or `$GOPATH/bin` if GOPATH is set)
- **Check your path**: Run `go env GOPATH` to see the base directory

If commands aren't found after installation, add the Go bin directory to your PATH:

```sh
# Add to your shell profile (.zshrc, .bashrc, etc.)
export PATH="$PATH:$(go env GOPATH)/bin"
```

<!-- x-release-please-end -->

### Running Locally

After cloning the git repository for this project, you can use the
`scripts/run` script to run the tool locally:

```sh
./scripts/run args...
```

## Usage

The CLI follows a resource-based command structure:

```sh
beeper-desktop-api [resource] [command] [flags]
```

```sh
beeper-desktop-api chats search \
  --account-id local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc \
  --account-id local-telegram_ba_QFrb5lrLPhO3OT5MFBeTWv0x4BI \
  --cursor '1725489123456|c29tZUltc2dQYWdl' \
  --direction before \
  --inbox primary \
  --include-muted \
  --last-activity-after 2019-12-27T18:11:19.117Z \
  --last-activity-before 2019-12-27T18:11:19.117Z \
  --limit 3 \
  --query x \
  --scope titles \
  --type single \
  --unread-only
```

For details about specific commands, use the `--help` flag.

## Global Flags

- `--help` - Show command line usage
- `--debug` - Enable debug logging (includes HTTP request/response details)
- `--version`, `-v` - Show the CLI version
- `--base-url` - Use a custom API backend URL
- `--format` - Change the output format (`auto`, `explore`, `json`, `jsonl`, `pretty`, `raw`, `yaml`)
- `--format-error` - Change the output format for errors (`auto`, `explore`, `json`, `jsonl`, `pretty`, `raw`, `yaml`)
- `--transform` - Transform the data output using [GJSON syntax](https://github.com/tidwall/gjson/blob/master/SYNTAX.md)
- `--transform-error` - Transform the error output using [GJSON syntax](https://github.com/tidwall/gjson/blob/master/SYNTAX.md)

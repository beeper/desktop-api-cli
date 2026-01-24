# Beeper Desktop CLI

The official CLI for the [Beeper Desktop REST API](https://developers.beeper.com/desktop-api/).

<!-- x-release-please-start-version -->

## Installation

### Installing with Go

```sh
go install 'github.com/beeper/desktop-api-cli/cmd/beeper-desktop-api@latest'
```

<!-- x-release-please-end -->

### Running Locally

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

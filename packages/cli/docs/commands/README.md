# Command Index

Generated from the live command registry. Do not edit command pages by hand.

## Root Commands

| Usage | Description |
| --- | --- |
| `beeper message (msg) [<to>] [<message> ...] [flags]` | Send a text message (alias for 'beeper send text') |
| `beeper ls (list) [flags]` | List chats (alias for 'beeper chats list') |
| `beeper search (find) [<query>] [flags]` | Search messages across chats (alias for 'beeper messages search') |
| `beeper open (browse,focus) [<chat>] [flags]` | Focus a chat in Beeper (alias for 'beeper chats focus') |
| `beeper download (dl) [<url>] [flags]` | Download message media (alias for 'beeper media download') |
| `beeper upload (up,put) <localPath> [flags]` | Send a file message |
| `beeper login (auth add,auth login) <email> [flags]` | Start email sign-in for a target |
| `beeper logout [<target>] [flags]` | Clear stored authentication (alias for 'beeper auth logout') |
| `beeper status (st) [<target>] [flags]` | Show auth, config, selected target, and setup readiness |
| `beeper me (whoami,who-am-i) [flags]` | Show selected account and target identity |
| `beeper whoami (who-am-i) [flags]` | Show selected account and target identity (alias for 'beeper me') |
| `beeper setup [flags]` | Make the selected target ready for messaging |
| `beeper send [<to>] [<message> ...] [flags]` | Send a text message |
| `beeper chats (chat) <command> [flags]` | List and manage chats |
| `beeper messages <command> [flags]` | List, search, edit, and delete messages |
| `beeper accounts (account) <command> [flags]` | Manage connected chat accounts |
| `beeper contacts (contact) <command> [flags]` | List and search contacts |
| `beeper presence <command> [flags]` | Send presence indicators |
| `beeper media <command> [flags]` | Download message media |
| `beeper targets (target) <command> [flags]` | Manage Beeper Desktop and Server targets |
| `beeper resolve <command> [flags]` | Resolve Beeper selectors |
| `beeper export [flags]` | Export accounts, chats, messages, transcripts, and attachments |
| `beeper watch [flags]` | Stream Desktop API WebSocket events |
| `beeper doctor (auth doctor) [flags]` | Run diagnostics for config, target reachability, auth, and readiness |
| `beeper auth <command> [flags]` | Authenticate and manage stored credentials |
| `beeper install <command> [flags]` | Install Beeper Desktop or Beeper Server |
| `beeper api <command> [flags]` | Call raw Beeper Desktop API endpoints |
| `beeper config <command> [flags]` | Manage configuration |
| `beeper docs (help-docs) [flags]` | Print command documentation locations |
| `beeper schema (help-json,helpjson) [<command> ...] [flags]` | Machine-readable command/flag schema |
| `beeper mcp [flags]` | Run a typed, allowlisted MCP server over stdio or HTTP |
| `beeper agent <command> [flags]` | Agent-friendly helpers |
| `beeper exit-codes (agent exit-codes,agent exitcodes,agent exit-code,exitcodes) [flags]` | Print stable exit codes for automation |
| `beeper completion <shell> [flags]` | Generate shell completion scripts |
| `beeper help [<command> ...] [flags]` | Show help for a command |
| `beeper version [flags]` | Print version |
| `beeper groups <command> [flags]` | groups commands |
| `beeper search-all (find-all) <query> [flags]` | Search chats, group participants, and messages together (alias for 'beeper search all') |

## Full Command Reference

| Command | Description | Aliases |
| --- | --- | --- |
| [`accounts add`](accounts-add.md) | Connect a chat account by bridge | `accounts create`, `accounts new`, `account add`, `account create`, `account new` |
| [`accounts list`](accounts-list.md) | List connected accounts | `accounts ls`, `account list`, `account ls` |
| [`accounts remove`](accounts-remove.md) | Remove an account | `accounts rm`, `accounts del`, `remove account`, `account remove`, `account rm`, `account del` |
| [`accounts show`](accounts-show.md) | Show one connected account | `accounts get`, `accounts info`, `account show`, `account get`, `account info` |
| [`accounts use`](accounts-use.md) | Select the default account | `use account`, `account use` |
| [`agent`](agent.md) | Agent-friendly helpers |  |
| [`api request`](api-request.md) | Call a raw Desktop API path with any supported HTTP method |  |
| [`auth email response`](auth-email-response.md) | Finish email sign-in for a target |  |
| [`auth email start`](auth-email-start.md) | Start email sign-in for a target |  |
| [`auth list`](auth-list.md) | List stored target credentials | `auth ls` |
| [`auth logout`](auth-logout.md) | Clear stored authentication | `logout`, `auth remove`, `auth rm`, `auth del` |
| [`auth manage`](auth-manage.md) | Make the selected target ready for messaging | `auth setup`, `auth connect` |
| [`auth services`](auth-services.md) | List supported account login services and bridges | `auth bridges` |
| [`auth status`](auth-status.md) | Show auth configuration and stored target credential status |  |
| [`chats archive`](chats-archive.md) | Archive or unarchive a chat | `chat archive` |
| [`chats avatar`](chats-avatar.md) | Set or clear a chat avatar | `chat avatar` |
| [`chats description`](chats-description.md) | Set or clear a chat description | `chat description` |
| [`chats disappear`](chats-disappear.md) | Set a disappearing-message timer | `chat disappear` |
| [`chats draft`](chats-draft.md) | Set or clear a chat draft | `chat draft` |
| [`chats focus`](chats-focus.md) | Focus a chat in Beeper | `chat focus`, `open`, `browse`, `focus` |
| [`chats list`](chats-list.md) | List chats | `chats ls`, `chat list`, `chat ls`, `ls`, `list` |
| [`chats mark-read`](chats-mark-read.md) | Mark a chat as read | `chat mark-read` |
| [`chats mark-unread`](chats-mark-unread.md) | Mark a chat as unread | `chat mark-unread` |
| [`chats mute`](chats-mute.md) | Mute or unmute a chat | `chat mute` |
| [`chats notify-anyway`](chats-notify-anyway.md) | Notify a chat anyway | `chat notify-anyway` |
| [`chats pin`](chats-pin.md) | Pin or unpin a chat | `chat pin` |
| [`chats priority`](chats-priority.md) | Set chat priority | `chat priority` |
| [`chats read`](chats-read.md) | Mark a chat read or unread | `chat read` |
| [`chats remind`](chats-remind.md) | Set or clear a chat reminder | `chat remind` |
| [`chats rename`](chats-rename.md) | Rename a chat | `chat rename` |
| [`chats show`](chats-show.md) | Show chat details | `chats info`, `chat show`, `chat info` |
| [`chats start`](chats-start.md) | Start a chat | `chat start` |
| [`chats unarchive`](chats-unarchive.md) | Unarchive a chat | `chat unarchive` |
| [`chats unmute`](chats-unmute.md) | Unmute a chat | `chat unmute` |
| [`chats unpin`](chats-unpin.md) | Unpin a chat | `chat unpin` |
| [`completion`](completion.md) | Generate shell completion scripts |  |
| [`completion bash`](completion-bash.md) | Generate the autocompletion script for bash |  |
| [`completion fish`](completion-fish.md) | Generate the autocompletion script for fish |  |
| [`completion powershell`](completion-powershell.md) | Generate the autocompletion script for powershell | `completion pwsh` |
| [`completion zsh`](completion-zsh.md) | Generate the autocompletion script for zsh |  |
| [`config get`](config-get.md) | Get a config value | `config show` |
| [`config keys`](config-keys.md) | List available config keys | `config list-keys`, `config names` |
| [`config list`](config-list.md) | List all config values | `config ls`, `config all` |
| [`config path`](config-path.md) | Print config file path | `config where` |
| [`config set`](config-set.md) | Set a config value | `config add`, `config update` |
| [`config unset`](config-unset.md) | Unset a config value | `config rm`, `config del`, `config remove` |
| [`contacts list`](contacts-list.md) | List contacts | `contacts ls`, `contacts search`, `contacts find`, `contact list`, `contact ls`, `contact search`, `contact find` |
| [`contacts show`](contacts-show.md) | Show one contact | `contacts get`, `contacts info`, `contact show`, `contact get`, `contact info` |
| [`docs`](docs.md) | Print command documentation locations | `help-docs` |
| [`doctor`](doctor.md) | Run diagnostics for config, target reachability, auth, and readiness | `auth doctor` |
| [`exit-codes`](exit-codes.md) | Print stable exit codes for automation | `agent exit-codes`, `agent exitcodes`, `agent exit-code`, `exitcodes` |
| [`export`](export.md) | Export accounts, chats, messages, transcripts, and attachments |  |
| [`groups create`](groups-create.md) | Create a group chat | `groups add`, `groups new`, `group create`, `group add`, `group new` |
| [`groups description`](groups-description.md) | Set or clear a group description | `groups topic`, `group description`, `group topic` |
| [`groups list`](groups-list.md) | List group chats | `groups ls`, `group list`, `group ls` |
| [`groups rename`](groups-rename.md) | Rename a group | `group rename` |
| [`groups show`](groups-show.md) | Show group details | `groups info`, `group show`, `group info` |
| [`help`](help.md) | Show help for a command |  |
| [`install desktop`](install-desktop.md) | Install Beeper Desktop locally |  |
| [`install server`](install-server.md) | Install Beeper Server locally |  |
| [`login`](login.md) | Start email sign-in for a target | `auth add`, `auth login` |
| [`mcp`](mcp.md) | Run a typed, allowlisted MCP server over stdio or HTTP |  |
| [`me`](me.md) | Show selected account and target identity | `whoami`, `who-am-i` |
| [`media download`](media-download.md) | Download message media | `media dl`, `download`, `dl` |
| [`media message`](media-message.md) | Download media for a message |  |
| [`messages context`](messages-context.md) | Show a message with surrounding context |  |
| [`messages delete`](messages-delete.md) | Delete a message | `messages rm`, `messages del`, `messages remove` |
| [`messages edit`](messages-edit.md) | Edit a message | `messages update`, `messages set` |
| [`messages export`](messages-export.md) | Export messages as JSON |  |
| [`messages forward`](messages-forward.md) | Forward a message |  |
| [`messages list`](messages-list.md) | List chat messages | `messages ls` |
| [`messages revoke`](messages-revoke.md) | Delete a sent message for everyone |  |
| [`messages search`](messages-search.md) | Search messages across chats | `messages find`, `search`, `find` |
| [`messages show`](messages-show.md) | Show one message | `messages get`, `messages info` |
| [`presence`](presence.md) | Send presence indicators |  |
| [`presence paused`](presence-paused.md) | Send a 'paused' indicator (stop typing) to a chat |  |
| [`presence typing`](presence-typing.md) | Send a 'composing' (typing) indicator to a chat |  |
| [`resolve account`](resolve-account.md) | Resolve an account selector |  |
| [`resolve bridge`](resolve-bridge.md) | Resolve a bridge selector |  |
| [`resolve chat`](resolve-chat.md) | Resolve a chat selector |  |
| [`resolve contact`](resolve-contact.md) | Resolve a contact selector |  |
| [`resolve target`](resolve-target.md) | Resolve a target selector |  |
| [`schema`](schema.md) | Machine-readable command/flag schema | `help-json`, `helpjson` |
| [`search all`](search-all.md) | Search chats, group participants, and messages together | `search-all`, `find-all` |
| [`send`](send.md) | Send a text message |  |
| [`send file`](send-file.md) | Send a file message |  |
| [`send presence`](send-presence.md) | Send a typing indicator |  |
| [`send react`](send-react.md) | Send or remove a reaction | `send reaction` |
| [`send sticker`](send-sticker.md) | Send a sticker |  |
| [`send text`](send-text.md) | Send a text message | `message`, `msg` |
| [`send voice`](send-voice.md) | Send a voice note |  |
| [`setup`](setup.md) | Make the selected target ready for messaging |  |
| [`status`](status.md) | Show auth, config, selected target, and setup readiness | `st` |
| [`targets add`](targets-add.md) | Add a remote Beeper Desktop or Server target | `target add` |
| [`targets list`](targets-list.md) | List configured Beeper targets | `targets ls`, `target list`, `target ls` |
| [`targets logs`](targets-logs.md) | Print logs for a local Beeper Desktop or Server install | `target logs` |
| [`targets remove`](targets-remove.md) | Remove a target | `targets rm`, `targets del`, `remove target`, `target remove`, `target rm`, `target del` |
| [`targets runtime restart`](targets-runtime-restart.md) | Restart a local server runtime | `target runtime restart` |
| [`targets runtime start`](targets-runtime-start.md) | Start a local target runtime | `target runtime start` |
| [`targets runtime stop`](targets-runtime-stop.md) | Stop a local server runtime | `target runtime stop` |
| [`targets tunnel`](targets-tunnel.md) | Expose a target through Cloudflare Tunnel | `target tunnel` |
| [`targets use`](targets-use.md) | Select the default target | `use target`, `target use` |
| [`upload`](upload.md) | Send a file message | `up`, `put` |
| [`version`](version.md) | Print version |  |
| [`watch`](watch.md) | Stream Desktop API WebSocket events |  |

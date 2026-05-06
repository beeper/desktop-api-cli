// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"

	"github.com/beeper/desktop-api-cli/internal/apiquery"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
	"github.com/beeper/desktop-api-go"
	"github.com/beeper/desktop-api-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var chatsCreate = cli.Command{
	Name:    "create",
	Usage:   "Create a direct or group chat from participant IDs. Returns the created chat.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "account-id",
			Usage:    "Account to create or start the chat on.",
			Required: true,
			BodyPath: "accountID",
		},
		&requestflag.Flag[[]string]{
			Name:     "participant-id",
			Usage:    "User IDs to include in the new chat.",
			Required: true,
			BodyPath: "participantIDs",
		},
		&requestflag.Flag[string]{
			Name:     "type",
			Usage:    "'single' requires exactly one participantID; 'group' supports multiple participants and optional title.",
			Required: true,
			BodyPath: "type",
		},
		&requestflag.Flag[string]{
			Name:     "message-text",
			Usage:    "Optional first message content if the platform requires it to create the chat.",
			BodyPath: "messageText",
		},
		&requestflag.Flag[string]{
			Name:     "title",
			Usage:    "Optional title for group chats; ignored for single chats on most networks.",
			BodyPath: "title",
		},
	},
	Action:          handleChatsCreate,
	HideHelpCommand: true,
}

var chatsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Retrieve chat details including metadata, participants, and latest message",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[*int64]{
			Name:      "max-participant-count",
			Usage:     "Maximum number of participants to return. Use -1 for all; otherwise 0-500. Defaults to 100. List and search endpoints return up to 20 participants per chat.",
			Default:   requestflag.Ptr[int64](100),
			QueryPath: "maxParticipantCount",
		},
	},
	Action:          handleChatsRetrieve,
	HideHelpCommand: true,
}

var chatsUpdate = requestflag.WithInnerFlags(cli.Command{
	Name:    "update",
	Usage:   "Update supported chat fields. Non-empty draft objects are accepted only when the\ncurrent draft is empty. Send draft=null to clear the draft before setting new\ndraft text or attachments.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[*string]{
			Name:     "description",
			Usage:    "Group chat description/topic. Support depends on the chat account and chat permissions.",
			BodyPath: "description",
		},
		&requestflag.Flag[map[string]any]{
			Name:     "draft",
			Usage:    "Draft object to set or clear. Non-empty drafts are only accepted when the current draft is empty. Send draft=null to clear text and attachments together before setting a new draft.",
			BodyPath: "draft",
		},
		&requestflag.Flag[*string]{
			Name:     "img-url",
			Usage:    "Local filesystem path to a group chat avatar image. Support depends on the chat account and chat permissions.",
			BodyPath: "imgURL",
		},
		&requestflag.Flag[bool]{
			Name:     "is-archived",
			Usage:    "Archive or unarchive the chat.",
			BodyPath: "isArchived",
		},
		&requestflag.Flag[bool]{
			Name:     "is-low-priority",
			Usage:    "Mark or unmark the chat as low priority when supported by the account.",
			BodyPath: "isLowPriority",
		},
		&requestflag.Flag[bool]{
			Name:     "is-muted",
			Usage:    "Mute or unmute the chat.",
			BodyPath: "isMuted",
		},
		&requestflag.Flag[bool]{
			Name:     "is-pinned",
			Usage:    "Pin or unpin the chat when supported by the account.",
			BodyPath: "isPinned",
		},
		&requestflag.Flag[*int64]{
			Name:     "message-expiry-seconds",
			Usage:    "Disappearing-message timer in seconds, or null to clear when supported.",
			BodyPath: "messageExpirySeconds",
		},
		&requestflag.Flag[*string]{
			Name:     "title",
			Usage:    "Custom chat title. Support depends on the chat account and chat permissions.",
			BodyPath: "title",
		},
	},
	Action:          handleChatsUpdate,
	HideHelpCommand: true,
}, map[string][]requestflag.HasOuterFlag{
	"draft": {
		&requestflag.InnerFlag[string]{
			Name:       "draft.text",
			Usage:      "Draft text. Plain text and Markdown are converted to Matrix HTML with the same rules used by send and edit.",
			InnerField: "text",
		},
		&requestflag.InnerFlag[map[string]any]{
			Name:       "draft.attachments",
			Usage:      "Draft attachments keyed by attachment ID. Each attachment must reference an uploadID returned by the upload file endpoint.",
			InnerField: "attachments",
		},
	},
})

var chatsList = cli.Command{
	Name:    "list",
	Usage:   "List all chats sorted by last activity (most recent first). Combines all\naccounts into a single paginated list.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[[]string]{
			Name:      "account-id",
			Usage:     "Limit to specific account IDs. If omitted, fetches from all accounts.",
			QueryPath: "accountIDs",
		},
		&requestflag.Flag[string]{
			Name:      "cursor",
			Usage:     "Opaque pagination cursor; do not inspect. Use together with 'direction'.",
			QueryPath: "cursor",
		},
		&requestflag.Flag[string]{
			Name:      "direction",
			Usage:     "Pagination direction used with 'cursor': 'before' fetches older results, 'after' fetches newer results. Defaults to 'before' when only 'cursor' is provided.",
			QueryPath: "direction",
		},
		&requestflag.Flag[int64]{
			Name:  "max-items",
			Usage: "The maximum number of items to return (use -1 for unlimited).",
		},
	},
	Action:          handleChatsList,
	HideHelpCommand: true,
}

var chatsArchive = cli.Command{
	Name:    "archive",
	Usage:   "Archive or unarchive a chat. Set archived=true to move to archive,\narchived=false to move back to inbox",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[bool]{
			Name:     "archived",
			Usage:    "True to archive, false to unarchive",
			Default:  true,
			BodyPath: "archived",
		},
	},
	Action:          handleChatsArchive,
	HideHelpCommand: true,
}

var chatsMarkRead = cli.Command{
	Name:    "mark-read",
	Usage:   "Mark a chat as read, optionally through a specific message ID.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[string]{
			Name:     "message-id",
			Usage:    "Optional message ID to mark read through.",
			BodyPath: "messageID",
		},
	},
	Action:          handleChatsMarkRead,
	HideHelpCommand: true,
}

var chatsMarkUnread = cli.Command{
	Name:    "mark-unread",
	Usage:   "Mark a chat as unread, optionally from a specific message ID.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[string]{
			Name:     "message-id",
			Usage:    "Optional message ID to mark unread from.",
			BodyPath: "messageID",
		},
	},
	Action:          handleChatsMarkUnread,
	HideHelpCommand: true,
}

var chatsNotifyAnyway = cli.Command{
	Name:    "notify-anyway",
	Usage:   "Force a delivery notification when supported by the underlying network.\nCurrently intended for iMessage on macOS; unsupported networks return an error.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
	},
	Action:          handleChatsNotifyAnyway,
	HideHelpCommand: true,
}

var chatsSearch = cli.Command{
	Name:    "search",
	Usage:   "Search chats by title, network, or participant names.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[[]string]{
			Name:      "account-id",
			Usage:     "Provide an array of account IDs to filter chats from specific messaging accounts only",
			QueryPath: "accountIDs",
		},
		&requestflag.Flag[string]{
			Name:      "cursor",
			Usage:     "Opaque pagination cursor; do not inspect. Use together with 'direction'.",
			QueryPath: "cursor",
		},
		&requestflag.Flag[string]{
			Name:      "direction",
			Usage:     "Pagination direction used with 'cursor': 'before' fetches older results, 'after' fetches newer results. Defaults to 'before' when only 'cursor' is provided.",
			QueryPath: "direction",
		},
		&requestflag.Flag[string]{
			Name:      "inbox",
			Usage:     `Filter by inbox type: "primary" (non-archived, non-low-priority), "low-priority", or "archive". If not specified, shows all chats.`,
			QueryPath: "inbox",
		},
		&requestflag.Flag[*bool]{
			Name:      "include-muted",
			Usage:     "Include chats marked as Muted by the user, which are usually less important. Default: true. Set to false if the user wants a more refined search.",
			Default:   requestflag.Ptr[bool](true),
			QueryPath: "includeMuted",
		},
		&requestflag.Flag[any]{
			Name:      "last-activity-after",
			Usage:     "Provide an ISO datetime string to only retrieve chats with last activity after this time",
			QueryPath: "lastActivityAfter",
		},
		&requestflag.Flag[any]{
			Name:      "last-activity-before",
			Usage:     "Provide an ISO datetime string to only retrieve chats with last activity before this time",
			QueryPath: "lastActivityBefore",
		},
		&requestflag.Flag[int64]{
			Name:      "limit",
			Usage:     "Set the maximum number of chats to retrieve. Valid range: 1-200, default is 50",
			Default:   50,
			QueryPath: "limit",
		},
		&requestflag.Flag[string]{
			Name:      "query",
			Usage:     `Literal token search (non-semantic). Use single words users type (e.g., "dinner"). When multiple words provided, ALL must match. Case-insensitive.`,
			QueryPath: "query",
		},
		&requestflag.Flag[string]{
			Name:      "scope",
			Usage:     "Search scope: 'titles' matches title + network; 'participants' matches participant names.",
			Default:   "titles",
			QueryPath: "scope",
		},
		&requestflag.Flag[string]{
			Name:      "type",
			Usage:     `Specify the type of chats to retrieve: use "single" for direct messages, "group" for group chats, or "any" to get all types`,
			Default:   "any",
			QueryPath: "type",
		},
		&requestflag.Flag[*bool]{
			Name:      "unread-only",
			Usage:     "Set to true to only retrieve chats that have unread messages",
			QueryPath: "unreadOnly",
		},
		&requestflag.Flag[int64]{
			Name:  "max-items",
			Usage: "The maximum number of items to return (use -1 for unlimited).",
		},
	},
	Action:          handleChatsSearch,
	HideHelpCommand: true,
}

var chatsStart = requestflag.WithInnerFlags(cli.Command{
	Name:    "start",
	Usage:   "Resolve a user/contact and open a direct chat. Reuses and returns an existing\ndirect chat when one is found. Available in Beeper Desktop v4.2.808+.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "account-id",
			Usage:    "Account to create or start the chat on.",
			Required: true,
			BodyPath: "accountID",
		},
		&requestflag.Flag[map[string]any]{
			Name:     "user",
			Usage:    "Merged user-like contact payload used to resolve the best identifier.",
			Required: true,
			BodyPath: "user",
		},
		&requestflag.Flag[bool]{
			Name:     "allow-invite",
			Usage:    "Whether invite-based DM creation is allowed when required by the platform.",
			Default:  true,
			BodyPath: "allowInvite",
		},
		&requestflag.Flag[string]{
			Name:     "message-text",
			Usage:    "Optional first message content if the platform requires it to create the chat.",
			BodyPath: "messageText",
		},
	},
	Action:          handleChatsStart,
	HideHelpCommand: true,
}, map[string][]requestflag.HasOuterFlag{
	"user": {
		&requestflag.InnerFlag[string]{
			Name:       "user.id",
			Usage:      "Known user ID when available.",
			InnerField: "id",
		},
		&requestflag.InnerFlag[string]{
			Name:       "user.email",
			Usage:      "Email candidate.",
			InnerField: "email",
		},
		&requestflag.InnerFlag[string]{
			Name:       "user.full-name",
			Usage:      "Display name hint used for ranking only.",
			InnerField: "fullName",
		},
		&requestflag.InnerFlag[string]{
			Name:       "user.phone-number",
			Usage:      "Phone number candidate (E.164 preferred).",
			InnerField: "phoneNumber",
		},
		&requestflag.InnerFlag[string]{
			Name:       "user.username",
			Usage:      "Username/handle candidate.",
			InnerField: "username",
		},
	},
})

func handleChatsCreate(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatNewParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.New(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats create",
		Transform:      transform,
	})
}

func handleChatsRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatGetParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.Get(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := "json"
	explicitFormat := cmd.Root().IsSet("format")
	if explicitFormat {
		format = cmd.Root().String("format")
	}
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats retrieve",
		Transform:      transform,
	})
}

func handleChatsUpdate(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatUpdateParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.Update(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats update",
		Transform:      transform,
	})
}

func handleChatsList(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatListParams{}

	format := "json"
	explicitFormat := cmd.Root().IsSet("format")
	if explicitFormat {
		format = cmd.Root().String("format")
	}
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Chats.List(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "chats list",
			Transform:      transform,
		})
	} else {
		iter := client.Chats.ListAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "chats list",
			Transform:      transform,
		})
	}
}

func handleChatsArchive(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatArchiveParams{}

	return client.Chats.Archive(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
}

func handleChatsMarkRead(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatMarkReadParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.MarkRead(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats mark-read",
		Transform:      transform,
	})
}

func handleChatsMarkUnread(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatMarkUnreadParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.MarkUnread(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats mark-unread",
		Transform:      transform,
	})
}

func handleChatsNotifyAnyway(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatNotifyAnywayParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.NotifyAnyway(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats notify-anyway",
		Transform:      transform,
	})
}

func handleChatsSearch(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatSearchParams{}

	format := "json"
	explicitFormat := cmd.Root().IsSet("format")
	if explicitFormat {
		format = cmd.Root().String("format")
	}
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Chats.Search(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "chats search",
			Transform:      transform,
		})
	} else {
		iter := client.Chats.SearchAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "chats search",
			Transform:      transform,
		})
	}
}

func handleChatsStart(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := beeperdesktopapi.ChatStartParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.Start(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "chats start",
		Transform:      transform,
	})
}

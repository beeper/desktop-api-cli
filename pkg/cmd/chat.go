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

var chatsCreate = requestflag.WithInnerFlags(cli.Command{
	Name:    "create",
	Usage:   "Create a direct or group chat with mode=\"create\", or use mode=\"start\" to resolve\na contact and open a direct chat.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "account-id",
			Usage:    "Account to create or start the chat on.",
			Required: true,
			BodyPath: "accountID",
		},
		&requestflag.Flag[bool]{
			Name:     "allow-invite",
			Usage:    "Only used for mode='start'. Whether invite-based DM creation is allowed when required by the platform.",
			Default:  true,
			BodyPath: "allowInvite",
		},
		&requestflag.Flag[string]{
			Name:     "message-text",
			Usage:    "Optional first message content if the platform requires it to create the chat.",
			BodyPath: "messageText",
		},
		&requestflag.Flag[string]{
			Name:     "mode",
			Usage:    "Operation mode. Use 'start' to resolve a user/contact and start a direct chat. Omit or set 'create' to create a chat directly.",
			BodyPath: "mode",
		},
		&requestflag.Flag[[]string]{
			Name:     "participant-id",
			Usage:    "Required for create mode. Provide exactly one user ID for 'single' chats and one or more for 'group' chats.",
			BodyPath: "participantIDs",
		},
		&requestflag.Flag[string]{
			Name:     "title",
			Usage:    "Optional title for group chats; ignored for single chats on most networks.",
			BodyPath: "title",
		},
		&requestflag.Flag[string]{
			Name:     "type",
			Usage:    "Required for create mode. 'single' creates a direct message chat; 'group' creates a group chat.",
			BodyPath: "type",
		},
		&requestflag.Flag[map[string]any]{
			Name:     "user",
			Usage:    "Required for mode='start'. Merged user-like contact payload used to resolve the best identifier.",
			BodyPath: "user",
		},
	},
	Action:          handleChatsCreate,
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

var chatsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Retrieve chat details including metadata, participants, and latest message",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Unique identifier of the chat.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[*int64]{
			Name:      "max-participant-count",
			Usage:     "Maximum number of participants to return. Use -1 for all; otherwise 0–500. Defaults to all (-1).",
			Default:   requestflag.Ptr[int64](-1),
			QueryPath: "maxParticipantCount",
		},
	},
	Action:          handleChatsRetrieve,
	HideHelpCommand: true,
}

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
			Usage:     "Unique identifier of the chat.",
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

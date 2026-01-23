// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/beeper/desktop-api-go"
	"github.com/beeper/desktop-api-go/option"
	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/apiquery"
	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/requestflag"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var messagesList = cli.Command{
	Name:    "list",
	Usage:   "List all messages in a chat with cursor-based pagination. Sorted by timestamp.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
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
	},
	Action:          handleMessagesList,
	HideHelpCommand: true,
}

var messagesSearch = cli.Command{
	Name:    "search",
	Usage:   "Search messages across chats using Beeper's message index",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[[]string]{
			Name:      "account-id",
			Usage:     "Limit search to specific account IDs.",
			QueryPath: "accountIDs",
		},
		&requestflag.Flag[[]string]{
			Name:      "chat-id",
			Usage:     "Limit search to specific chat IDs.",
			QueryPath: "chatIDs",
		},
		&requestflag.Flag[string]{
			Name:      "chat-type",
			Usage:     "Filter by chat type: 'group' for group chats, 'single' for 1:1 chats.",
			QueryPath: "chatType",
		},
		&requestflag.Flag[string]{
			Name:      "cursor",
			Usage:     "Opaque pagination cursor; do not inspect. Use together with 'direction'.",
			QueryPath: "cursor",
		},
		&requestflag.Flag[any]{
			Name:      "date-after",
			Usage:     "Only include messages with timestamp strictly after this ISO 8601 datetime (e.g., '2024-07-01T00:00:00Z' or '2024-07-01T00:00:00+02:00').",
			QueryPath: "dateAfter",
		},
		&requestflag.Flag[any]{
			Name:      "date-before",
			Usage:     "Only include messages with timestamp strictly before this ISO 8601 datetime (e.g., '2024-07-31T23:59:59Z' or '2024-07-31T23:59:59+02:00').",
			QueryPath: "dateBefore",
		},
		&requestflag.Flag[string]{
			Name:      "direction",
			Usage:     "Pagination direction used with 'cursor': 'before' fetches older results, 'after' fetches newer results. Defaults to 'before' when only 'cursor' is provided.",
			QueryPath: "direction",
		},
		&requestflag.Flag[bool]{
			Name:      "exclude-low-priority",
			Usage:     "Exclude messages marked Low Priority by the user. Default: true. Set to false to include all.",
			Default:   true,
			QueryPath: "excludeLowPriority",
		},
		&requestflag.Flag[bool]{
			Name:      "include-muted",
			Usage:     "Include messages in chats marked as Muted by the user, which are usually less important. Default: true. Set to false if the user wants a more refined search.",
			Default:   true,
			QueryPath: "includeMuted",
		},
		&requestflag.Flag[int64]{
			Name:      "limit",
			Usage:     "Maximum number of messages to return.",
			Default:   20,
			QueryPath: "limit",
		},
		&requestflag.Flag[[]string]{
			Name:      "media-type",
			Usage:     "Filter messages by media types. Use ['any'] for any media type, or specify exact types like ['video', 'image']. Omit for no media filtering.",
			QueryPath: "mediaTypes",
		},
		&requestflag.Flag[string]{
			Name:      "query",
			Usage:     `Literal word search (NOT semantic). Finds messages containing these EXACT words in any order. Use single words users actually type, not concepts or phrases. Example: use "dinner" not "dinner plans", use "sick" not "health issues". If omitted, returns results filtered only by other parameters.`,
			QueryPath: "query",
		},
		&requestflag.Flag[string]{
			Name:      "sender",
			Usage:     "Filter by sender: 'me' (messages sent by the authenticated user), 'others' (messages sent by others), or a specific user ID string (user.id).",
			QueryPath: "sender",
		},
	},
	Action:          handleMessagesSearch,
	HideHelpCommand: true,
}

var messagesSend = cli.Command{
	Name:    "send",
	Usage:   "Send a text message to a specific chat. Supports replying to existing messages.\nReturns the sent message ID.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "reply-to-message-id",
			Usage:    "Provide a message ID to send this as a reply to an existing message",
			BodyPath: "replyToMessageID",
		},
		&requestflag.Flag[string]{
			Name:     "text",
			Usage:    "Text content of the message you want to send. You may use markdown.",
			BodyPath: "text",
		},
	},
	Action:          handleMessagesSend,
	HideHelpCommand: true,
}

func handleMessagesList(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.MessageListParams{}

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

	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Messages.List(
			ctx,
			cmd.Value("chat-id").(string),
			params,
			options...,
		)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "messages list", obj, format, transform)
	} else {
		iter := client.Messages.ListAutoPaging(
			ctx,
			cmd.Value("chat-id").(string),
			params,
			options...,
		)
		return ShowJSONIterator(os.Stdout, "messages list", iter, format, transform)
	}
}

func handleMessagesSearch(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.MessageSearchParams{}

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

	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Messages.Search(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "messages search", obj, format, transform)
	} else {
		iter := client.Messages.SearchAutoPaging(ctx, params, options...)
		return ShowJSONIterator(os.Stdout, "messages search", iter, format, transform)
	}
}

func handleMessagesSend(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.MessageSendParams{}

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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Messages.Send(
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
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "messages send", obj, format, transform)
}

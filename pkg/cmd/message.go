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

var messagesRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Retrieve a message by final message ID, pendingMessageID, or Matrix event ID.\nChat ID may be a Beeper chat ID or local chat ID.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[string]{
			Name:      "message-id",
			Usage:     "Message ID.",
			Required:  true,
			PathParam: "messageID",
		},
	},
	Action:          handleMessagesRetrieve,
	HideHelpCommand: true,
}

var messagesUpdate = cli.Command{
	Name:    "update",
	Usage:   "Edit the text content of an existing message. Messages with attachments cannot\nbe edited.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[string]{
			Name:      "message-id",
			Usage:     "Message ID.",
			Required:  true,
			PathParam: "messageID",
		},
		&requestflag.Flag[string]{
			Name:     "text",
			Usage:    "New text content for the message",
			Required: true,
			BodyPath: "text",
		},
	},
	Action:          handleMessagesUpdate,
	HideHelpCommand: true,
}

var messagesList = cli.Command{
	Name:    "list",
	Usage:   "List all messages in a chat with cursor-based pagination. Sorted by timestamp.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
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
	Action:          handleMessagesList,
	HideHelpCommand: true,
}

var messagesDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete a message by final message ID. Pending message IDs are not accepted\nbecause messages cannot be deleted while sending.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[string]{
			Name:      "message-id",
			Usage:     "Message ID.",
			Required:  true,
			PathParam: "messageID",
		},
		&requestflag.Flag[*bool]{
			Name:      "for-everyone",
			Usage:     "True to request deletion for everyone when the network supports it; false to delete only for the authenticated user when supported.",
			Default:   requestflag.Ptr[bool](true),
			QueryPath: "forEveryone",
		},
	},
	Action:          handleMessagesDelete,
	HideHelpCommand: true,
}

var messagesSearch = cli.Command{
	Name:    "search",
	Usage:   "Search messages across chats.",
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
		&requestflag.Flag[*bool]{
			Name:      "exclude-low-priority",
			Usage:     "Exclude messages marked Low Priority by the user. Default: true. Set to false to include all.",
			Default:   requestflag.Ptr[bool](true),
			QueryPath: "excludeLowPriority",
		},
		&requestflag.Flag[*bool]{
			Name:      "include-muted",
			Usage:     "Include messages in chats marked as Muted by the user, which are usually less important. Default: true. Set to false if the user wants a more refined search.",
			Default:   requestflag.Ptr[bool](true),
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
			Usage:     `Literal word search (non-semantic). Finds messages containing these EXACT words in any order. Use single words users actually type, not concepts or phrases. Example: use "dinner" not "dinner plans", use "sick" not "health issues". If omitted, returns results filtered only by other parameters.`,
			QueryPath: "query",
		},
		&requestflag.Flag[string]{
			Name:      "sender",
			Usage:     "Filter by sender: 'me' (messages sent by the authenticated user), 'others' (messages sent by others), or a specific user ID string (user.id).",
			QueryPath: "sender",
		},
		&requestflag.Flag[int64]{
			Name:  "max-items",
			Usage: "The maximum number of items to return (use -1 for unlimited).",
		},
	},
	Action:          handleMessagesSearch,
	HideHelpCommand: true,
}

var messagesSend = requestflag.WithInnerFlags(cli.Command{
	Name:    "send",
	Usage:   "Send a text message to a specific chat. Supports replying to existing messages.\nReturns a pending message ID.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "chat-id",
			Usage:     "Chat ID. Input routes also accept the local chat ID from this Beeper Desktop installation when available.",
			Required:  true,
			PathParam: "chatID",
		},
		&requestflag.Flag[map[string]any]{
			Name:     "attachment",
			Usage:    "Single attachment to send with the message",
			BodyPath: "attachment",
		},
		&requestflag.Flag[string]{
			Name:     "reply-to-message-id",
			Usage:    "Provide a message ID to send this as a reply to an existing message",
			BodyPath: "replyToMessageID",
		},
		&requestflag.Flag[string]{
			Name:     "text",
			Usage:    "Draft text. Plain text and Markdown are converted to Matrix HTML with the same rules used by send and edit.",
			BodyPath: "text",
		},
	},
	Action:          handleMessagesSend,
	HideHelpCommand: true,
}, map[string][]requestflag.HasOuterFlag{
	"attachment": {
		&requestflag.InnerFlag[string]{
			Name:       "attachment.upload-id",
			Usage:      "Upload ID from uploadAsset endpoint. Required to reference uploaded files.",
			InnerField: "uploadID",
		},
		&requestflag.InnerFlag[float64]{
			Name:       "attachment.duration",
			Usage:      "Duration in seconds (optional override of cached value)",
			InnerField: "duration",
		},
		&requestflag.InnerFlag[string]{
			Name:       "attachment.file-name",
			Usage:      "Filename (optional override of cached value)",
			InnerField: "fileName",
		},
		&requestflag.InnerFlag[string]{
			Name:       "attachment.mime-type",
			Usage:      "MIME type (optional override of cached value)",
			InnerField: "mimeType",
		},
		&requestflag.InnerFlag[map[string]any]{
			Name:       "attachment.size",
			Usage:      "Dimensions (optional override of cached value)",
			InnerField: "size",
		},
		&requestflag.InnerFlag[string]{
			Name:       "attachment.type",
			Usage:      "Attachment type hint (image, video, audio, file, gif, voice-note, sticker). If omitted, auto-detected from mimeType",
			InnerField: "type",
		},
	},
})

func handleMessagesRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("message-id") && len(unusedArgs) > 0 {
		cmd.Set("message-id", unusedArgs[0])
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

	params := beeperdesktopapi.MessageGetParams{
		ChatID: cmd.Value("chat-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Messages.Get(
		ctx,
		cmd.Value("message-id").(string),
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
		Title:          "messages retrieve",
		Transform:      transform,
	})
}

func handleMessagesUpdate(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("message-id") && len(unusedArgs) > 0 {
		cmd.Set("message-id", unusedArgs[0])
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

	params := beeperdesktopapi.MessageUpdateParams{
		ChatID: cmd.Value("chat-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Messages.Update(
		ctx,
		cmd.Value("message-id").(string),
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
		Title:          "messages update",
		Transform:      transform,
	})
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

	params := beeperdesktopapi.MessageListParams{}

	format := "json"
	explicitFormat := cmd.Root().IsSet("format")
	if explicitFormat {
		format = cmd.Root().String("format")
	}
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
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "messages list",
			Transform:      transform,
		})
	} else {
		iter := client.Messages.ListAutoPaging(
			ctx,
			cmd.Value("chat-id").(string),
			params,
			options...,
		)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "messages list",
			Transform:      transform,
		})
	}
}

func handleMessagesDelete(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("message-id") && len(unusedArgs) > 0 {
		cmd.Set("message-id", unusedArgs[0])
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

	params := beeperdesktopapi.MessageDeleteParams{
		ChatID: cmd.Value("chat-id").(string),
	}

	return client.Messages.Delete(
		ctx,
		cmd.Value("message-id").(string),
		params,
		options...,
	)
}

func handleMessagesSearch(ctx context.Context, cmd *cli.Command) error {
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

	params := beeperdesktopapi.MessageSearchParams{}

	format := "json"
	explicitFormat := cmd.Root().IsSet("format")
	if explicitFormat {
		format = cmd.Root().String("format")
	}
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Messages.Search(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "messages search",
			Transform:      transform,
		})
	} else {
		iter := client.Messages.SearchAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "messages search",
			Transform:      transform,
		})
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

	params := beeperdesktopapi.MessageSendParams{}

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
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "messages send",
		Transform:      transform,
	})
}

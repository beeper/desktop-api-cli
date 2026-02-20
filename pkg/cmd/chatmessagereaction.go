// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/beeper/desktop-api-cli/internal/apiquery"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
	"github.com/beeper/desktop-api-go"
	"github.com/beeper/desktop-api-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var chatsMessagesReactionsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Remove the authenticated user's reaction from an existing message.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "message-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:      "reaction-key",
			Usage:     "Reaction key to remove",
			Required:  true,
			QueryPath: "reactionKey",
		},
	},
	Action:          handleChatsMessagesReactionsDelete,
	HideHelpCommand: true,
}

var chatsMessagesReactionsAdd = cli.Command{
	Name:    "add",
	Usage:   "Add a reaction to an existing message.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "message-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "reaction-key",
			Usage:    "Reaction key to add (emoji, shortcode, or custom emoji key)",
			Required: true,
			BodyPath: "reactionKey",
		},
		&requestflag.Flag[string]{
			Name:     "transaction-id",
			Usage:    "Optional transaction ID for deduplication and local echo tracking",
			BodyPath: "transactionID",
		},
	},
	Action:          handleChatsMessagesReactionsAdd,
	HideHelpCommand: true,
}

func handleChatsMessagesReactionsDelete(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("message-id") && len(unusedArgs) > 0 {
		cmd.Set("message-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.ChatMessageReactionDeleteParams{
		ChatID: cmd.Value("chat-id").(string),
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.Messages.Reactions.Delete(
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
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "chats:messages:reactions delete", obj, format, transform)
}

func handleChatsMessagesReactionsAdd(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("message-id") && len(unusedArgs) > 0 {
		cmd.Set("message-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.ChatMessageReactionAddParams{
		ChatID: cmd.Value("chat-id").(string),
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Chats.Messages.Reactions.Add(
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
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "chats:messages:reactions add", obj, format, transform)
}

// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"

	"github.com/beeper/desktop-api-cli/internal/apiquery"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
	"github.com/beeper/desktop-api-go"
	"github.com/urfave/cli/v3"
)

var chatsRemindersCreate = requestflag.WithInnerFlags(cli.Command{
	Name:    "create",
	Usage:   "Set a reminder for a chat at a specific time",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
		},
		&requestflag.Flag[map[string]any]{
			Name:     "reminder",
			Usage:    "Reminder configuration",
			Required: true,
			BodyPath: "reminder",
		},
	},
	Action:          handleChatsRemindersCreate,
	HideHelpCommand: true,
}, map[string][]requestflag.HasOuterFlag{
	"reminder": {
		&requestflag.InnerFlag[float64]{
			Name:       "reminder.remind-at-ms",
			Usage:      "Unix timestamp in milliseconds when reminder should trigger",
			InnerField: "remindAtMs",
		},
		&requestflag.InnerFlag[bool]{
			Name:       "reminder.dismiss-on-incoming-message",
			Usage:      "Cancel reminder if someone messages in the chat",
			InnerField: "dismissOnIncomingMessage",
		},
	},
})

var chatsRemindersDelete = cli.Command{
	Name:    "delete",
	Usage:   "Clear an existing reminder from a chat",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Unique identifier of the chat.",
			Required: true,
		},
	},
	Action:          handleChatsRemindersDelete,
	HideHelpCommand: true,
}

func handleChatsRemindersCreate(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("chat-id") && len(unusedArgs) > 0 {
		cmd.Set("chat-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.ChatReminderNewParams{}

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

	return client.Chats.Reminders.New(
		ctx,
		cmd.Value("chat-id").(string),
		params,
		options...,
	)
}

func handleChatsRemindersDelete(ctx context.Context, cmd *cli.Command) error {
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

	return client.Chats.Reminders.Delete(ctx, cmd.Value("chat-id").(string), options...)
}

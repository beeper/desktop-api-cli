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

var focus = cli.Command{
	Name:    "focus",
	Usage:   "Focus Beeper Desktop and optionally navigate to a specific chat, message, or\npre-fill draft text and attachment.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "chat-id",
			Usage:    "Optional Beeper chat ID (or local chat ID) to focus after opening the app. If omitted, only opens/focuses the app.",
			BodyPath: "chatID",
		},
		&requestflag.Flag[string]{
			Name:     "draft-attachment-path",
			Usage:    "Optional draft attachment path to populate in the message input field.",
			BodyPath: "draftAttachmentPath",
		},
		&requestflag.Flag[string]{
			Name:     "draft-text",
			Usage:    "Optional draft text to populate in the message input field.",
			BodyPath: "draftText",
		},
		&requestflag.Flag[string]{
			Name:     "message-id",
			Usage:    "Optional message ID. Jumps to that message in the chat when opening.",
			BodyPath: "messageID",
		},
	},
	Action:          handleFocus,
	HideHelpCommand: true,
}

var search = cli.Command{
	Name:    "search",
	Usage:   "Returns matching chats, participant name matches in groups, and the first page\nof messages in one call. Paginate messages via search-messages. Paginate chats\nvia search-chats.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "query",
			Usage:     "User-typed search text. Literal word matching (non-semantic).",
			Required:  true,
			QueryPath: "query",
		},
	},
	Action:          handleSearch,
	HideHelpCommand: true,
}

func handleFocus(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.FocusParams{}

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
	_, err = client.Focus(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "focus", obj, format, transform)
}

func handleSearch(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.SearchParams{}

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
	_, err = client.Search(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "search", obj, format, transform)
}

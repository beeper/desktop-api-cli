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

var accountsContactsList = cli.Command{
	Name:    "list",
	Usage:   "List merged contacts for a specific account with cursor-based pagination.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "account-id",
			Usage:    "Account ID this resource belongs to.",
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
		&requestflag.Flag[int64]{
			Name:      "limit",
			Usage:     "Maximum contacts to return per page.",
			Default:   50,
			QueryPath: "limit",
		},
		&requestflag.Flag[string]{
			Name:      "query",
			Usage:     "Optional search query for blended contact lookup.",
			QueryPath: "query",
		},
	},
	Action:          handleAccountsContactsList,
	HideHelpCommand: true,
}

var accountsContactsSearch = cli.Command{
	Name:    "search",
	Usage:   "Search contacts on a specific account using merged account contacts, network\nsearch, and exact identifier lookup.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "account-id",
			Usage:    "Account ID this resource belongs to.",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:      "query",
			Usage:     "Text to search users by. Network-specific behavior.",
			Required:  true,
			QueryPath: "query",
		},
	},
	Action:          handleAccountsContactsSearch,
	HideHelpCommand: true,
}

func handleAccountsContactsList(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("account-id") && len(unusedArgs) > 0 {
		cmd.Set("account-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.AccountContactListParams{}

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
		_, err = client.Accounts.Contacts.List(
			ctx,
			cmd.Value("account-id").(string),
			params,
			options...,
		)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "accounts:contacts list", obj, format, transform)
	} else {
		iter := client.Accounts.Contacts.ListAutoPaging(
			ctx,
			cmd.Value("account-id").(string),
			params,
			options...,
		)
		return ShowJSONIterator(os.Stdout, "accounts:contacts list", iter, format, transform)
	}
}

func handleAccountsContactsSearch(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("account-id") && len(unusedArgs) > 0 {
		cmd.Set("account-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.AccountContactSearchParams{}

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
	_, err = client.Accounts.Contacts.Search(
		ctx,
		cmd.Value("account-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "accounts:contacts search", obj, format, transform)
}

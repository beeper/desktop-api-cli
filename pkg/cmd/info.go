// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/beeper/desktop-api-cli/internal/apiquery"
	"github.com/beeper/desktop-api-go"
	"github.com/beeper/desktop-api-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var infoRetrieve = cli.Command{
	Name:            "retrieve",
	Usage:           "Returns app, platform, server, and endpoint discovery metadata for this Beeper\nDesktop instance.",
	Suggest:         true,
	Flags:           []cli.Flag{},
	Action:          handleInfoRetrieve,
	HideHelpCommand: true,
}

func handleInfoRetrieve(ctx context.Context, cmd *cli.Command) error {
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Info.Get(ctx, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "info retrieve", obj, format, transform)
}

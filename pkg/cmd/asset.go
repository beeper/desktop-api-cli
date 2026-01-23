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

var assetsDownload = cli.Command{
	Name:    "download",
	Usage:   "Download a Matrix asset using its mxc:// or localmxc:// URL to the device\nrunning Beeper Desktop and return the local file URL.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "url",
			Usage:    "Matrix content URL (mxc:// or localmxc://) for the asset to download.",
			Required: true,
			BodyPath: "url",
		},
	},
	Action:          handleAssetsDownload,
	HideHelpCommand: true,
}

var assetsUpload = cli.Command{
	Name:    "upload",
	Usage:   "Upload a file to a temporary location. Supports JSON body with base64 `content`\nfield, or multipart/form-data with `file` field. Returns a local file URL that\ncan be used when sending messages with attachments.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "content",
			Usage:    "Base64-encoded file content (max ~500MB decoded)",
			Required: true,
			BodyPath: "content",
		},
		&requestflag.Flag[string]{
			Name:     "file-name",
			Usage:    "Original filename. Generated if omitted",
			BodyPath: "fileName",
		},
		&requestflag.Flag[string]{
			Name:     "mime-type",
			Usage:    "MIME type. Auto-detected from magic bytes if omitted",
			BodyPath: "mimeType",
		},
	},
	Action:          handleAssetsUpload,
	HideHelpCommand: true,
}

func handleAssetsDownload(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.AssetDownloadParams{}

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
	_, err = client.Assets.Download(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "assets download", obj, format, transform)
}

func handleAssetsUpload(ctx context.Context, cmd *cli.Command) error {
	client := beeperdesktopapi.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := beeperdesktopapi.AssetUploadParams{}

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
	_, err = client.Assets.Upload(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "assets upload", obj, format, transform)
}

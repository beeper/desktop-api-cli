// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestAssetsDownload(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "download",
		"--access-token", "string",
		"--url", "mxc://example.org/Q4x9CqGz1pB3Oa6XgJ",
	)
}

func TestAssetsServe(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "serve",
		"--access-token", "string",
		"--url", "x",
	)
}

func TestAssetsUpload(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "upload",
		"--access-token", "string",
		"--file", "...",
		"--file-name", "fileName",
		"--mime-type", "mimeType",
	)
}

func TestAssetsUploadBase64(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "upload-base64",
		"--access-token", "string",
		"--content", "x",
		"--file-name", "fileName",
		"--mime-type", "mimeType",
	)
}

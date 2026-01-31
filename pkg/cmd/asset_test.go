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
		"--url", "mxc://example.org/Q4x9CqGz1pB3Oa6XgJ",
	)
}

func TestAssetsServe(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "serve",
		"--url", "x",
	)
}

func TestAssetsUpload(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "upload",
		"--file", "",
		"--file-name", "fileName",
		"--mime-type", "mimeType",
	)
}

func TestAssetsUploadBase64(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "upload-base64",
		"--content", "x",
		"--file-name", "fileName",
		"--mime-type", "mimeType",
	)
}

// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/mocktest"
)

func TestAssetsDownload(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"assets", "download",
		"--url", "mxc://example.org/Q4x9CqGz1pB3Oa6XgJ",
	)
}

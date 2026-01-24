// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestAccountsList(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"accounts", "list",
	)
}

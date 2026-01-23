// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/mocktest"
)

func TestAccountsContactsSearch(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"accounts:contacts", "search",
		"--account-id", "accountID",
		"--query", "x",
	)
}

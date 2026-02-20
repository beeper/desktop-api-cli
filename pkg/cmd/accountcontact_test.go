// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestAccountsContactsList(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"accounts:contacts", "list",
		"--account-id", "accountID",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--direction", "before",
		"--limit", "1",
		"--query", "x",
	)
}

func TestAccountsContactsSearch(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"accounts:contacts", "search",
		"--account-id", "accountID",
		"--query", "x",
	)
}

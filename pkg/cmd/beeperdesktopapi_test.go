// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/mocktest"
)

func TestFocus(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"focus",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--draft-attachment-path", "draftAttachmentPath",
		"--draft-text", "draftText",
		"--message-id", "messageID",
	)
}

func TestSearch(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"search",
		"--query", "x",
	)
}

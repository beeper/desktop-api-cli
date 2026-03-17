// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestFocus(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"focus",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--draft-attachment-path", "draftAttachmentPath",
			"--draft-text", "draftText",
			"--message-id", "messageID",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"chatID: '!NCdzlIaMjZUmvmvyHU:beeper.com'\n" +
			"draftAttachmentPath: draftAttachmentPath\n" +
			"draftText: draftText\n" +
			"messageID: messageID\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"focus",
		)
	})
}

func TestSearch(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"search",
			"--query", "x",
		)
	})
}

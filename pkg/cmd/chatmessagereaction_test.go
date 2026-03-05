// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestChatsMessagesReactionsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats:messages:reactions", "delete",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "messageID",
			"--reaction-key", "x",
		)
	})
}

func TestChatsMessagesReactionsAdd(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats:messages:reactions", "add",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "messageID",
			"--reaction-key", "x",
			"--transaction-id", "transactionID",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"reactionKey: x\n" +
			"transactionID: transactionID\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "chats:messages:reactions", "add",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "messageID",
		)
	})
}

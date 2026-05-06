// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestChatsMessagesReactionsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats:messages:reactions", "delete",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "1343993",
			"--reaction-key", "x",
		)
	})
}

func TestChatsMessagesReactionsAdd(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats:messages:reactions", "add",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "1343993",
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
			t, pipeData,
			"--access-token", "string",
			"chats:messages:reactions", "add",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "1343993",
		)
	})
}

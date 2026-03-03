// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestChatsMessagesReactionsDelete(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats:messages:reactions", "delete",
		"--access-token", "string",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--message-id", "messageID",
		"--reaction-key", "x",
	)
}

func TestChatsMessagesReactionsAdd(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats:messages:reactions", "add",
		"--access-token", "string",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--message-id", "messageID",
		"--reaction-key", "x",
		"--transaction-id", "transactionID",
	)
}

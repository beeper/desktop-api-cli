// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestChatsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "create",
			"--params", "{accountID: accountID, mode: start, user: {id: id, email: email, fullName: fullName, phoneNumber: phoneNumber, username: username}, allowInvite: true, messageText: messageText}",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"accountID: accountID\n" +
			"mode: start\n" +
			"user:\n" +
			"  id: id\n" +
			"  email: email\n" +
			"  fullName: fullName\n" +
			"  phoneNumber: phoneNumber\n" +
			"  username: username\n" +
			"allowInvite: true\n" +
			"messageText: messageText\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats", "create",
		)
	})
}

func TestChatsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "retrieve",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--max-participant-count", "50",
		)
	})
}

func TestChatsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "list",
			"--max-items", "10",
			"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
			"--account-id", "local-instagram_ba_eRfQMmnSNy_p7Ih7HL7RduRpKFU",
			"--cursor", "1725489123456|c29tZUltc2dQYWdl",
			"--direction", "before",
		)
	})
}

func TestChatsArchive(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "archive",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--archived=true",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("archived: true")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats", "archive",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

func TestChatsSearch(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "search",
			"--max-items", "10",
			"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
			"--account-id", "local-telegram_ba_QFrb5lrLPhO3OT5MFBeTWv0x4BI",
			"--cursor", "1725489123456|c29tZUltc2dQYWdl",
			"--direction", "before",
			"--inbox", "primary",
			"--include-muted=true",
			"--last-activity-after", "'2019-12-27T18:11:19.117Z'",
			"--last-activity-before", "'2019-12-27T18:11:19.117Z'",
			"--limit", "1",
			"--query", "x",
			"--scope", "titles",
			"--type", "single",
			"--unread-only=true",
		)
	})
}

// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
)

func TestChatsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats", "create",
			"--access-token", "string",
			"--account-id", "accountID",
			"--allow-invite=true",
			"--message-text", "messageText",
			"--mode", "create",
			"--participant-id", "string",
			"--title", "title",
			"--type", "single",
			"--user", "{id: id, email: email, fullName: fullName, phoneNumber: phoneNumber, username: username}",
		)
	})

	t.Run("inner flags", func(t *testing.T) {
		// Check that inner flags have been set up correctly
		requestflag.CheckInnerFlags(chatsCreate)

		// Alternative argument passing style using inner flags
		mocktest.TestRunMockTestWithFlags(
			t, "chats", "create",
			"--access-token", "string",
			"--account-id", "accountID",
			"--allow-invite=true",
			"--message-text", "messageText",
			"--mode", "create",
			"--participant-id", "string",
			"--title", "title",
			"--type", "single",
			"--user.id", "id",
			"--user.email", "email",
			"--user.full-name", "fullName",
			"--user.phone-number", "phoneNumber",
			"--user.username", "username",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"accountID: accountID\n" +
			"allowInvite: true\n" +
			"messageText: messageText\n" +
			"mode: create\n" +
			"participantIDs:\n" +
			"  - string\n" +
			"title: title\n" +
			"type: single\n" +
			"user:\n" +
			"  id: id\n" +
			"  email: email\n" +
			"  fullName: fullName\n" +
			"  phoneNumber: phoneNumber\n" +
			"  username: username\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "chats", "create",
			"--access-token", "string",
		)
	})
}

func TestChatsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats", "retrieve",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--max-participant-count", "50",
		)
	})
}

func TestChatsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats", "list",
			"--access-token", "string",
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
			t, "chats", "archive",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--archived=true",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("archived: true")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "chats", "archive",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

func TestChatsSearch(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "chats", "search",
			"--access-token", "string",
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

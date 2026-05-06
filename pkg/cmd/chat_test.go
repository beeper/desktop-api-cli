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
			t,
			"--access-token", "string",
			"chats", "create",
			"--account-id", "accountID",
			"--participant-id", "string",
			"--type", "single",
			"--message-text", "messageText",
			"--title", "title",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"accountID: accountID\n" +
			"participantIDs:\n" +
			"  - string\n" +
			"type: single\n" +
			"messageText: messageText\n" +
			"title: title\n")
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
			"--max-participant-count", "100",
		)
	})
}

func TestChatsUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "update",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--description", "description",
			"--draft", "{text: text, attachments: {foo: {uploadID: uploadID, id: id, duration: 0, fileName: fileName, mimeType: mimeType, size: {height: 0, width: 0}, type: image}}}",
			"--img-url", "imgURL",
			"--is-archived=true",
			"--is-low-priority=true",
			"--is-muted=true",
			"--is-pinned=true",
			"--message-expiry-seconds", "0",
			"--title", "title",
		)
	})

	t.Run("inner flags", func(t *testing.T) {
		// Check that inner flags have been set up correctly
		requestflag.CheckInnerFlags(chatsUpdate)

		// Alternative argument passing style using inner flags
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "update",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--description", "description",
			"--draft.text", "text",
			"--draft.attachments", "{foo: {uploadID: uploadID, id: id, duration: 0, fileName: fileName, mimeType: mimeType, size: {height: 0, width: 0}, type: image}}",
			"--img-url", "imgURL",
			"--is-archived=true",
			"--is-low-priority=true",
			"--is-muted=true",
			"--is-pinned=true",
			"--message-expiry-seconds", "0",
			"--title", "title",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"description: description\n" +
			"draft:\n" +
			"  text: text\n" +
			"  attachments:\n" +
			"    foo:\n" +
			"      uploadID: uploadID\n" +
			"      id: id\n" +
			"      duration: 0\n" +
			"      fileName: fileName\n" +
			"      mimeType: mimeType\n" +
			"      size:\n" +
			"        height: 0\n" +
			"        width: 0\n" +
			"      type: image\n" +
			"imgURL: imgURL\n" +
			"isArchived: true\n" +
			"isLowPriority: true\n" +
			"isMuted: true\n" +
			"isPinned: true\n" +
			"messageExpirySeconds: 0\n" +
			"title: title\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats", "update",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
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
			"--account-id", "matrix",
			"--account-id", "discordgo",
			"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
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

func TestChatsMarkRead(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "mark-read",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "1343993",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("messageID: '1343993'")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats", "mark-read",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

func TestChatsMarkUnread(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "mark-unread",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "1343993",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("messageID: '1343993'")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats", "mark-unread",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

func TestChatsNotifyAnyway(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "notify-anyway",
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
			"--account-id", "matrix",
			"--account-id", "discordgo",
			"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
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

func TestChatsStart(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "start",
			"--account-id", "accountID",
			"--user", "{id: id, email: email, fullName: fullName, phoneNumber: phoneNumber, username: username}",
			"--allow-invite=true",
			"--message-text", "messageText",
		)
	})

	t.Run("inner flags", func(t *testing.T) {
		// Check that inner flags have been set up correctly
		requestflag.CheckInnerFlags(chatsStart)

		// Alternative argument passing style using inner flags
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats", "start",
			"--account-id", "accountID",
			"--user.id", "id",
			"--user.email", "email",
			"--user.full-name", "fullName",
			"--user.phone-number", "phoneNumber",
			"--user.username", "username",
			"--allow-invite=true",
			"--message-text", "messageText",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"accountID: accountID\n" +
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
			"chats", "start",
		)
	})
}

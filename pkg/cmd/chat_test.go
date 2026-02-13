// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
)

func TestChatsCreate(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "create",
		"--account-id", "accountID",
		"--participant-id", "string",
		"--type", "single",
		"--message-text", "messageText",
		"--mode", "create",
		"--title", "title",
		"--user", "{id: id, email: email, fullName: fullName, phoneNumber: phoneNumber, username: username}",
		"--allow-invite=true",
	)

	// Check that inner flags have been set up correctly
	requestflag.CheckInnerFlags(chatsCreate)

	// Alternative argument passing style using inner flags
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "create",
		"--account-id", "accountID",
		"--participant-id", "string",
		"--type", "single",
		"--message-text", "messageText",
		"--mode", "create",
		"--title", "title",
		"--user.id", "id",
		"--user.email", "email",
		"--user.full-name", "fullName",
		"--user.phone-number", "phoneNumber",
		"--user.username", "username",
		"--allow-invite=true",
	)
}

func TestChatsRetrieve(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "retrieve",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--max-participant-count", "50",
	)
}

func TestChatsList(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "list",
		"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
		"--account-id", "local-instagram_ba_eRfQMmnSNy_p7Ih7HL7RduRpKFU",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--direction", "before",
	)
}

func TestChatsArchive(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "archive",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--archived=true",
	)
}

func TestChatsSearch(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "search",
		"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
		"--account-id", "local-telegram_ba_QFrb5lrLPhO3OT5MFBeTWv0x4BI",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--direction", "before",
		"--inbox", "primary",
		"--include-muted=true",
		"--last-activity-after", "2019-12-27T18:11:19.117Z",
		"--last-activity-before", "2019-12-27T18:11:19.117Z",
		"--limit", "1",
		"--query", "x",
		"--scope", "titles",
		"--type", "single",
		"--unread-only=true",
	)
}

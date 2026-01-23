// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/mocktest"
)

func TestChatsCreate(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats", "create",
		"--account-id", "accountID",
		"--participant-id", "string",
		"--type", "single",
		"--message-text", "messageText",
		"--title", "title",
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
		"--account-id", "whatsapp",
		"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
		"--account-id", "local-instagram_ba_eRfQMmnSNy_p7Ih7HL7RduRpKFU",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--direction", "before",
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

// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/stainless-sdks/beeper-desktop-api-cli/internal/mocktest"
)

func TestMessagesList(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"messages", "list",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--direction", "before",
	)
}

func TestMessagesSearch(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"messages", "search",
		"--account-id", "whatsapp",
		"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
		"--account-id", "local-instagram_ba_eRfQMmnSNy_p7Ih7HL7RduRpKFU",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--chat-id", "1231073",
		"--chat-type", "group",
		"--cursor", "1725489123456|c29tZUltc2dQYWdl",
		"--date-after", "2025-08-01T00:00:00Z",
		"--date-before", "2025-08-31T23:59:59Z",
		"--direction", "before",
		"--exclude-low-priority=true",
		"--include-muted=true",
		"--limit", "20",
		"--media-type", "any",
		"--query", "dinner",
		"--sender", "me",
	)
}

func TestMessagesSend(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"messages", "send",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--reply-to-message-id", "replyToMessageID",
		"--text", "text",
	)
}

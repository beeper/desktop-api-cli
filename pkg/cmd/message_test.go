// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
)

func TestMessagesUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "messages", "update",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "messageID",
			"--text", "x",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("text: x")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "messages", "update",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--message-id", "messageID",
		)
	})
}

func TestMessagesList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "messages", "list",
			"--access-token", "string",
			"--max-items", "10",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--cursor", "1725489123456|c29tZUltc2dQYWdl",
			"--direction", "before",
		)
	})
}

func TestMessagesSearch(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "messages", "search",
			"--access-token", "string",
			"--max-items", "10",
			"--account-id", "local-whatsapp_ba_EvYDBBsZbRQAy3UOSWqG0LuTVkc",
			"--account-id", "local-instagram_ba_eRfQMmnSNy_p7Ih7HL7RduRpKFU",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--chat-id", "1231073",
			"--chat-type", "group",
			"--cursor", "1725489123456|c29tZUltc2dQYWdl",
			"--date-after", "'2025-08-01T00:00:00Z'",
			"--date-before", "'2025-08-31T23:59:59Z'",
			"--direction", "before",
			"--exclude-low-priority=true",
			"--include-muted=true",
			"--limit", "20",
			"--media-type", "any",
			"--query", "dinner",
			"--sender", "sender",
		)
	})
}

func TestMessagesSend(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "messages", "send",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--attachment", "{uploadID: uploadID, duration: 0, fileName: fileName, mimeType: mimeType, size: {height: 0, width: 0}, type: gif}",
			"--reply-to-message-id", "replyToMessageID",
			"--text", "text",
		)
	})

	t.Run("inner flags", func(t *testing.T) {
		// Check that inner flags have been set up correctly
		requestflag.CheckInnerFlags(messagesSend)

		// Alternative argument passing style using inner flags
		mocktest.TestRunMockTestWithFlags(
			t, "messages", "send",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--attachment.upload-id", "uploadID",
			"--attachment.duration", "0",
			"--attachment.file-name", "fileName",
			"--attachment.mime-type", "mimeType",
			"--attachment.size", "{height: 0, width: 0}",
			"--attachment.type", "gif",
			"--reply-to-message-id", "replyToMessageID",
			"--text", "text",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"attachment:\n" +
			"  uploadID: uploadID\n" +
			"  duration: 0\n" +
			"  fileName: fileName\n" +
			"  mimeType: mimeType\n" +
			"  size:\n" +
			"    height: 0\n" +
			"    width: 0\n" +
			"  type: gif\n" +
			"replyToMessageID: replyToMessageID\n" +
			"text: text\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "messages", "send",
			"--access-token", "string",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

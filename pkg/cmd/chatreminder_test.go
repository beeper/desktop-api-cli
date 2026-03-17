// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
)

func TestChatsRemindersCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats:reminders", "create",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--reminder", "{remindAtMs: 0, dismissOnIncomingMessage: true}",
		)
	})

	t.Run("inner flags", func(t *testing.T) {
		// Check that inner flags have been set up correctly
		requestflag.CheckInnerFlags(chatsRemindersCreate)

		// Alternative argument passing style using inner flags
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats:reminders", "create",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
			"--reminder.remind-at-ms", "0",
			"--reminder.dismiss-on-incoming-message=true",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"reminder:\n" +
			"  remindAtMs: 0\n" +
			"  dismissOnIncomingMessage: true\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"chats:reminders", "create",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

func TestChatsRemindersDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"chats:reminders", "delete",
			"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		)
	})
}

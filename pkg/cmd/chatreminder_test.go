// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
	"github.com/beeper/desktop-api-cli/internal/requestflag"
)

func TestChatsRemindersCreate(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats:reminders", "create",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--reminder", "{remindAtMs: 0, dismissOnIncomingMessage: true}",
	)

	// Check that inner flags have been set up correctly
	requestflag.CheckInnerFlags(chatsRemindersCreate)

	// Alternative argument passing style using inner flags
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats:reminders", "create",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
		"--reminder.remind-at-ms", "0",
		"--reminder.dismiss-on-incoming-message=true",
	)
}

func TestChatsRemindersDelete(t *testing.T) {
	mocktest.TestRunMockTestWithFlags(
		t,
		"chats:reminders", "delete",
		"--chat-id", "!NCdzlIaMjZUmvmvyHU:beeper.com",
	)
}

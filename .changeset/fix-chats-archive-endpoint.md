---
'@beeper/cli': patch
---

Fix `chats archive` and `chats unarchive` silently no-op'ing.

Both commands called the generic chat-update endpoint (`PATCH /v1/chats/{chatID}`
with `{ isArchived }`), which returns `200 OK` but ignores `isArchived` — so the
command reported success while the chat was never archived or unarchived. They now
call the dedicated archive endpoint (`archiveChat`: `POST /v1/chats/{chatID}/archive`
with `{ archived }`) via `client.chats.archive(chatID, { archived })`, so the chat's
archive state actually changes.

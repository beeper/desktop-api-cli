# Intent

This CLI should keep its existing feature set while being reorganized and made
consistent with OpenClaw product language and setup expectations.

## Product Direction

- Keep the interactive setup UX: guided steps, prompts, readiness checks, and
  clear next actions.
- Align command output, setup/status wording, and user-facing concepts with
  OpenClaw where that is the intended product direction.
- For send/message command ergonomics, use `gog` and `wacli` as the closer
  references, not OpenClaw's generic `message` command.
- Use real OpenClaw behavior and documented contracts when adding OpenClaw
  integration. Do not invent SDK layers or placeholder APIs.

## Engineering Rules

- Reorganize and simplify code without deleting working features unless the
  feature is explicitly out of scope.
- Preserve existing command capabilities while changing internal structure or
  output shape.
- Prefer direct modules and concrete functions over convenience barrels,
  wrapper-only layers, duplicate types, and parallel command paths.
- Fold abstractions when they only rename another abstraction or hide a single
  call without adding policy, validation, or ownership.
- Keep one coherent implementation for each concern: parsing, output,
  configuration, setup state, auth, and API access.
- Do not keep compatibility-only aliases or contracts once product intent says
  the new shape replaces them.

## Guardrails

- Before deleting a command, endpoint, helper, test, schema, or setup path,
  confirm it is intentionally removed from the product scope.
- Treat "OpenClaw alignment" as output and architecture alignment first; it is
  not permission to replace feature implementations with thin passthroughs.
- If intent is ambiguous, write down the product question before making the
  change.

## Not Done Yet

These are known cleanup and alignment tasks that still need product judgment or
implementation. Treat this list as work to finish, not as a decision that every
item must be deleted.

### Package Exports

- Decide whether `packages/cli/package.json` should export anything beyond the
  executable and `./package.json`.
- If there is no library API, keep exports minimal and do not add convenience
  barrels.
- If a library API is needed, export only stable real source concerns, not
  `commands`, generated schema, or internal helper modules by default.
- Remove any export path that exists only for tests, MCP mirroring, or legacy
  convenience.

### Command Surface

- Inventory every command in `beeper --help` and mark it as one of:
  keep, rename, fold into another command, hide/internalize, or delete.
- Preserve feature capability while doing that inventory. Do not remove working
  account, chat, message, send, setup, or status behavior just to simplify the
  list.
- Decide whether `api request`, `schema`, `mcp`, `watch`, `export`, and
  `media download` are real product commands or unreleased implementation
  utilities.
- Decide whether `contacts list` belongs in the main surface or should be
  folded into chat/message resolution.
- Decide whether `install desktop`, `install server`, and
  `targets runtime *` remain public commands or become setup-owned internals.

### Aliases And Duplicate Entrypoints

- Remove compatibility aliases only after choosing the canonical command.
- Decide whether `use target` and `targets use` should both exist; keep only one
  if target selection remains a concept.
- Decide whether `remove target` and `targets remove` should both exist; keep
  only one if target removal remains public.
- Decide whether `use account` and `accounts use` should both exist; keep only
  one if default-account selection remains public.
- Decide whether `auth email start/response` should remain separate automation
  commands or be folded into `setup --email --code`.
- Decide whether `send text/file/voice/sticker/react/presence` should stay as
  separate user-facing commands. If changing them, prefer a `gog`/`wacli` style
  shape over OpenClaw's generic message surface.

### Send And Message Ergonomics

- Use `wacli` as the closest reference for third-party chat sending:
  `send text --to <recipient> --message <text>` and
  `send file --to <recipient> --file <path> --caption <text>`.
- Use `gog` as the closest reference for content ergonomics:
  `--body`, `--body-file -`, `--body-html`, clear send-vs-draft commands, and
  explicit reply flags.
- Prefer explicit recipient and content flags for send commands. Do not rely on
  positional magic for destructive or outbound actions.
- Require clear dry-run and confirmation behavior for outbound sends. In
  interactive mode, ambiguous recipients or broad sends should ask before
  sending.
- Keep search/list commands boring and scriptable: query flag or positional
  query, `--limit`/`--max`, account/chat filters, and `--json`.
- Prefer `--json` plus `--no-input` for automation, matching `gog` and `wacli`.
- Decide whether multiline text should use `--message-file -` or a more
  `gog`-like `--body-file -`; choose one term and apply it consistently.
- Do not use OpenClaw's generic `message send --channel --target --message`
  shape as the primary ergonomic reference for this CLI.

### Global Flags

- Decide canonical behavior for `--json`; keep one structured output path.
- Decide whether `--plain` is useful or just a second output mode to delete.
- Decide whether `--events` is product behavior or debug plumbing.
- Decide whether `--wrap-untrusted` and safety profiles are still part of this
  CLI once OpenClaw owns the trust model.
- Decide whether `--target` remains a public global flag or setup/status should
  own endpoint selection.
- Ensure `--no-input` consistently means no prompts everywhere, especially
  setup and account login.

### Setup And OpenClaw Alignment

- Keep interactive setup as the UX. Reorganize it around clear steps and
  readiness states instead of deleting it.
- Rename user-facing setup concepts toward OpenClaw only where the underlying
  behavior is real.
- Define how Beeper Desktop/Server setup maps to OpenClaw gateway/channel
  setup. This is not done.
- Decide whether OpenClaw onboarding is invoked, embedded through a real SDK,
  or used only as a model for output and step structure.
- If invoking OpenClaw, preserve existing Beeper-specific setup capabilities
  unless product explicitly says they are replaced.
- Make non-interactive setup output match the same step/readiness model as
  interactive setup.

### Output Contracts

- Define one JSON envelope for success, dry-run, readiness, setup actions, and
  errors.
- Align names like `target`, `account`, `bridge`, `chat`, and `message` with
  the intended OpenClaw vocabulary without breaking the feature semantics.
- Decide whether command output should expose raw Desktop API objects or
  normalized CLI objects.
- Remove duplicate output paths such as JSON/plain/events if they represent the
  same information.
- Make dry-run output consistent across setup, account add, chat mutation,
  message send, export, install, and runtime commands.

### Config And State

- Decide whether the config model is one endpoint, many targets, or OpenClaw
  gateway/channel config.
- If many targets remain, make target selection/removal/listing one coherent
  system.
- If one endpoint is chosen, fold target registry code and aliases accordingly.
- Decide whether default account belongs in CLI config or should be derived from
  OpenClaw/channel state.
- Remove config fields that exist only for unreleased legacy compatibility.

### Internal Modules

- Fold simple wrappers that only rename another module or function.
- Revisit `app-api.ts`, `target-status.ts`, `setup-login.ts`,
  `cloudflare-tunnel.ts`, and `export.ts` after command-surface decisions.
- Keep modules split only when they own a real concern: parsing, output, setup,
  auth, config/state, API access, install/runtime, or resolution.
- Avoid duplicated types between command handlers and lib modules.
- Import from the real source file; do not create barrels for convenience.

### Tests And Verification

- Update smoke tests after command-surface decisions so they assert the intended
  public surface, not old accidental breadth.
- Keep focused tests for setup steps, account login, resolution, output
  envelopes, and config migration/reset behavior.
- Remove tests only when the behavior they cover is intentionally removed or
  covered better elsewhere.
- Keep `bun run typecheck`, `bun packages/cli/test/cli-smoke.ts`, and
  `bun run check` green after each cleanup pass.

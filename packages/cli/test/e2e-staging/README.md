# Beeper CLI Staging E2E

This harness is for coordinated staging QA of the Beeper CLI command surface.
The default run prints a plan only. It does not launch apps, download artifacts,
or touch the default Desktop instance.

## Safety Model

- Use a fresh `BEEPER_E2E_RUN_ID` per run.
- Use `BEEPER_E2E_WORKDIR` under `/tmp` unless preserving artifacts.
- The harness writes CLI state under `BEEPER_E2E_CONFIG_DIR`, defaulting to `<workdir>/cli-config`.
- Use non-default PAS ports. The default starts at `24573`, not `23373`.
- Every test target uses `--server-env staging`.
- Put staging OTPs in `.env.e2e` or set `BEEPER_E2E_ENV_FILE`; reports redact OTPs, setup responses, access tokens, and lead tokens.
- Do not run `install-server` unless you intend to download the staging server artifact.

## Basic Plan

```sh
cd path/to/cli
bun run --filter beeper-cli build

BEEPER_E2E_RUN_ID=qa-$(date +%Y%m%d-%H%M%S) \
bun packages/cli/test/e2e-staging.ts
```

The plan output shows target names, ports, emails, and follow-up commands.

## Full Coordinated Surface Run

Use this when a staging server binary already exists or `BEEPER_SERVER_BIN` is
set. This creates isolated targets, starts them, authenticates Desktop targets
with `beeper setup --local` and Server targets through the setup API, checks
readiness, runs messaging coverage, creates a group when three QA users are
available, runs CLI/API surface coverage, and stops local server targets.

```sh
BEEPER_E2E_RUN_ID=qa-$(date +%Y%m%d-%H%M%S) \
BEEPER_E2E_ENV_FILE=.env.e2e \
BEEPER_E2E_PHASES=targets,start,login,readiness,messaging,surface,cleanup \
BEEPER_E2E_ACCOUNT_COUNT=3 \
BEEPER_E2E_DESKTOP_TARGETS=1 \
BEEPER_E2E_SERVER_TARGETS=2 \
BEEPER_E2E_PORT_START=24573 \
bun packages/cli/test/e2e-staging.ts
```

The report is written to `/tmp/beeper-cli-e2e-<run-id>/report.json` by default.
Expected human steps are written under `blocked`; harness failures are written
under `failures`.

The `surface` phase is the consolidated Desktop/Client API coverage pass. It
uses CLI commands when the CLI has a first-class command and falls back to
`beeper api request` for raw API methods that do not have a dedicated command.
It intentionally does not add external network accounts; `accounts add` is
covered only up to listing available account types.

## Downloading Beeper Server

Only run this when you want the CLI to download the staging server artifact:

```sh
BEEPER_E2E_RUN_ID=qa-$(date +%Y%m%d-%H%M%S) \
BEEPER_E2E_OTP="$QA_OTP" \
BEEPER_E2E_PHASES=targets,install-server,start,login,readiness,messaging,cleanup \
bun packages/cli/test/e2e-staging.ts
```

The `install-server` phase runs:

```sh
beeper install server --server-env staging --json
```

That command downloads software. It does not install npm, GitHub, or package
dependencies, and it does not modify lockfiles.

## Manual Coordination Points

If login is blocked, the report includes target-specific commands for opening
the isolated target and rerunning `setup --local` or the setup API commands.
Complete the browser or Desktop UI step, then rerun:

```sh
BEEPER_E2E_RUN_ID=<same-run-id> \
BEEPER_E2E_OTP="$QA_OTP" \
BEEPER_E2E_PHASES=login,readiness,messaging,cleanup \
bun packages/cli/test/e2e-staging.ts
```

## Cleanup

Managed server targets can be stopped through the CLI:

```sh
BEEPER_E2E_RUN_ID=<same-run-id> \
BEEPER_E2E_PHASES=cleanup \
bun packages/cli/test/e2e-staging.ts
```

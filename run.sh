#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
cd packages/cli
exec bun run dev -- "$@"

#!/bin/sh
set -e

# Config is mounted read-only — copy to writable location so plugin install can update it
cp /config/openclaw.json /tmp/openclaw.json
export OPENCLAW_CONFIG_PATH=/tmp/openclaw.json

# Register the local plugin (idempotent — safe to run on every start)
npx openclaw plugins install /app --yes 2>/dev/null || \
  npx openclaw plugins install --path /app --yes 2>/dev/null || true

exec npx openclaw gateway

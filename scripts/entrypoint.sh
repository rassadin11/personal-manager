#!/bin/sh
set -e

# Copy read-only config to writable location
cp /config/openclaw.json /tmp/openclaw.json
export OPENCLAW_CONFIG_PATH=/tmp/openclaw.json

# Plugin lives at /root/.openclaw/extensions/personal-manager (physical copy in Dockerfile).
# OpenClaw auto-discovers it via the extensions dir scan; we only need to enable it explicitly
# (bundled/non-allow-listed plugins default to disabled).
jq '.plugins.entries["anthropic"] = {"enabled": false} |
    .plugins.entries["personal-manager"] = {"enabled": true}' \
    /tmp/openclaw.json > /tmp/openclaw.json.tmp \
  && mv /tmp/openclaw.json.tmp /tmp/openclaw.json

exec npx openclaw gateway

#!/bin/sh
set -e

# Copy read-only config to writable location
cp /config/openclaw.json /tmp/openclaw.json
export OPENCLAW_CONFIG_PATH=/tmp/openclaw.json

# Register plugin directly in config (symlink target: /root/.openclaw/extensions/personal-manager -> /app)
jq '.plugins.entries["anthropic"] = {"enabled": false} |
    .plugins.entries["personal-manager"] = {"enabled": true} |
    .plugins.installs["personal-manager"] = {
      "source": "path",
      "sourcePath": "/app",
      "installPath": "/root/.openclaw/extensions/personal-manager",
      "version": "0.1.0",
      "installedAt": "2026-04-25T09:44:29.178Z"
    }' /tmp/openclaw.json > /tmp/openclaw.json.tmp \
  && mv /tmp/openclaw.json.tmp /tmp/openclaw.json

exec npx openclaw gateway

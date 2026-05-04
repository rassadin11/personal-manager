#!/bin/sh
set -e

cp /config/openclaw.json /tmp/openclaw.json
export OPENCLAW_CONFIG_PATH=/tmp/openclaw.json

PLUGIN_PATH="/home/artem/.openclaw/extensions/personal-manager"

# Если named volume пустой — заливаем плагин из образа
if [ ! -f "$PLUGIN_PATH/package.json" ]; then
  mkdir -p "$PLUGIN_PATH"
  cp -r /app/. "$PLUGIN_PATH/"
  rm -rf "$PLUGIN_PATH/node_modules/openclaw/dist/extensions"
fi

mkdir -p /home/artem/.openclaw/workspace

# Гарантируем, что пути и enable-флаги всегда корректны
jq --arg path "$PLUGIN_PATH" \
   --arg ws   "/home/artem/.openclaw/workspace" '
  .plugins.entries["anthropic"].enabled = false |
  .plugins.entries["personal-manager"].enabled = true |
  .plugins.installs["personal-manager"].installPath = $path |
  .plugins.installs["personal-manager"].sourcePath  = $path |
  .agents.defaults.workspace = $ws
' /tmp/openclaw.json > /tmp/openclaw.json.tmp && mv /tmp/openclaw.json.tmp /tmp/openclaw.json

exec npx openclaw gateway
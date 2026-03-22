#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${WECHAT_AGENT_CONFIG:-$ROOT_DIR/wechat-agent.config.json}"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required" >&2
  exit 1
fi

if [ ! -f package-lock.json ]; then
  npm install
else
  npm install
fi

npm run build

if [ ! -f "$CONFIG_PATH" ]; then
  cp "$ROOT_DIR/config/wechat-agent.example.json" "$CONFIG_PATH"
  echo "created config: $CONFIG_PATH"
fi

echo "bootstrap complete"


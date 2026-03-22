#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ROOT_DIR="$(resolve_repo_root)"
PROJECT_DIR="$(resolve_project_dir)"
CONFIG_PATH="${WECHAT_AGENT_CONFIG:-$ROOT_DIR/wechat-agent.config.json}"

echo "repo: $ROOT_DIR"
echo "project: $PROJECT_DIR"
echo "config: $CONFIG_PATH"

if [ -f "$ROOT_DIR/packages/gateway/dist/cli.js" ]; then
  echo "gateway: built"
else
  echo "gateway: not built"
fi

if [ -f "$CONFIG_PATH" ]; then
  echo "config-file: present"
else
  echo "config-file: missing"
fi

if [ -f "$ROOT_DIR/packages/gateway/dist/cli.js" ] && [ -f "$CONFIG_PATH" ]; then
  node "$ROOT_DIR/packages/gateway/dist/cli.js" status --config "$CONFIG_PATH"
fi

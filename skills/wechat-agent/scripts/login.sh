#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ROOT_DIR="$(resolve_repo_root)"
PROJECT_DIR="$(resolve_project_dir)"
CONFIG_PATH="${WECHAT_AGENT_CONFIG:-$ROOT_DIR/wechat-agent.config.json}"

if [ ! -f "$ROOT_DIR/packages/gateway/dist/cli.js" ]; then
  bash "$ROOT_DIR/scripts/bootstrap.sh"
fi

node "$ROOT_DIR/packages/gateway/dist/cli.js" login --config "$CONFIG_PATH" --project-dir "$PROJECT_DIR"

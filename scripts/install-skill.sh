#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_BASE="${CODEX_HOME:-$HOME/.codex}/skills"
TARGET_DIR="$TARGET_BASE/wechat-agent"

mkdir -p "$TARGET_BASE"
rm -rf "$TARGET_DIR"
cp -R "$ROOT_DIR/skills/wechat-agent" "$TARGET_DIR"
printf '%s\n' "$ROOT_DIR" > "$TARGET_DIR/.repo-root"
chmod +x "$TARGET_DIR"/scripts/*.sh

echo "installed skill to: $TARGET_DIR"
echo "repo root pinned to: $ROOT_DIR"

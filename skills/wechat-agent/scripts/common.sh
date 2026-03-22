#!/bin/bash
set -euo pipefail

resolve_skill_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

resolve_repo_root() {
  local skill_dir
  skill_dir="$(resolve_skill_dir)"

  if [ -n "${WECHAT_AGENT_REPO:-}" ]; then
    printf '%s\n' "$WECHAT_AGENT_REPO"
    return
  fi

  if [ -f "$skill_dir/.repo-root.local" ]; then
    cat "$skill_dir/.repo-root.local"
    return
  fi

  if [ -f "$skill_dir/.repo-root" ]; then
    cat "$skill_dir/.repo-root"
    return
  fi

  if [ -f "$skill_dir/../../package.json" ]; then
    cd "$skill_dir/../.." && pwd
    return
  fi

  echo "cannot determine repository root for wechat-agent skill" >&2
  exit 1
}

resolve_project_dir() {
  if [ -n "${WECHAT_AGENT_PROJECT_DIR:-}" ]; then
    printf '%s\n' "$WECHAT_AGENT_PROJECT_DIR"
    return
  fi
  printf '%s\n' "$PWD"
}

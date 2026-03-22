---
name: wechat-agent
description: Connect a local agent CLI to WeChat through a generic gateway. Use when the user wants Claude Code, Codex, or another local agent CLI to receive and reply to WeChat messages, start or check the gateway, log into WeChat, or inspect the connector status.
---

Use this skill when the task is to operate or troubleshoot the local WeChat agent gateway.

## What This Skill Does

- bootstraps the repository if needed
- detects local supported CLIs and selects one on first run
- binds the gateway to the current project directory so the selected CLI uses that project's own defaults
- checks whether WeChat is already connected
- runs QR login automatically when not connected
- ensures the gateway is running in the background
- shows runtime and service status

## Scripts

- `scripts/ensure.sh`: full auto path, including setup, login, and start
- `scripts/status.sh`: show build and runtime status
- `scripts/login.sh`: run QR login only
- `scripts/start.sh`: start the gateway in background
- `scripts/install.sh`: install this skill into the default Codex skills directory

## Workflow

1. Prefer `bash scripts/ensure.sh`.
2. `ensure.sh` will bootstrap the repo if needed.
3. On first run it will detect local CLIs such as Codex, Claude Code, or OpenCode and ask the user to confirm one when needed.
4. The current working directory becomes the project directory unless `WECHAT_AGENT_PROJECT_DIR` is set. This is the directory where Codex or Claude Code runs, so that project's own rules and defaults apply automatically.
5. If no WeChat account is connected, it will start QR login.
6. If the gateway is not running, it will start it in background.
7. On macOS it uses `launchd` for auto-start and automatic restart.
8. Use `bash scripts/status.sh` when debugging.

## Project Directory

The selected CLI runs inside the configured project directory. By default this is the current directory when `ensure.sh` runs.

That means:

- Codex uses the project's own rules and defaults
- Claude Code uses the project's own rules and defaults
- this skill does not inject a custom system prompt for those native adapters

Set `WECHAT_AGENT_PROJECT_DIR=/absolute/path/to/project` before running the skill if the gateway should target a different project.

---
name: wechat-agent
description: Connect a local agent CLI to WeChat through a generic gateway. Use when the user wants Claude Code, Codex, or another local agent CLI to receive and reply to WeChat messages, start or check the gateway, log into WeChat, or inspect the connector status.
---

Use this skill when the task is to operate or troubleshoot the local WeChat agent gateway.

## What This Skill Does

- bootstraps the repository if needed
- checks whether WeChat is already connected
- runs QR login automatically when not connected
- ensures the gateway is running in the background
- shows status and expected adapter contract

## Scripts

- `scripts/ensure.sh`: full auto path, including setup, login, and start
- `scripts/status.sh`: show build and runtime status
- `scripts/login.sh`: run QR login only
- `scripts/start.sh`: start the gateway in background
- `scripts/install.sh`: install this skill into the default Codex skills directory

## Workflow

1. Prefer `bash scripts/ensure.sh`.
2. `ensure.sh` will bootstrap the repo if needed.
3. If no WeChat account is connected, it will start QR login.
4. If the gateway is not running, it will start it in background.
5. Use `bash scripts/status.sh` when debugging.

## Adapter Contract

The configured CLI must:

- read one JSON event from stdin
- write one JSON reply to stdout

Minimal stdout shape:

```json
{
  "text": "reply text"
}
```

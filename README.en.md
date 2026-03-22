# WeChat Agent Connector

[简体中文](./README.md)

Open source WeChat gateway for agent CLIs.

This repository turns the reusable parts of Tencent's OpenClaw WeChat plugin into a standalone connector: a long-running gateway receives WeChat messages, invokes a local agent CLI, and sends the reply back to WeChat.

What already works:

- QR-code login for WeChat bot accounts
- long-poll receive loop
- text reply delivery
- native adapters for Codex and Claude Code
- shell-json adapter for custom CLIs
- per-user CLI session resume
- project-directory aware execution for native CLIs
- Skill wrapper for Codex / Claude Code style environments
- macOS launchd auto-start, keep-alive, and health checks

Near-term roadmap:

- richer media support
- MCP control surface
- multiple adapter types
- Linux and Windows service management

## Repository Layout

```text
packages/
  gateway/       gateway process and shell adapter
  weixin-core/   WeChat transport, auth, polling, state
skills/
  wechat-agent/  Skill entrypoint and helper scripts
config/
  wechat-agent.example.json
```

## Quick Start

```bash
bash scripts/install-skill.sh
```

After the Skill is installed, the recommended operator flow is:

```bash
bash ~/.codex/skills/wechat-agent/scripts/ensure.sh
```

`ensure.sh` will:

- install dependencies
- build the repository
- create `wechat-agent.config.json` if missing
- detect supported local CLIs and select one on first run
- bind the gateway to the current project directory
- check whether WeChat is already connected
- run QR login if needed
- start the gateway in background if needed
- on macOS, install or refresh a `launchd` service with automatic restart

Manual CLI usage is still available:

```bash
bash scripts/bootstrap.sh
node packages/gateway/dist/cli.js ensure --config ./wechat-agent.config.json
```

The directory where you run `ensure` becomes the default `projectDir`. Native adapters run inside that directory, so Codex and Claude Code naturally pick up that project's own instructions and defaults. If you want a different project, pass `--project-dir /absolute/path/to/project` or set `WECHAT_AGENT_PROJECT_DIR`.

## Adapter Model

The gateway uses an adapter protocol. Current built-in adapter types are:

- `codex`
- `claude-code`
- `opencode`
- `shell-json`

The first `ensure` run detects supported CLIs on the local machine and writes the selected adapter into `wechat-agent.config.json`.

Current behavior:

- `codex` uses `codex exec` and `codex exec resume`
- `claude-code` uses `claude -p` and `claude --resume`
- `shell-json` expects one JSON event on stdin and one JSON reply on stdout

The native `codex` and `claude-code` adapters do not inject a custom system prompt. They forward the incoming WeChat message as user input and rely on the selected project's own CLI defaults and repository instructions.

The gateway stores a local CLI session id per `accountId + userId`, so repeated messages from the same WeChat user resume the same native CLI session when the adapter supports it.

## Runtime Model

This connector has two layers:

- Skill: the operator-facing entrypoint used inside Codex or Claude Code style environments
- Gateway: the long-running process that polls WeChat and invokes the selected CLI

On macOS, `start` and `ensure` manage the gateway through `launchd`. That gives:

- auto-start on login
- keep-alive restart on crash
- service-level status checks with `doctor` and `status`

Current service management is macOS-only. The gateway itself is cross-platform, but Linux and Windows still need their own service managers.

For custom CLIs, the `shell-json` adapter contract is:

Example adapter contract:

```json
{
  "accountId": "wx-bot-1",
  "userId": "alice@im.wechat",
  "text": "hello",
  "contextToken": "..."
}
```

Expected stdout:

```json
{
  "text": "hi from my agent"
}
```

## Skill

The repository also ships a `wechat-agent` Skill under [skills/wechat-agent](./skills/wechat-agent). It is the operator-facing control plane:

- verify installation
- detect and configure the current local CLI
- log in to WeChat when needed
- start the gateway when needed
- bind the gateway to the intended project directory
- surface runtime health and service status

When QR login starts, the connector:

- prints the terminal QR code
- prints the QR URL
- writes a temporary local helper HTML page with a real QR image
- opens that helper page in the default browser on macOS
- removes the helper page on success, timeout, or process exit

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)

## Status

This repository is still pre-1.0. Interfaces may continue to evolve, but the product direction is already fixed: make “WeChat -> gateway -> current CLI -> WeChat” reliable.

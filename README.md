# WeChat Agent Connector

Open source WeChat gateway for agent CLIs.

This project extracts the useful WeChat transport pieces from Tencent's OpenClaw WeChat plugin and repackages them into a generic connector that can drive any local agent CLI through a long-running gateway.

Current MVP:

- QR-code login for WeChat bot accounts
- long-poll receive loop
- text reply delivery
- shell adapter for local CLIs
- Skill wrapper for Codex / Claude Code style environments

Planned next:

- richer media support
- MCP control surface
- multiple adapter types
- daemon supervision and richer session policies

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

After the Skill is installed, the intended operator flow is:

```bash
bash ~/.codex/skills/wechat-agent/scripts/ensure.sh
```

`ensure.sh` will:

- install dependencies
- build the repository
- create `wechat-agent.config.json` if missing
- check whether WeChat is already connected
- run QR login if needed
- start the gateway in background if needed

Manual CLI flow is still available:

```bash
bash scripts/bootstrap.sh
node packages/gateway/dist/cli.js ensure --config ./wechat-agent.config.json
```

The shell adapter expects a CLI that reads one JSON event from stdin and prints a JSON reply to stdout.

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

The repository also ships a `wechat-agent` Skill under [skills/wechat-agent](./skills/wechat-agent). The Skill is the operator-facing control plane:

- verify installation
- log in to WeChat when needed
- start the gateway when needed
- explain how to bind the current CLI

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)

## Status

This repository is pre-1.0. Expect interface changes while the generic gateway contract stabilizes.

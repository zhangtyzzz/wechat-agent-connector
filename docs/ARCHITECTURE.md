# Architecture

## Layers

### `packages/weixin-core`

Pure transport layer.

Responsibilities:

- QR login
- account credential persistence
- WeChat HTTP API client
- long-poll cursor handling
- inbound message normalization

Non-goals:

- agent routing
- OpenClaw runtime integration
- shell process orchestration

### `packages/gateway`

Runtime orchestration layer.

Responsibilities:

- load connector config
- load stored WeChat account
- run the long-poll loop
- persist per-user session state
- call the configured adapter
- send replies back through `weixin-core`

### `skills/wechat-agent`

Operator-facing control plane.

Responsibilities:

- show status
- run login
- start the gateway
- explain the adapter contract

## Event Flow

```text
WeChat user
  -> WeChat long-poll API
  -> weixin-core poller
  -> gateway session lookup
  -> shell adapter
  -> local agent CLI
  -> shell adapter stdout JSON
  -> weixin-core sendmessage
  -> WeChat user
```

## Current MVP Boundaries

- text in
- text out
- single stored account by default
- single shell adapter target

Media and richer adapters are intentionally deferred until the generic message contract stabilizes.


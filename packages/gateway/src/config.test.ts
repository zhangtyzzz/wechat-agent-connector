import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGatewayConfig, resolveProjectDir } from "./config.js";
import type { GatewayConfig } from "./types.js";

test("resolveProjectDir defaults to config directory", () => {
  const projectDir = resolveProjectDir("/tmp/demo/wechat-agent.config.json");
  assert.equal(projectDir, "/tmp/demo");
});

test("normalizeGatewayConfig resolves relative projectDir and adapter cwd", () => {
  const normalized = normalizeGatewayConfig(
    {
      stateDir: "~/.wechat-agent",
      projectDir: "../workspace",
      weixin: {
        baseUrl: "https://ilinkai.weixin.qq.com",
      },
      adapter: {
        type: "codex",
        command: "codex",
        args: [],
      },
    },
    "/tmp/demo/config/wechat-agent.config.json",
  );

  assert.equal(normalized.projectDir, "/tmp/demo/workspace");
  assert.equal(normalized.adapter.cwd, "/tmp/demo/workspace");
});

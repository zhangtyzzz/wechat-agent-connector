import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureAdapterConfigured } from "./configure-adapter.js";
import { loadGatewayConfig, saveGatewayConfig } from "./config.js";
import { resolveAdapterConfig } from "./adapters.js";
import type { GatewayConfig } from "./types.js";

test("ensureAdapterConfigured keeps existing adapter selection", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-config-"));
  const configPath = path.join(dir, "wechat-agent.config.json");
  const initial: GatewayConfig = {
    stateDir: "~/.wechat-agent",
    weixin: {
      baseUrl: "https://ilinkai.weixin.qq.com",
    },
    adapter: {
      type: "shell-json",
      command: "node",
      args: ["./examples/echo-agent.mjs"],
      mode: "stdin-json",
      timeoutMs: 120000,
    },
  };
  saveGatewayConfig(configPath, initial);

  const result = await ensureAdapterConfigured(configPath, loadGatewayConfig(configPath), console);
  assert.equal(result.adapter.type, "shell-json");
  assert.equal(result.adapter.command, "node");
});

test("resolveAdapterConfig keeps working with a named command", () => {
  const resolved = resolveAdapterConfig({
    type: "claude-code",
    command: "claude",
    args: [],
    mode: "stdin-json",
    timeoutMs: 120000,
    cwd: "/tmp/project",
  });

  assert.ok(resolved.command.endsWith("/claude") || resolved.command === "claude");
  assert.equal(resolved.cwd, "/tmp/project");
});

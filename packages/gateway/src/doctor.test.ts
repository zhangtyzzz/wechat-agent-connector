import test from "node:test";
import assert from "node:assert/strict";

import { buildDoctorReport } from "./doctor.js";
import type { GatewayConfig } from "./types.js";

test("buildDoctorReport exposes project and adapter status", () => {
  const report = buildDoctorReport("/tmp/project/wechat-agent.config.json", {
    stateDir: "/tmp/.wechat-agent",
    projectDir: "/tmp/project",
    weixin: {
      baseUrl: "https://ilinkai.weixin.qq.com",
    },
    adapter: {
      type: "codex",
      command: "codex",
      args: [],
      cwd: "/tmp/project",
    },
  } satisfies GatewayConfig);

  assert.equal(report.projectDir, "/tmp/project");
  assert.equal(report.selectedAdapter, "codex");
  assert.ok(Array.isArray(report.detectedAdapters));
  assert.equal(typeof report.daemon.running, "boolean");
});

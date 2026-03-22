import test from "node:test";
import assert from "node:assert/strict";

import { buildServicePlist, resolveServicePaths } from "./service.js";
import type { GatewayConfig } from "./types.js";

function makeConfig(): GatewayConfig {
  return {
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
  };
}

test("resolveServicePaths derives a stable label and plist path", () => {
  const paths = resolveServicePaths("/tmp/project/wechat-agent.config.json", makeConfig());
  assert.match(paths.label, /^ai\.wechat-agent\.gateway\.[a-f0-9]{10}$/);
  assert.match(paths.plistPath, /Library\/LaunchAgents\/ai\.wechat-agent\.gateway\.[a-f0-9]{10}\.plist$/);
});

test("buildServicePlist pins working directory and config path", () => {
  const plist = buildServicePlist({
    label: "ai.wechat-agent.gateway.test",
    cliPath: "/tmp/repo/packages/gateway/dist/cli.js",
    configPath: "/tmp/repo/wechat-agent.config.json",
    cwd: "/tmp/project",
    logFile: "/tmp/.wechat-agent/gateway.log",
    pathEnv: "/opt/homebrew/bin:/usr/bin:/bin",
  });

  assert.match(plist, /<string>ai\.wechat-agent\.gateway\.test<\/string>/);
  assert.match(plist, /<string>\/tmp\/project<\/string>/);
  assert.match(plist, /<string>\/tmp\/repo\/wechat-agent\.config\.json<\/string>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<key>EnvironmentVariables<\/key>/);
  assert.match(plist, /<string>\/opt\/homebrew\/bin:\/usr\/bin:\/bin<\/string>/);
});

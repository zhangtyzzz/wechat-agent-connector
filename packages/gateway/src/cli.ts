#!/usr/bin/env node

import { loginWithQr } from "@wechat-agent/weixin-core";

import { loadGatewayConfig, resolveConfigPath } from "./config.js";
import { daemonStatus, startDaemon, stopDaemon } from "./daemon.js";
import { describeAccount, hasStoredAccount, persistAccount, serveGateway } from "./gateway.js";

async function runSetup(configPath: string): Promise<void> {
  const repoRoot = process.cwd();
  const fs = await import("node:fs");
  const path = await import("node:path");
  if (!fs.existsSync(path.resolve(repoRoot, "package.json"))) {
    throw new Error("setup must be run from the repository root");
  }
  const { spawnSync } = await import("node:child_process");
  const install = spawnSync("npm", ["install"], { stdio: "inherit", cwd: repoRoot });
  if (install.status !== 0) {
    throw new Error("npm install failed");
  }
  const build = spawnSync("npm", ["run", "build"], { stdio: "inherit", cwd: repoRoot });
  if (build.status !== 0) {
    throw new Error("npm run build failed");
  }
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(path.resolve(repoRoot, "config/wechat-agent.example.json"), configPath);
    console.log(`created config ${configPath}`);
  }
}

function getFlagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function getCommand(): string {
  return process.argv[2] ?? "help";
}

function printHelp(): void {
  process.stdout.write(`Usage: wechat-agent-gateway <command> [options]

Commands:
  setup              Install deps, build, and create config if missing
  login              Start QR login and persist account credentials
  serve              Start long-poll gateway
  start              Start gateway in background
  stop               Stop background gateway
  restart            Restart background gateway
  status             Show stored account state
  ensure             Setup if needed, login if needed, start if needed
  help               Show this help

Options:
  --config <path>    Path to gateway config JSON
`);
}

async function run(): Promise<void> {
  const command = getCommand();
  const configPath = resolveConfigPath(getFlagValue("--config"));
  const config = loadGatewayConfig(configPath);

  switch (command) {
    case "setup":
      await runSetup(configPath);
      return;
    case "login": {
      const account = await loginWithQr(
        {
          baseUrl: config.weixin.baseUrl,
          cdnBaseUrl: config.weixin.cdnBaseUrl,
        },
        console,
      );
      persistAccount(config, account);
      console.log(`saved account ${account.accountId} in ${config.stateDir}`);
      return;
    }
    case "serve":
      await serveGateway(config, console);
      return;
    case "start": {
      const status = daemonStatus(config);
      if (status.running) {
        console.log(`gateway already running pid=${status.pid}`);
        return;
      }
      const started = startDaemon(configPath, config);
      console.log(`gateway started pid=${started.pid} log=${started.logFile}`);
      return;
    }
    case "stop": {
      const stopped = stopDaemon(config);
      if (stopped.stopped) {
        console.log(`gateway stopped pid=${stopped.pid}`);
      } else {
        console.log("gateway was not running");
      }
      return;
    }
    case "restart": {
      stopDaemon(config);
      const started = startDaemon(configPath, config);
      console.log(`gateway restarted pid=${started.pid} log=${started.logFile}`);
      return;
    }
    case "status": {
      const account = describeAccount(config);
      const daemon = daemonStatus(config);
      console.log(JSON.stringify({ ...account, daemon }, null, 2));
      return;
    }
    case "ensure": {
      await runSetup(configPath);
      const freshConfig = loadGatewayConfig(configPath);
      if (!hasStoredAccount(freshConfig)) {
        const account = await loginWithQr(
          {
            baseUrl: freshConfig.weixin.baseUrl,
            cdnBaseUrl: freshConfig.weixin.cdnBaseUrl,
          },
          console,
        );
        persistAccount(freshConfig, account);
        console.log(`saved account ${account.accountId} in ${freshConfig.stateDir}`);
      } else {
        console.log("wechat account already connected");
      }
      const status = daemonStatus(freshConfig);
      if (!status.running) {
        const started = startDaemon(configPath, freshConfig);
        console.log(`gateway started pid=${started.pid} log=${started.logFile}`);
      } else {
        console.log(`gateway already running pid=${status.pid}`);
      }
      return;
    }
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

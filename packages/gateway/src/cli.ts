#!/usr/bin/env node

import { loginWithQr } from "@wechat-agent/weixin-core";

import { loadGatewayConfig, normalizeGatewayConfig, resolveConfigPath, saveGatewayConfig } from "./config.js";
import { ensureAdapterConfigured } from "./configure-adapter.js";
import { daemonStatus, startDaemon, stopDaemon } from "./daemon.js";
import { buildDoctorReport, printDoctorReport } from "./doctor.js";
import { describeAccount, hasStoredAccount, persistAccount, serveGateway } from "./gateway.js";
import { getServiceStatus, serviceAction } from "./service.js";

async function runSetup(configPath: string, projectDir?: string): Promise<void> {
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
  if (projectDir?.trim()) {
    const config = loadGatewayConfig(configPath);
    config.projectDir = projectDir;
    if (config.adapter.type !== "auto") {
      config.adapter.cwd = projectDir;
    }
    const normalized = normalizeGatewayConfig(config, configPath);
    saveGatewayConfig(configPath, normalized);
    console.log(`project dir: ${normalized.projectDir}`);
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
  configure-adapter  Detect and select the local agent CLI adapter
  login              Start QR login and persist account credentials
  serve              Start long-poll gateway
  start              Start gateway in background
  stop               Stop background gateway
  restart            Restart background gateway
  service-install    Install and load launchd service on macOS
  service-uninstall  Uninstall launchd service on macOS
  status             Show stored account state
  doctor             Run local health checks
  ensure             Setup if needed, login if needed, start if needed
  help               Show this help

Options:
  --config <path>    Path to gateway config JSON
  --project-dir <path>
                     Project directory used as the adapter working directory
`);
}

function loadCommandConfig(configPath: string, projectDir?: string) {
  const loaded = loadGatewayConfig(configPath);
  if (!projectDir?.trim()) {
    return loaded;
  }
  return normalizeGatewayConfig(
    {
      ...loaded,
      projectDir,
      adapter: {
        ...loaded.adapter,
        cwd: projectDir,
      },
    },
    configPath,
  );
}

async function run(): Promise<void> {
  const command = getCommand();
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  const configPath = resolveConfigPath(getFlagValue("--config"));
  const projectDir = getFlagValue("--project-dir");

  switch (command) {
    case "setup":
      await runSetup(configPath, projectDir);
      return;
    case "configure-adapter": {
      const config = loadCommandConfig(configPath, projectDir);
      await ensureAdapterConfigured(configPath, config, console);
      return;
    }
    case "login": {
      const config = loadCommandConfig(configPath, projectDir);
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
      await serveGateway(loadCommandConfig(configPath, projectDir), console);
      return;
    case "start": {
      const config = loadCommandConfig(configPath, projectDir);
      if (process.platform === "darwin") {
        stopDaemon(config);
        const service = serviceAction("start", configPath, config);
        console.log(JSON.stringify(service, null, 2));
      } else {
        const status = daemonStatus(config);
        if (status.running) {
          console.log(`gateway already running pid=${status.pid}`);
          return;
        }
        const started = startDaemon(configPath, config);
        console.log(`gateway started pid=${started.pid} log=${started.logFile}`);
      }
      return;
    }
    case "stop": {
      const config = loadCommandConfig(configPath, projectDir);
      if (process.platform === "darwin") {
        const service = serviceAction("stop", configPath, config);
        stopDaemon(config);
        console.log(JSON.stringify(service, null, 2));
      } else {
        const stopped = stopDaemon(config);
        if (stopped.stopped) {
          console.log(`gateway stopped pid=${stopped.pid}`);
        } else {
          console.log("gateway was not running");
        }
      }
      return;
    }
    case "restart": {
      const config = loadCommandConfig(configPath, projectDir);
      if (process.platform === "darwin") {
        stopDaemon(config);
        serviceAction("stop", configPath, config);
        const service = serviceAction("start", configPath, config);
        console.log(JSON.stringify(service, null, 2));
      } else {
        stopDaemon(config);
        const started = startDaemon(configPath, config);
        console.log(`gateway restarted pid=${started.pid} log=${started.logFile}`);
      }
      return;
    }
    case "service-install": {
      const config = loadCommandConfig(configPath, projectDir);
      if (process.platform !== "darwin") {
        throw new Error("service-install is only supported on macOS");
      }
      stopDaemon(config);
      const service = serviceAction("install", configPath, config);
      console.log(JSON.stringify(service, null, 2));
      return;
    }
    case "service-uninstall": {
      const config = loadCommandConfig(configPath, projectDir);
      if (process.platform !== "darwin") {
        throw new Error("service-uninstall is only supported on macOS");
      }
      const service = serviceAction("uninstall", configPath, config);
      console.log(JSON.stringify(service, null, 2));
      return;
    }
    case "status": {
      const config = loadCommandConfig(configPath, projectDir);
      const account = describeAccount(config);
      const daemon = daemonStatus(config);
      const service = getServiceStatus(configPath, config);
      console.log(JSON.stringify({ ...account, projectDir: config.projectDir, adapter: config.adapter, daemon, service }, null, 2));
      return;
    }
    case "doctor": {
      const config = loadCommandConfig(configPath, projectDir);
      printDoctorReport(buildDoctorReport(configPath, config));
      return;
    }
    case "ensure": {
      await runSetup(configPath, projectDir);
      let freshConfig = loadGatewayConfig(configPath);
      freshConfig = await ensureAdapterConfigured(configPath, freshConfig, console);
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
      if (process.platform === "darwin") {
        stopDaemon(freshConfig);
        const service = serviceAction("start", configPath, freshConfig);
        console.log(JSON.stringify(service, null, 2));
      } else {
        const status = daemonStatus(freshConfig);
        if (!status.running) {
          const started = startDaemon(configPath, freshConfig);
          console.log(`gateway started pid=${started.pid} log=${started.logFile}`);
        } else {
          console.log(`gateway already running pid=${status.pid}`);
        }
      }
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

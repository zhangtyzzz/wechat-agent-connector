import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { GatewayConfig } from "./types.js";

type DaemonPaths = {
  pidFile: string;
  logFile: string;
};

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function resolveDaemonPaths(config: GatewayConfig): DaemonPaths {
  const pidFile = config.daemon?.pidFile ?? path.join(config.stateDir, "gateway.pid");
  const logFile = config.daemon?.logFile ?? path.join(config.stateDir, "gateway.log");
  return { pidFile, logFile };
}

export function readPid(pidFile: string): number | null {
  try {
    const raw = fs.readFileSync(pidFile, "utf8").trim();
    if (!raw) return null;
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function isPidRunning(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startDaemon(configPath: string, config: GatewayConfig): { pid: number; logFile: string } {
  const { pidFile, logFile } = resolveDaemonPaths(config);
  ensureParent(pidFile);
  ensureParent(logFile);

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  const child = spawn(process.execPath, [cliPath, "serve", "--config", configPath], {
    detached: true,
    stdio: ["ignore", out, err],
  });

  child.unref();
  fs.writeFileSync(pidFile, String(child.pid), "utf8");
  return { pid: child.pid ?? 0, logFile };
}

export function stopDaemon(config: GatewayConfig): { stopped: boolean; pid: number | null } {
  const { pidFile } = resolveDaemonPaths(config);
  const pid = readPid(pidFile);
  if (!pid || !isPidRunning(pid)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {}
    return { stopped: false, pid };
  }
  process.kill(pid, "SIGTERM");
  try {
    fs.unlinkSync(pidFile);
  } catch {}
  return { stopped: true, pid };
}

export function daemonStatus(config: GatewayConfig): { running: boolean; pid: number | null; logFile: string; pidFile: string } {
  const { pidFile, logFile } = resolveDaemonPaths(config);
  const pid = readPid(pidFile);
  return {
    running: isPidRunning(pid),
    pid,
    logFile,
    pidFile,
  };
}

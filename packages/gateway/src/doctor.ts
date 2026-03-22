import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectAvailableAdapters } from "./adapters.js";
import { resolveConfigPath } from "./config.js";
import { daemonStatus } from "./daemon.js";
import { describeAccount } from "./gateway.js";
import { getServiceStatus } from "./service.js";
import type { GatewayConfig } from "./types.js";

export interface DoctorReport {
  configPath: string;
  configExists: boolean;
  gatewayBuilt: boolean;
  accountConnected: boolean;
  selectedAdapter: string;
  detectedAdapters: string[];
  projectDir: string;
  daemon: ReturnType<typeof daemonStatus>;
  service: ReturnType<typeof getServiceStatus>;
}

export function buildDoctorReport(configPath: string, config: GatewayConfig): DoctorReport {
  const resolvedConfigPath = resolveConfigPath(configPath);
  const account = describeAccount(config);
  const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  const service = getServiceStatus(resolvedConfigPath, config);
  return {
    configPath: resolvedConfigPath,
    configExists: fs.existsSync(resolvedConfigPath),
    gatewayBuilt: fs.existsSync(cliPath),
    accountConnected: Boolean(account.account?.token),
    selectedAdapter: config.adapter.type,
    detectedAdapters: detectAvailableAdapters().map((item) => `${item.type}:${item.command}`),
    projectDir: config.projectDir ?? path.dirname(resolvedConfigPath),
    daemon: daemonStatus(config),
    service,
  };
}

export function printDoctorReport(report: DoctorReport): void {
  console.log(`config: ${report.configPath}`);
  console.log(`config exists: ${report.configExists ? "yes" : "no"}`);
  console.log(`gateway built: ${report.gatewayBuilt ? "yes" : "no"}`);
  console.log(`account connected: ${report.accountConnected ? "yes" : "no"}`);
  console.log(`selected adapter: ${report.selectedAdapter}`);
  console.log(`detected adapters: ${report.detectedAdapters.join(", ") || "(none)"}`);
  console.log(`project dir: ${report.projectDir}`);
  console.log(`daemon running: ${report.daemon.running ? "yes" : "no"}`);
  console.log(`daemon pid: ${report.daemon.pid ?? "(none)"}`);
  console.log(`daemon log: ${report.daemon.logFile}`);
  console.log(`service supported: ${report.service.platformSupported ? "yes" : "no"}`);
  console.log(`service installed: ${report.service.installed ? "yes" : "no"}`);
  console.log(`service loaded: ${report.service.loaded ? "yes" : "no"}`);
  console.log(`service running: ${report.service.running ? "yes" : "no"}`);
  console.log(`service pid: ${report.service.pid ?? "(none)"}`);
  console.log(`service last exit: ${report.service.lastExitStatus ?? "(unknown)"}`);
}

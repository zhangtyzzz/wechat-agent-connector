import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { GatewayConfig } from "./types.js";
import { resolveConfigPath } from "./config.js";
import { resolveDaemonPaths } from "./daemon.js";

export interface ServiceStatus {
  platformSupported: boolean;
  label: string;
  plistPath: string;
  installed: boolean;
  loaded: boolean;
  running: boolean;
  pid: number | null;
  lastExitStatus: number | null;
}

function currentUid(): number {
  return typeof process.getuid === "function" ? process.getuid() : 0;
}

function defaultLabel(configPath: string): string {
  const hash = crypto.createHash("sha1").update(configPath).digest("hex").slice(0, 10);
  return `ai.wechat-agent.gateway.${hash}`;
}

export function resolveServicePaths(configPath: string, config: GatewayConfig): { label: string; plistPath: string } {
  const resolvedConfigPath = resolveConfigPath(configPath);
  const label = config.service?.label?.trim() || defaultLabel(resolvedConfigPath);
  const plistPath =
    config.service?.plistPath?.trim() ||
    path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
  return { label, plistPath };
}

function launchctlDomain(): string {
  return `gui/${currentUid()}`;
}

function launchctlServiceTarget(label: string): string {
  return `${launchctlDomain()}/${label}`;
}

function runLaunchctl(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function bestEffortBootout(label: string, plistPath: string): void {
  runLaunchctl(["bootout", launchctlServiceTarget(label)]);
  runLaunchctl(["bootout", launchctlDomain(), plistPath]);
}

function launchctlLoaded(label: string): boolean {
  return runLaunchctl(["print", launchctlServiceTarget(label)]).status === 0;
}

export function buildServicePlist(params: {
  label: string;
  cliPath: string;
  configPath: string;
  cwd: string;
  logFile: string;
  pathEnv?: string;
}): string {
  const escaped = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const environmentBlock = params.pathEnv
    ? `  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${escaped(params.pathEnv)}</string>
  </dict>
`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escaped(params.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escaped(process.execPath)}</string>
    <string>${escaped(params.cliPath)}</string>
    <string>serve</string>
    <string>--config</string>
    <string>${escaped(params.configPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escaped(params.cwd)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escaped(params.logFile)}</string>
  <key>StandardErrorPath</key>
  <string>${escaped(params.logFile)}</string>
${environmentBlock}</dict>
</plist>
`;
}

export function installService(configPath: string, config: GatewayConfig): ServiceStatus {
  if (process.platform !== "darwin") {
    throw new Error("launchd service install is only supported on macOS");
  }
  const resolvedConfigPath = resolveConfigPath(configPath);
  const { label, plistPath } = resolveServicePaths(resolvedConfigPath, config);
  const { logFile } = resolveDaemonPaths(config);
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  const cwd = config.projectDir || path.dirname(resolvedConfigPath);
  fs.writeFileSync(
    plistPath,
    buildServicePlist({
      label,
      cliPath,
      configPath: resolvedConfigPath,
      cwd,
      logFile,
      pathEnv: process.env.PATH,
    }),
    "utf8",
  );

  const target = launchctlServiceTarget(label);
  bestEffortBootout(label, plistPath);
  const bootstrap = runLaunchctl(["bootstrap", launchctlDomain(), plistPath]);
  if (bootstrap.status !== 0 && !launchctlLoaded(label)) {
    throw new Error(`launchctl bootstrap failed: ${bootstrap.stderr || bootstrap.stdout}`.trim());
  }
  const kickstart = runLaunchctl(["kickstart", "-k", target]);
  if (kickstart.status !== 0) {
    throw new Error(`launchctl kickstart failed: ${kickstart.stderr || kickstart.stdout}`.trim());
  }
  return getServiceStatus(resolvedConfigPath, config);
}

export function uninstallService(configPath: string, config: GatewayConfig): ServiceStatus {
  const resolvedConfigPath = resolveConfigPath(configPath);
  const { label, plistPath } = resolveServicePaths(resolvedConfigPath, config);
  if (process.platform === "darwin") {
    bestEffortBootout(label, plistPath);
  }
  try {
    fs.unlinkSync(plistPath);
  } catch {
    // ignore
  }
  return getServiceStatus(resolvedConfigPath, config);
}

export function serviceAction(action: "install" | "uninstall" | "start" | "stop", configPath: string, config: GatewayConfig): ServiceStatus {
  switch (action) {
    case "install":
      return installService(configPath, config);
    case "uninstall":
      return uninstallService(configPath, config);
    case "start":
      return startService(configPath, config);
    case "stop":
      return stopService(configPath, config);
  }
}

export function startService(configPath: string, config: GatewayConfig): ServiceStatus {
  if (process.platform !== "darwin") {
    throw new Error("launchd service start is only supported on macOS");
  }
  const resolvedConfigPath = resolveConfigPath(configPath);
  const { label, plistPath } = resolveServicePaths(resolvedConfigPath, config);
  if (!fs.existsSync(plistPath)) {
    return installService(resolvedConfigPath, config);
  }
  const target = launchctlServiceTarget(label);
  if (!launchctlLoaded(label)) {
    const bootstrap = runLaunchctl(["bootstrap", launchctlDomain(), plistPath]);
    if (bootstrap.status !== 0 && !launchctlLoaded(label)) {
      throw new Error(`launchctl bootstrap failed: ${bootstrap.stderr || bootstrap.stdout}`.trim());
    }
  }
  const kickstart = runLaunchctl(["kickstart", "-k", target]);
  if (kickstart.status !== 0) {
    throw new Error(`launchctl kickstart failed: ${kickstart.stderr || kickstart.stdout}`.trim());
  }
  return getServiceStatus(resolvedConfigPath, config);
}

export function stopService(configPath: string, config: GatewayConfig): ServiceStatus {
  if (process.platform !== "darwin") {
    throw new Error("launchd service stop is only supported on macOS");
  }
  const resolvedConfigPath = resolveConfigPath(configPath);
  const { label, plistPath } = resolveServicePaths(resolvedConfigPath, config);
  bestEffortBootout(label, plistPath);
  return getServiceStatus(resolvedConfigPath, config);
}

export function getServiceStatus(configPath: string, config: GatewayConfig): ServiceStatus {
  const resolvedConfigPath = resolveConfigPath(configPath);
  const { label, plistPath } = resolveServicePaths(resolvedConfigPath, config);
  if (process.platform !== "darwin") {
    return {
      platformSupported: false,
      label,
      plistPath,
      installed: fs.existsSync(plistPath),
      loaded: false,
      running: false,
      pid: null,
      lastExitStatus: null,
    };
  }

  const installed = fs.existsSync(plistPath);
  if (!installed) {
    return {
      platformSupported: true,
      label,
      plistPath,
      installed: false,
      loaded: false,
      running: false,
      pid: null,
      lastExitStatus: null,
    };
  }

  const result = runLaunchctl(["print", launchctlServiceTarget(label)]);
  if (result.status !== 0) {
    return {
      platformSupported: true,
      label,
      plistPath,
      installed: true,
      loaded: false,
      running: false,
      pid: null,
      lastExitStatus: null,
    };
  }

  const pidMatch = result.stdout.match(/\bpid = (\d+)/);
  const exitMatch = result.stdout.match(/\blast exit code = (\d+)/);
  const pid = pidMatch ? Number(pidMatch[1]) : null;
  return {
    platformSupported: true,
    label,
    plistPath,
    installed: true,
    loaded: true,
    running: pid !== null,
    pid,
    lastExitStatus: exitMatch ? Number(exitMatch[1]) : null,
  };
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { GatewayConfig } from "./types.js";

function expandHomePath(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveConfigPath(input?: string): string {
  if (input?.trim()) return path.resolve(expandHomePath(input));
  return path.resolve(process.cwd(), "wechat-agent.config.json");
}

export function loadGatewayConfig(configPath?: string): GatewayConfig {
  const resolved = resolveConfigPath(configPath);
  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = JSON.parse(raw) as GatewayConfig;
  return normalizeGatewayConfig(parsed, resolved);
}

export function saveGatewayConfig(configPath: string, config: GatewayConfig): void {
  const resolved = resolveConfigPath(configPath);
  fs.writeFileSync(resolved, JSON.stringify(config, null, 2), "utf8");
}

export function normalizeGatewayConfig(config: GatewayConfig, configPath: string): GatewayConfig {
  return {
    ...config,
    stateDir: expandHomePath(config.stateDir),
    projectDir: resolveProjectDir(configPath, config.projectDir),
    adapter: {
      ...config.adapter,
      cwd: config.adapter.cwd ? resolveProjectDir(configPath, config.adapter.cwd) : resolveProjectDir(configPath, config.projectDir),
    },
  };
}

export function resolveProjectDir(configPath: string, projectDir?: string): string {
  const configDir = path.dirname(resolveConfigPath(configPath));
  if (!projectDir?.trim()) return configDir;
  const expanded = expandHomePath(projectDir);
  return path.isAbsolute(expanded) ? expanded : path.resolve(configDir, expanded);
}

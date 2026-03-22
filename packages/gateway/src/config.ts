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
  parsed.stateDir = expandHomePath(parsed.stateDir);
  return parsed;
}


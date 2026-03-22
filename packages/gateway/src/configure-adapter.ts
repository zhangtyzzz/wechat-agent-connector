import { chooseAdapterCandidate, detectAvailableAdapters } from "./adapters.js";
import { saveGatewayConfig } from "./config.js";
import { DEFAULT_ADAPTER_TIMEOUT_MS, type GatewayConfig } from "./types.js";

export async function ensureAdapterConfigured(
  configPath: string,
  config: GatewayConfig,
  out: Pick<Console, "log"> = console,
): Promise<GatewayConfig> {
  if (config.adapter.type !== "auto") {
    return config;
  }

  const candidates = detectAvailableAdapters();
  const selected = await chooseAdapterCandidate(candidates);
  const next: GatewayConfig = {
    ...config,
    adapter: {
      type: selected.type,
      command: selected.command,
      args: [],
      mode: "stdin-json",
      timeoutMs: DEFAULT_ADAPTER_TIMEOUT_MS,
      cwd: config.projectDir,
    },
  };
  saveGatewayConfig(configPath, next);
  out.log(`configured adapter: ${selected.displayName} (${selected.command})`);
  return next;
}

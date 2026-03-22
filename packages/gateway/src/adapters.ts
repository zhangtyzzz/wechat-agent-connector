import { spawnSync } from "node:child_process";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { invokeClaudeCodeAdapter } from "./adapter-claude-code.js";
import { invokeCliJsonAdapter } from "./adapter-cli-json.js";
import { invokeCodexAdapter } from "./adapter-codex.js";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "./types.js";
import type {
  AdapterCandidate,
  AdapterDefinition,
  AdapterRequest,
  AgentReply,
  CliJsonAdapterConfig,
  ResolvedCliJsonAdapterConfig,
} from "./types.js";

function findCommand(command: string): string | null {
  if (!command.trim()) return null;
  if (path.isAbsolute(command)) {
    return command;
  }
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const resolved = result.stdout.trim();
  return resolved || null;
}

function resolveExecutable(command?: string): string | null {
  if (!command?.trim()) return null;
  return findCommand(command.trim()) ?? command.trim();
}

function createCliJsonAdapter(params: {
  type: AdapterDefinition["type"];
  displayName: string;
  commands: string[];
}): AdapterDefinition {
  return {
    type: params.type,
    displayName: params.displayName,
    capabilities: {
      streaming: false,
      mediaInput: false,
      mediaOutput: false,
    },
    detect(): AdapterCandidate | null {
      for (const command of params.commands) {
        const resolved = findCommand(command);
        if (resolved) {
          return {
            type: params.type,
            displayName: params.displayName,
            command: resolved,
            reason: `detected ${command} on PATH`,
          };
        }
      }
      return null;
    },
    resolveConfig(config: CliJsonAdapterConfig): ResolvedCliJsonAdapterConfig {
      const detected = this.detect();
      const command = resolveExecutable(config.command) || detected?.command;
      if (!command) {
        throw new Error(`No command configured for adapter ${params.type}`);
      }
      const resolvedCommand = command;
      const resolvedCwd = config.cwd ?? process.cwd();
      return {
        type: params.type,
        command: resolvedCommand,
        args: config.args ?? [],
        mode: "stdin-json",
        timeoutMs: config.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS,
        cwd: resolvedCwd,
        env: config.env ?? {},
      };
    },
    invoke(config: ResolvedCliJsonAdapterConfig, request: AdapterRequest): Promise<AgentReply> {
      return invokeCliJsonAdapter(config, request);
    },
  };
}

function createNativeCliAdapter(params: {
  type: AdapterDefinition["type"];
  displayName: string;
  commands: string[];
  invoke: AdapterDefinition["invoke"];
}): AdapterDefinition {
  return {
    type: params.type,
    displayName: params.displayName,
    capabilities: {
      streaming: false,
      mediaInput: false,
      mediaOutput: false,
    },
    detect(): AdapterCandidate | null {
      for (const command of params.commands) {
        const resolved = findCommand(command);
        if (resolved) {
          return {
            type: params.type,
            displayName: params.displayName,
            command: resolved,
            reason: `detected ${command} on PATH`,
          };
        }
      }
      return null;
    },
    resolveConfig(config: CliJsonAdapterConfig): ResolvedCliJsonAdapterConfig {
      const detected = this.detect();
      const command = resolveExecutable(config.command) || detected?.command;
      if (!command) {
        throw new Error(`No command configured for adapter ${params.type}`);
      }
      const resolvedCommand = command;
      const resolvedCwd = config.cwd ?? process.cwd();
      return {
        type: params.type,
        command: resolvedCommand,
        args: config.args ?? [],
        mode: "stdin-json",
        timeoutMs: config.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS,
        cwd: resolvedCwd,
        env: config.env ?? {},
      };
    },
    invoke: params.invoke,
  };
}

const ADAPTERS: Record<Exclude<CliJsonAdapterConfig["type"], "auto">, AdapterDefinition> = {
  "shell-json": createCliJsonAdapter({
    type: "shell-json",
    displayName: "Custom JSON CLI",
    commands: [],
  }),
  codex: createNativeCliAdapter({
    type: "codex",
    displayName: "Codex CLI",
    commands: ["codex"],
    invoke: invokeCodexAdapter,
  }),
  "claude-code": createNativeCliAdapter({
    type: "claude-code",
    displayName: "Claude Code CLI",
    commands: ["claude", "claude-code"],
    invoke: invokeClaudeCodeAdapter,
  }),
  opencode: createCliJsonAdapter({
    type: "opencode",
    displayName: "OpenCode CLI",
    commands: ["opencode", "open-code"],
  }),
};

export function listAdapterDefinitions(): AdapterDefinition[] {
  return Object.values(ADAPTERS);
}

export function getAdapterDefinition(type: Exclude<CliJsonAdapterConfig["type"], "auto">): AdapterDefinition {
  return ADAPTERS[type];
}

export function detectAvailableAdapters(): AdapterCandidate[] {
  return listAdapterDefinitions()
    .map((adapter) => adapter.detect())
    .filter((candidate): candidate is AdapterCandidate => candidate !== null);
}

export async function chooseAdapterCandidate(candidates: AdapterCandidate[]): Promise<AdapterCandidate> {
  if (candidates.length === 0) {
    throw new Error("No supported agent CLI detected. Install codex, claude, opencode, or configure shell-json manually.");
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  output.write("Detected multiple agent CLIs. Choose one for the WeChat gateway:\n");
  candidates.forEach((candidate, index) => {
    output.write(`${index + 1}. ${candidate.displayName} (${candidate.command})\n`);
  });

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const answer = await rl.question(`Enter a number [1-${candidates.length}]: `);
      const index = Number(answer);
      if (Number.isInteger(index) && index >= 1 && index <= candidates.length) {
        return candidates[index - 1];
      }
      output.write("Invalid selection.\n");
    }
  } finally {
    rl.close();
  }
}

export function resolveAdapterConfig(config: CliJsonAdapterConfig): ResolvedCliJsonAdapterConfig {
  if (config.type === "auto") {
    throw new Error("Adapter type is still auto. Run adapter configuration first.");
  }
  return getAdapterDefinition(config.type).resolveConfig(config);
}

export async function invokeAdapter(
  config: CliJsonAdapterConfig,
  request: AdapterRequest,
): Promise<AgentReply> {
  const resolved = resolveAdapterConfig(config);
  return getAdapterDefinition(resolved.type).invoke(resolved, request);
}

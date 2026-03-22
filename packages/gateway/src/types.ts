import type { WeixinInboundEvent } from "@wechat-agent/weixin-core";

export type AdapterType = "auto" | "shell-json" | "codex" | "claude-code" | "opencode";
export const DEFAULT_ADAPTER_TIMEOUT_MS = 600_000;

export interface CliJsonAdapterConfig {
  type: AdapterType;
  command?: string;
  args?: string[];
  mode?: "stdin-json";
  timeoutMs?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export type ResolvedCliJsonAdapterConfig = Omit<Required<CliJsonAdapterConfig>, "type"> & {
  type: Exclude<AdapterType, "auto">;
};

export interface GatewayConfig {
  stateDir: string;
  projectDir?: string;
  weixin: {
    baseUrl: string;
    cdnBaseUrl?: string;
  };
  adapter: CliJsonAdapterConfig;
  daemon?: {
    logFile?: string;
    pidFile?: string;
  };
  service?: {
    label?: string;
    plistPath?: string;
  };
}

export interface AgentReply {
  text?: string;
  sessionId?: string;
}

export interface SessionRecord {
  accountId: string;
  userId: string;
  adapterType?: Exclude<AdapterType, "auto">;
  adapterSessionId?: string;
  contextToken?: string;
  lastMessageId?: string;
  updatedAt: string;
}

export interface AdapterRequest extends WeixinInboundEvent {
  session: SessionRecord;
}

export interface AdapterCapabilities {
  streaming: boolean;
  mediaInput: boolean;
  mediaOutput: boolean;
}

export interface AdapterCandidate {
  type: Exclude<AdapterType, "auto">;
  displayName: string;
  command: string;
  reason: string;
}

export interface AdapterDefinition {
  type: Exclude<AdapterType, "auto">;
  displayName: string;
  capabilities: AdapterCapabilities;
  detect(): AdapterCandidate | null;
  resolveConfig(config: CliJsonAdapterConfig): ResolvedCliJsonAdapterConfig;
  invoke(config: ResolvedCliJsonAdapterConfig, request: AdapterRequest): Promise<AgentReply>;
}

import type { WeixinInboundEvent } from "@wechat-agent/weixin-core";

export interface ShellAdapterConfig {
  type: "shell";
  command: string;
  args?: string[];
  mode?: "stdin-json";
  timeoutMs?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface GatewayConfig {
  stateDir: string;
  weixin: {
    baseUrl: string;
    cdnBaseUrl?: string;
  };
  adapter: ShellAdapterConfig;
  daemon?: {
    logFile?: string;
    pidFile?: string;
  };
}

export interface AgentReply {
  text?: string;
}

export interface SessionRecord {
  accountId: string;
  userId: string;
  contextToken?: string;
  lastMessageId?: string;
  updatedAt: string;
}

export interface AdapterRequest extends WeixinInboundEvent {
  session: SessionRecord;
}

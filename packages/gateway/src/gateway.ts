import {
  WeixinApiClient,
  ensureWeixinStateDirs,
  loadStoredAccount,
  resolveWeixinStatePaths,
  runLongPollLoop,
  saveStoredAccount,
  type WeixinAccountRecord,
} from "@wechat-agent/weixin-core";
import { generateClientId } from "@wechat-agent/weixin-core";

import { invokeAdapter, resolveAdapterConfig } from "./adapters.js";
import { SessionStore } from "./session-store.js";
import type { GatewayConfig } from "./types.js";

export async function serveGateway(
  config: GatewayConfig,
  output: Pick<Console, "log" | "error"> = console,
  signal?: AbortSignal,
): Promise<void> {
  const statePaths = resolveWeixinStatePaths(config.stateDir);
  ensureWeixinStateDirs(statePaths);
  const account = loadStoredAccount(statePaths);
  if (!account?.token) {
    throw new Error("No logged-in WeChat account found. Run the login command first.");
  }

  const client = new WeixinApiClient({
    baseUrl: account.baseUrl || config.weixin.baseUrl,
    cdnBaseUrl: config.weixin.cdnBaseUrl,
    token: account.token,
  });
  const sessions = new SessionStore(config.stateDir);

  output.log(`gateway started for account ${account.accountId}`);

  await runLongPollLoop({
    accountId: account.accountId,
    statePaths,
    client,
    signal,
    onEvent: async (event) => {
      output.log(`inbound ${event.userId}: ${event.text}`);
      const session = sessions.load(event.accountId, event.userId);
      session.contextToken = event.contextToken ?? session.contextToken;
      session.lastMessageId = event.messageId;
      if (config.adapter.type !== "auto") {
        session.adapterType = resolveAdapterConfig(config.adapter).type;
      }
      session.updatedAt = new Date().toISOString();
      sessions.save(session);

      const reply = await invokeAdapter(config.adapter, {
        ...event,
        session,
      });
      if (reply.sessionId) {
        session.adapterSessionId = reply.sessionId;
        session.updatedAt = new Date().toISOString();
        sessions.save(session);
      }
      if (!reply.text?.trim()) {
        return;
      }
      const contextToken = event.contextToken ?? session.contextToken;
      if (!contextToken) {
        output.error(`skip reply to ${event.userId}: missing context token`);
        return;
      }
      await client.sendTextMessage({
        toUserId: event.userId,
        text: reply.text,
        contextToken,
        clientId: generateClientId("wechat-agent"),
      });
      output.log(`outbound ${event.userId}: ${reply.text}`);
    },
  });
}

export function describeAccount(
  config: GatewayConfig,
): { account: WeixinAccountRecord | null; stateDir: string } {
  const statePaths = resolveWeixinStatePaths(config.stateDir);
  ensureWeixinStateDirs(statePaths);
  return {
    account: loadStoredAccount(statePaths),
    stateDir: statePaths.rootDir,
  };
}

export function persistAccount(config: GatewayConfig, account: WeixinAccountRecord): void {
  const statePaths = resolveWeixinStatePaths(config.stateDir);
  ensureWeixinStateDirs(statePaths);
  saveStoredAccount(statePaths, account);
}

export function hasStoredAccount(config: GatewayConfig): boolean {
  const statePaths = resolveWeixinStatePaths(config.stateDir);
  ensureWeixinStateDirs(statePaths);
  return Boolean(loadStoredAccount(statePaths)?.token);
}

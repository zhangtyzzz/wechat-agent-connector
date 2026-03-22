import type { WeixinInboundEvent } from "./types.js";
import { toInboundEvent } from "./messages.js";
import { readSessionCursor, writeSessionCursor, type WeixinStatePaths } from "./state.js";
import { WeixinApiClient } from "./api.js";

export interface PollerOptions {
  accountId: string;
  statePaths: WeixinStatePaths;
  client: WeixinApiClient;
  onEvent: (event: WeixinInboundEvent) => Promise<void> | void;
  signal?: AbortSignal;
}

export async function runLongPollLoop(options: PollerOptions): Promise<void> {
  let cursor = readSessionCursor(options.statePaths, options.accountId);
  let timeoutMs = 35000;

  while (!options.signal?.aborted) {
    const response = await options.client.getUpdates(cursor, timeoutMs);
    if (response.get_updates_buf && response.get_updates_buf !== cursor) {
      cursor = response.get_updates_buf;
      writeSessionCursor(options.statePaths, options.accountId, cursor);
    }
    if (response.longpolling_timeout_ms && response.longpolling_timeout_ms > 0) {
      timeoutMs = response.longpolling_timeout_ms;
    }
    if (response.ret && response.ret !== 0) {
      throw new Error(`getUpdates failed: ret=${response.ret} errcode=${response.errcode ?? ""}`);
    }
    for (const message of response.msgs ?? []) {
      const event = toInboundEvent(options.accountId, message);
      if (event) {
        await options.onEvent(event);
      }
    }
  }
}


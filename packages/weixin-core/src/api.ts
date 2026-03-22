import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BaseInfo,
  GetConfigResp,
  GetUpdatesResp,
  SendMessageReq,
  SendTypingReq,
  WeixinCoreConfig,
} from "./types.js";
import { ensureTrailingSlash, randomWechatUin } from "./utils.js";

function readPackageVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.resolve(dir, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const DEFAULT_CHANNEL_VERSION = readPackageVersion();

export interface WeixinApiClientOptions extends WeixinCoreConfig {
  token?: string;
}

export class WeixinApiClient {
  readonly baseUrl: string;
  readonly cdnBaseUrl?: string;
  readonly token?: string;
  readonly channelVersion: string;

  constructor(options: WeixinApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.cdnBaseUrl = options.cdnBaseUrl;
    this.token = options.token;
    this.channelVersion = options.channelVersion ?? DEFAULT_CHANNEL_VERSION;
  }

  buildBaseInfo(): BaseInfo {
    return {
      channel_version: this.channelVersion,
    };
  }

  private buildHeaders(body: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      AuthorizationType: "ilink_bot_token",
      "Content-Length": String(Buffer.byteLength(body, "utf8")),
      "X-WECHAT-UIN": randomWechatUin(),
    };
    if (this.token?.trim()) {
      headers.Authorization = `Bearer ${this.token.trim()}`;
    }
    return headers;
  }

  private async postJson<T>(endpoint: string, payload: object, timeoutMs: number): Promise<T> {
    const body = JSON.stringify(payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(endpoint, ensureTrailingSlash(this.baseUrl));
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(body),
        body,
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${endpoint} ${response.status}: ${raw}`);
      }
      return JSON.parse(raw) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getUpdates(getUpdatesBuf: string, timeoutMs = 35000): Promise<GetUpdatesResp> {
    try {
      return await this.postJson<GetUpdatesResp>(
        "ilink/bot/getupdates",
        {
          get_updates_buf: getUpdatesBuf,
          base_info: this.buildBaseInfo(),
        },
        timeoutMs,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ret: 0, msgs: [], get_updates_buf: getUpdatesBuf };
      }
      throw error;
    }
  }

  async sendTextMessage(params: {
    toUserId: string;
    text: string;
    contextToken?: string;
    clientId: string;
  }): Promise<void> {
    const body: SendMessageReq = {
      msg: {
        from_user_id: "",
        to_user_id: params.toUserId,
        client_id: params.clientId,
        message_type: 2,
        message_state: 2,
        context_token: params.contextToken,
        item_list: [
          {
            type: 1,
            text_item: {
              text: params.text,
            },
          },
        ],
      },
    };
    await this.postJson("ilink/bot/sendmessage", { ...body, base_info: this.buildBaseInfo() }, 15000);
  }

  async getConfig(ilinkUserId: string, contextToken?: string): Promise<GetConfigResp> {
    return this.postJson<GetConfigResp>(
      "ilink/bot/getconfig",
      {
        ilink_user_id: ilinkUserId,
        context_token: contextToken,
        base_info: this.buildBaseInfo(),
      },
      10000,
    );
  }

  async sendTyping(body: SendTypingReq): Promise<void> {
    await this.postJson("ilink/bot/sendtyping", { ...body, base_info: this.buildBaseInfo() }, 10000);
  }
}


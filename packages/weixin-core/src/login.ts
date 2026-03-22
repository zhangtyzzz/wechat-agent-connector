import { randomUUID } from "node:crypto";

import qrcodeTerminal from "qrcode-terminal";

import type { WeixinAccountRecord, WeixinCoreConfig } from "./types.js";
import { ensureTrailingSlash, sleep } from "./utils.js";

const DEFAULT_BOT_TYPE = "3";
const QR_STATUS_TIMEOUT_MS = 35000;
const LOGIN_TIMEOUT_MS = 480000;

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface StatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
  baseurl?: string;
}

async function fetchQRCode(baseUrl: string, botType: string): Promise<QRCodeResponse> {
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`,
    ensureTrailingSlash(baseUrl),
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch QR code: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<QRCodeResponse>;
}

async function fetchQRStatus(baseUrl: string, qrcode: string): Promise<StatusResponse> {
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
    ensureTrailingSlash(baseUrl),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "iLink-App-ClientVersion": "1",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to poll QR status: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<StatusResponse>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "wait" };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function loginWithQr(
  config: WeixinCoreConfig,
  output: Pick<Console, "log" | "error"> = console,
): Promise<WeixinAccountRecord> {
  const qr = await fetchQRCode(config.baseUrl, DEFAULT_BOT_TYPE);
  output.log("Scan this QR code with WeChat:");
  await new Promise<void>((resolve) => {
    qrcodeTerminal.generate(qr.qrcode_img_content, { small: true }, () => resolve());
  });
  output.log(`QR URL: ${qr.qrcode_img_content}`);

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await fetchQRStatus(config.baseUrl, qr.qrcode);
    if (status.status === "scaned") {
      output.log("QR scanned. Confirm login in WeChat.");
    }
    if (status.status === "confirmed" && status.bot_token && status.ilink_bot_id) {
      const now = new Date().toISOString();
      return {
        accountId: status.ilink_bot_id.replaceAll("@", "-").replaceAll(".", "-"),
        token: status.bot_token,
        baseUrl: status.baseurl || config.baseUrl,
        userId: status.ilink_user_id,
        createdAt: now,
        updatedAt: now,
      };
    }
    if (status.status === "expired") {
      throw new Error("QR code expired before confirmation");
    }
    await sleep(1000);
  }

  throw new Error("Timed out while waiting for QR login");
}

export function createAnonymousAccountRecord(baseUrl: string): WeixinAccountRecord {
  const now = new Date().toISOString();
  return {
    accountId: randomUUID(),
    token: "",
    baseUrl,
    createdAt: now,
    updatedAt: now,
  };
}


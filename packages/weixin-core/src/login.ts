import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

import type { WeixinAccountRecord, WeixinCoreConfig } from "./types.js";
import { ensureTrailingSlash, sleep } from "./utils.js";

const DEFAULT_BOT_TYPE = "3";
const QR_STATUS_TIMEOUT_MS = 35000;
const LOGIN_TIMEOUT_MS = 480000;
const QR_HELPER_TTL_MS = 10 * 60_000;

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
  const helperPath = await writeQrLandingPage(qr.qrcode_img_content, output);
  if (helperPath) {
    openQrHelperPage(helperPath, output);
  }

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await fetchQRStatus(config.baseUrl, qr.qrcode);
    if (status.status === "scaned") {
      output.log("QR scanned. Confirm login in WeChat.");
    }
    if (status.status === "confirmed" && status.bot_token && status.ilink_bot_id) {
      cleanupQrHelperPage(helperPath);
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
      cleanupQrHelperPage(helperPath);
      throw new Error("QR code expired before confirmation");
    }
    await sleep(1000);
  }

  cleanupQrHelperPage(helperPath);
  throw new Error("Timed out while waiting for QR login");
}

async function writeQrLandingPage(
  qrUrl: string,
  output: Pick<Console, "log" | "error">,
): Promise<string | null> {
  try {
    const dir = path.join(os.tmpdir(), "wechat-agent");
    fs.mkdirSync(dir, { recursive: true });
    const htmlPath = path.join(dir, `login-qr-${randomUUID()}.html`);
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 420,
    });
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>WeChat Login QR</title></head>
<body style="font-family: sans-serif; padding: 24px; background: #f6f7f9;">
<h1>WeChat Login QR</h1>
<p>Scan the QR below with WeChat. If it fails, copy the URL below and generate the QR elsewhere.</p>
<p><a href="${qrUrl}">${qrUrl}</a></p>
<img src="${qrDataUrl}" alt="WeChat login QR" style="max-width: 420px; width: 100%; border: 1px solid #ddd; background: white; padding: 12px;" />
    </body></html>`;
    fs.writeFileSync(htmlPath, html, "utf8");
    output.log(`QR helper page: file://${htmlPath}`);
    scheduleQrHelperCleanup(htmlPath);
    return htmlPath;
  } catch (error) {
    output.error(`failed to write QR helper page: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function openQrHelperPage(htmlPath: string, output: Pick<Console, "log" | "error">): void {
  if (process.platform !== "darwin") return;
  try {
    const child = spawn("open", [htmlPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    output.log("Opened local QR helper page in the default browser.");
  } catch (error) {
    output.error(`failed to open QR helper page automatically: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function scheduleQrHelperCleanup(htmlPath: string): void {
  const remove = () => cleanupQrHelperPage(htmlPath);
  setTimeout(remove, QR_HELPER_TTL_MS).unref();
  process.once("exit", remove);
  process.once("SIGINT", () => {
    remove();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    remove();
    process.exit(143);
  });
}

function cleanupQrHelperPage(htmlPath: string | null): void {
  if (!htmlPath) return;
  try {
    fs.unlinkSync(htmlPath);
  } catch {
    // ignore
  }
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

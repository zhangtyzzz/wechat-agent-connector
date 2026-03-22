import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { WeixinAccountRecord } from "./types.js";

export interface WeixinStatePaths {
  rootDir: string;
  accountsDir: string;
  sessionsDir: string;
}

export function expandHomePath(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveWeixinStatePaths(rootDir: string): WeixinStatePaths {
  const resolvedRoot = expandHomePath(rootDir);
  return {
    rootDir: resolvedRoot,
    accountsDir: path.join(resolvedRoot, "accounts"),
    sessionsDir: path.join(resolvedRoot, "sessions"),
  };
}

export function ensureWeixinStateDirs(paths: WeixinStatePaths): void {
  fs.mkdirSync(paths.accountsDir, { recursive: true });
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
}

function accountFilePath(paths: WeixinStatePaths, accountId: string): string {
  return path.join(paths.accountsDir, `${accountId}.json`);
}

export function listStoredAccounts(paths: WeixinStatePaths): WeixinAccountRecord[] {
  if (!fs.existsSync(paths.accountsDir)) return [];
  return fs
    .readdirSync(paths.accountsDir)
    .filter((entry) => entry.endsWith(".json"))
    .flatMap((entry) => {
      const filePath = path.join(paths.accountsDir, entry);
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        return [JSON.parse(raw) as WeixinAccountRecord];
      } catch {
        return [];
      }
    });
}

export function loadStoredAccount(
  paths: WeixinStatePaths,
  accountId?: string,
): WeixinAccountRecord | null {
  const accounts = listStoredAccounts(paths);
  if (accounts.length === 0) return null;
  if (!accountId) return accounts[0] ?? null;
  return accounts.find((record) => record.accountId === accountId) ?? null;
}

export function saveStoredAccount(paths: WeixinStatePaths, record: WeixinAccountRecord): void {
  ensureWeixinStateDirs(paths);
  fs.writeFileSync(accountFilePath(paths, record.accountId), JSON.stringify(record, null, 2), "utf8");
}

export function readSessionCursor(paths: WeixinStatePaths, accountId: string): string {
  const filePath = path.join(paths.sessionsDir, `${accountId}.cursor`);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function writeSessionCursor(paths: WeixinStatePaths, accountId: string, cursor: string): void {
  ensureWeixinStateDirs(paths);
  fs.writeFileSync(path.join(paths.sessionsDir, `${accountId}.cursor`), cursor, "utf8");
}


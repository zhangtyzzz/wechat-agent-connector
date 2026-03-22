import fs from "node:fs";
import path from "node:path";

import type { SessionRecord } from "./types.js";

export class SessionStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.join(rootDir, "gateway-sessions");
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private filePath(accountId: string, userId: string): string {
    const safeUserId = userId.replaceAll("/", "_");
    return path.join(this.rootDir, `${accountId}__${safeUserId}.json`);
  }

  load(accountId: string, userId: string): SessionRecord {
    const filePath = this.filePath(accountId, userId);
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as SessionRecord;
    } catch {
      return {
        accountId,
        userId,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  save(record: SessionRecord): void {
    fs.writeFileSync(this.filePath(record.accountId, record.userId), JSON.stringify(record, null, 2), "utf8");
  }
}


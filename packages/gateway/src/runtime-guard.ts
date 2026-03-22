import fs from "node:fs";
import path from "node:path";

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class GatewayInstanceLock {
  private readonly lockPath: string;
  private locked = false;

  constructor(stateDir: string) {
    this.lockPath = path.join(stateDir, "gateway.lock");
  }

  acquire(): void {
    fs.mkdirSync(path.dirname(this.lockPath), { recursive: true });
    const pid = process.pid;
    try {
      fs.writeFileSync(this.lockPath, String(pid), { encoding: "utf8", flag: "wx" });
      this.locked = true;
      return;
    } catch (error) {
      const existingPid = this.readPid();
      if (existingPid && isPidRunning(existingPid)) {
        throw new Error(`Another gateway instance is already running pid=${existingPid}`);
      }
      try {
        fs.unlinkSync(this.lockPath);
      } catch {
        // ignore stale lock cleanup failure
      }
      fs.writeFileSync(this.lockPath, String(pid), { encoding: "utf8", flag: "wx" });
      this.locked = true;
    }
  }

  release(): void {
    if (!this.locked) return;
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // ignore
    }
    this.locked = false;
  }

  private readPid(): number | null {
    try {
      const raw = fs.readFileSync(this.lockPath, "utf8").trim();
      const pid = Number(raw);
      return Number.isFinite(pid) ? pid : null;
    } catch {
      return null;
    }
  }
}

export class MessageDeduper {
  private readonly rootDir: string;

  constructor(stateDir: string) {
    this.rootDir = path.join(stateDir, "processed-messages");
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  claim(accountId: string, messageId: string): boolean {
    const filePath = path.join(this.rootDir, `${accountId}__${messageId}.seen`);
    try {
      fs.writeFileSync(filePath, new Date().toISOString(), { encoding: "utf8", flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }
}

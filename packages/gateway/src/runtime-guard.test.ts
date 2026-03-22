import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GatewayInstanceLock, MessageDeduper } from "./runtime-guard.js";

test("message deduper only claims the same message once", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-deduper-"));
  const deduper = new MessageDeduper(dir);

  assert.equal(deduper.claim("acc", "msg-1"), true);
  assert.equal(deduper.claim("acc", "msg-1"), false);
});

test("gateway instance lock blocks a second live instance", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-lock-"));
  const first = new GatewayInstanceLock(dir);
  const second = new GatewayInstanceLock(dir);

  first.acquire();
  assert.throws(() => second.acquire(), /Another gateway instance is already running/);
  first.release();
  second.acquire();
  second.release();
});

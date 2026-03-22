import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { ensureWeixinStateDirs, resolveWeixinStatePaths, saveStoredAccount } from "@wechat-agent/weixin-core";

import { serveGateway } from "./gateway.js";
import { SessionStore } from "./session-store.js";
import type { GatewayConfig } from "./types.js";

test("gateway processes one inbound message and sends adapter reply", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-gateway-"));
  const statePaths = resolveWeixinStatePaths(tmpDir);
  ensureWeixinStateDirs(statePaths);
  saveStoredAccount(statePaths, {
    accountId: "wx-test-account",
    token: "token-123",
    baseUrl: "",
    userId: "tester",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  let pollCount = 0;
  let sendBody: any = null;
  const controller = new AbortController();

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => {
      if (req.url === "/ilink/bot/getupdates") {
        pollCount += 1;
        res.setHeader("Content-Type", "application/json");
        if (pollCount === 1) {
          res.end(
            JSON.stringify({
              ret: 0,
              msgs: [
                {
                  message_id: 42,
                  from_user_id: "alice@im.wechat",
                  create_time_ms: Date.now(),
                  context_token: "ctx-1",
                  item_list: [
                    {
                      type: 1,
                      text_item: { text: "hello gateway" },
                    },
                  ],
                },
              ],
              get_updates_buf: "cursor-1",
              longpolling_timeout_ms: 50,
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            ret: 0,
            msgs: [],
            get_updates_buf: "cursor-1",
            longpolling_timeout_ms: 50,
          }),
        );
        return;
      }

      if (req.url === "/ilink/bot/sendmessage") {
        sendBody = JSON.parse(body);
        res.setHeader("Content-Type", "application/json");
        res.end("{}");
        controller.abort();
        return;
      }

      res.statusCode = 404;
      res.end("not found");
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind test server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  saveStoredAccount(statePaths, {
    accountId: "wx-test-account",
    token: "token-123",
    baseUrl,
    userId: "tester",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const config: GatewayConfig = {
    stateDir: tmpDir,
    weixin: {
      baseUrl,
    },
    adapter: {
      type: "shell-json",
      command: "node",
      args: [
        "-e",
        "const fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify({text:`echo: ${input.text}`,sessionId:'session-from-adapter'}));",
      ],
      mode: "stdin-json",
      timeoutMs: 5000,
    },
  };

  await serveGateway(config, console, controller.signal).catch((error) => {
    if (!(error instanceof Error && error.message === "aborted")) {
      throw error;
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  assert.ok(sendBody, "sendmessage should be called");
  assert.equal(sendBody.msg.to_user_id, "alice@im.wechat");
  assert.equal(sendBody.msg.context_token, "ctx-1");
  assert.equal(sendBody.msg.item_list[0].text_item.text, "echo: hello gateway");

  const storedSession = new SessionStore(tmpDir).load("wx-test-account", "alice@im.wechat");
  assert.equal(storedSession.adapterSessionId, "session-from-adapter");
});

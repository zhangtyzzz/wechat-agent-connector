import test from "node:test";
import assert from "node:assert/strict";

import { invokeClaudeCodeAdapter } from "./adapter-claude-code.js";
import { invokeCodexAdapter } from "./adapter-codex.js";

test("codex adapter includes resume arguments when session exists", async () => {
  let seenArgs: string[] = [];
  const reply = await invokeCodexAdapter(
    {
      type: "codex",
      command: "codex",
      args: [],
      mode: "stdin-json",
      timeoutMs: 1000,
      cwd: "",
      env: {},
    },
    {
      accountId: "acc",
      userId: "user",
      messageId: "msg",
      text: "hello",
      contextToken: "ctx",
      timestamp: Date.now(),
      rawMessage: {},
      session: {
        accountId: "acc",
        userId: "user",
        adapterSessionId: "thread-old",
        updatedAt: new Date().toISOString(),
      },
    },
    async (params) => {
      seenArgs = params.args;
      return {
        stdout: '{"type":"thread.started","thread_id":"thread-abc"}\n',
        stderr: "",
        code: 0,
      };
    },
  );
  assert.deepEqual(seenArgs.slice(0, 3), ["exec", "resume", "thread-old"]);
  assert.equal(reply.sessionId, "thread-abc");
});

test("claude adapter includes resume argument when session exists", async () => {
  let seenArgs: string[] = [];
  const reply = await invokeClaudeCodeAdapter(
    {
      type: "claude-code",
      command: "claude",
      args: [],
      mode: "stdin-json",
      timeoutMs: 1000,
      cwd: "",
      env: {},
    },
    {
      accountId: "acc",
      userId: "user",
      messageId: "msg",
      text: "hello",
      contextToken: "ctx",
      timestamp: Date.now(),
      rawMessage: {},
      session: {
        accountId: "acc",
        userId: "user",
        adapterSessionId: "session-old",
        updatedAt: new Date().toISOString(),
      },
    },
    async (params) => {
      seenArgs = params.args;
      return {
        stdout: JSON.stringify({ result: "ok", session_id: "session-abc" }),
        stderr: "",
        code: 0,
      };
    },
  );
  assert.ok(seenArgs.includes("--resume"));
  assert.ok(seenArgs.includes("session-old"));
  assert.equal(reply.sessionId, "session-abc");
});


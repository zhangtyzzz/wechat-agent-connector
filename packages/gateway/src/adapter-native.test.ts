import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { invokeClaudeCodeAdapter } from "./adapter-claude-code.js";
import { invokeCodexAdapter } from "./adapter-codex.js";

function makeRequest() {
  return {
    accountId: "acc",
    userId: "u",
    messageId: "m",
    text: "ping",
    contextToken: "ctx",
    timestamp: Date.now(),
    rawMessage: {},
    session: {
      accountId: "acc",
      userId: "u",
      updatedAt: new Date().toISOString(),
    },
  };
}

test("codex adapter reads output-last-message file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-codex-mock-"));
  const script = path.join(dir, "mock-codex");
  fs.writeFileSync(
    script,
    `#!/bin/sh
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    out="$1"
  fi
  shift
done
printf 'codex reply' > "$out"
printf '%s\\n' '{"type":"thread.started","thread_id":"thread-123"}'
`,
    "utf8",
  );
  fs.chmodSync(script, 0o755);

  const reply = await invokeCodexAdapter(
    {
      type: "codex",
      command: script,
      args: [],
      mode: "stdin-json",
      timeoutMs: 5000,
      cwd: "",
      env: {},
    },
    makeRequest(),
  );

  assert.equal(reply.text, "codex reply");
  assert.equal(reply.sessionId, "thread-123");
});

test("claude adapter reads stdout text", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-claude-mock-"));
  const script = path.join(dir, "mock-claude");
  fs.writeFileSync(
    script,
    `#!/bin/sh
printf '%s' '{"result":"claude reply","session_id":"session-123"}'
`,
    "utf8",
  );
  fs.chmodSync(script, 0o755);

  const reply = await invokeClaudeCodeAdapter(
    {
      type: "claude-code",
      command: script,
      args: [],
      mode: "stdin-json",
      timeoutMs: 5000,
      cwd: "",
      env: {},
    },
    makeRequest(),
  );

  assert.equal(reply.text, "claude reply");
  assert.equal(reply.sessionId, "session-123");
});

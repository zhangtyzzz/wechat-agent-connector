import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { invokeCliJsonAdapter } from "./adapter-cli-json.js";

test("cli json adapter returns parsed JSON reply", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const reply = await invokeCliJsonAdapter(
    {
      type: "shell-json",
      command: "node",
      args: [path.join(repoRoot, "examples/echo-agent.mjs")],
      mode: "stdin-json",
      timeoutMs: 5000,
      cwd: "",
      env: {},
    },
    {
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
    },
  );

  assert.equal(reply.text, "echo: ping");
});

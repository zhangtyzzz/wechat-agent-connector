import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AdapterRequest, AgentReply, ResolvedCliJsonAdapterConfig } from "./types.js";
import { buildAgentPrompt } from "./adapter-prompt.js";
import { runSubprocess } from "./adapter-subprocess.js";

export async function invokeCodexAdapter(
  config: ResolvedCliJsonAdapterConfig,
  request: AdapterRequest,
  runner: typeof runSubprocess = runSubprocess,
): Promise<AgentReply> {
  const outputFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "wechat-agent-codex-")),
    "last-message.txt",
  );
  const prompt = buildAgentPrompt(request);
  const sessionId = request.session.adapterSessionId;
  const baseArgs = sessionId
    ? ["exec", "resume", sessionId]
    : ["exec"];
  const result = await runner({
    command: config.command,
    args: [
      ...baseArgs,
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "--json",
      "-o",
      outputFile,
      ...config.args,
      "-",
    ],
    stdinText: prompt,
    cwd: config.cwd,
    env: config.env,
    timeoutMs: config.timeoutMs,
  });

  if (result.code !== 0) {
    throw new Error(`codex adapter exited with code ${result.code}: ${result.stderr.trim()}`);
  }

  const text = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8").trim() : result.stdout.trim();
  const resumedSessionId = extractCodexThreadId(result.stdout) ?? sessionId;
  return { text, sessionId: resumedSessionId };
}

function extractCodexThreadId(stdout: string): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as { type?: string; thread_id?: string };
      if (parsed.type === "thread.started" && parsed.thread_id) {
        return parsed.thread_id;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

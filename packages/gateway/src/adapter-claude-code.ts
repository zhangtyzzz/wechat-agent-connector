import type { AdapterRequest, AgentReply, ResolvedCliJsonAdapterConfig } from "./types.js";
import { buildAgentPrompt } from "./adapter-prompt.js";
import { runSubprocess } from "./adapter-subprocess.js";

export async function invokeClaudeCodeAdapter(
  config: ResolvedCliJsonAdapterConfig,
  request: AdapterRequest,
  runner: typeof runSubprocess = runSubprocess,
): Promise<AgentReply> {
  const prompt = buildAgentPrompt(request);
  const sessionId = request.session.adapterSessionId;
  const result = await runner({
    command: config.command,
    args: [
      "-p",
      "--output-format",
      "json",
      "--permission-mode",
      "bypassPermissions",
      ...(sessionId ? ["--resume", sessionId] : []),
      ...config.args,
      prompt,
    ],
    cwd: config.cwd,
    env: config.env,
    timeoutMs: config.timeoutMs,
  });

  if (result.code !== 0) {
    throw new Error(`claude-code adapter exited with code ${result.code}: ${result.stderr.trim()}`);
  }

  const parsed = JSON.parse(result.stdout) as { result?: string; session_id?: string };
  return { text: parsed.result?.trim() ?? "", sessionId: parsed.session_id ?? sessionId };
}

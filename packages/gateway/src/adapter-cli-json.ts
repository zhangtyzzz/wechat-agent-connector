import type { AdapterRequest, AgentReply, ResolvedCliJsonAdapterConfig } from "./types.js";
import { runSubprocess } from "./adapter-subprocess.js";

export async function invokeCliJsonAdapter(
  config: ResolvedCliJsonAdapterConfig,
  request: AdapterRequest,
): Promise<AgentReply> {
  const result = await runSubprocess({
    command: config.command,
    args: config.args,
    stdinText: JSON.stringify(request),
    cwd: config.cwd,
    env: config.env,
    timeoutMs: config.timeoutMs,
  });
  if (result.code !== 0) {
    throw new Error(`adapter exited with code ${result.code}: ${result.stderr.trim()}`);
  }
  try {
    return JSON.parse(result.stdout) as AgentReply;
  } catch (error) {
    throw new Error(
      `adapter stdout is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

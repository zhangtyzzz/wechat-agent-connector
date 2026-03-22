import { spawn } from "node:child_process";

import type { AdapterRequest, AgentReply, ShellAdapterConfig } from "./types.js";

export async function runShellAdapter(
  config: ShellAdapterConfig,
  request: AdapterRequest,
): Promise<AgentReply> {
  const timeoutMs = config.timeoutMs ?? 120000;

  return new Promise<AgentReply>((resolve, reject) => {
    const child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: {
        ...process.env,
        ...config.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`adapter timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`adapter exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as AgentReply;
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `adapter stdout is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}


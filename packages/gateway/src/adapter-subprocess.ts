import { spawn } from "node:child_process";

export async function runSubprocess(params: {
  command: string;
  args: string[];
  stdinText?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const timeoutMs = params.timeoutMs ?? 120000;

  return new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd || undefined,
      env: {
        ...process.env,
        ...params.env,
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
      resolve({ stdout, stderr, code });
    });

    if (params.stdinText != null) {
      child.stdin.write(params.stdinText);
    }
    child.stdin.end();
  });
}


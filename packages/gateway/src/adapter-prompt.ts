import type { AdapterRequest } from "./types.js";

export function buildAgentPrompt(request: AdapterRequest): string {
  return request.text || "(empty message)";
}

import type { EnvMap } from "./types.ts";

export function resolveAgentPath(env: EnvMap = process.env): string {
  return env["CURSOR_AGENT_PATH"] ?? env["AGENT_PATH"] ?? "agent";
}

export function resolveApiKey(env: EnvMap = process.env): string | undefined {
  const key = env["CURSOR_API_KEY"];
  return key ? key : undefined;
}

/**
 * The CLI reads `CURSOR_API_KEY` from the environment, so the key never goes on the
 * command line where any local `ps` would show it.
 */
export function buildSpawnEnv(env: EnvMap = process.env, apiKey?: string): EnvMap {
  return apiKey ? { ...env, CURSOR_API_KEY: apiKey } : env;
}

export function buildAcpArgs(): string[] {
  return ["acp"];
}

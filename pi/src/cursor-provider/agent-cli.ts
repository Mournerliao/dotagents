import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgentModelsOutput, type CursorModelDef } from "./models.ts";

export type EnvMap = Record<string, string | undefined>;

export type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; env?: NodeJS.ProcessEnv },
) => ChildProcess;

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
) as { name: string; version: string };

export const PACKAGE_NAME = pkg.name;
export const PACKAGE_VERSION = pkg.version;

export const DISCOVERY_TIMEOUT_MS = 15_000;

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

function runCaptured(
  agentPath: string,
  args: string[],
  options: {
    env?: EnvMap;
    timeoutMs?: number;
    spawn?: SpawnFn;
    inheritStdio?: boolean;
  } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const doSpawn = options.spawn ?? (spawn as SpawnFn);
  const env = (options.env ?? process.env) as NodeJS.ProcessEnv;
  return new Promise((resolve, reject) => {
    const child = doSpawn(agentPath, args, {
      stdio: options.inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs != null) {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`agent ${args[0] ?? ""} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }

    child.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

export async function runAgentModels(
  env: EnvMap = process.env,
  doSpawn: SpawnFn = spawn as SpawnFn,
  timeoutMs: number = DISCOVERY_TIMEOUT_MS,
): Promise<CursorModelDef[]> {
  const agentPath = resolveAgentPath(env);
  const { code, stdout, stderr } = await runCaptured(agentPath, ["models"], {
    env: buildSpawnEnv(env, resolveApiKey(env)),
    timeoutMs,
    spawn: doSpawn,
  });
  if (code !== 0) {
    throw new Error(`agent models exited with code ${code}: ${stderr.trim()}`);
  }
  const models = parseAgentModelsOutput(stdout);
  if (models.length === 0) {
    throw new Error("agent models returned no models");
  }
  return models;
}

export async function runAgentLogin(
  env: EnvMap = process.env,
  doSpawn: SpawnFn = spawn as SpawnFn,
): Promise<void> {
  const agentPath = resolveAgentPath(env);
  const { code } = await runCaptured(agentPath, ["login"], {
    env: { ...env, NO_OPEN_BROWSER: "1" },
    spawn: doSpawn,
    inheritStdio: true,
  });
  if (code !== 0) {
    throw new Error(`agent login exited with code ${code}`);
  }
}

export async function runAgentStatus(
  env: EnvMap = process.env,
  doSpawn: SpawnFn = spawn as SpawnFn,
): Promise<string> {
  const agentPath = resolveAgentPath(env);
  const { stdout, stderr } = await runCaptured(agentPath, ["status"], {
    env,
    spawn: doSpawn,
  });
  return `${stdout}${stderr}`.trim();
}

export async function runAgentLogout(
  env: EnvMap = process.env,
  doSpawn: SpawnFn = spawn as SpawnFn,
): Promise<void> {
  const agentPath = resolveAgentPath(env);
  const { code } = await runCaptured(agentPath, ["logout"], {
    env,
    spawn: doSpawn,
    inheritStdio: true,
  });
  if (code !== 0) {
    throw new Error(`agent logout exited with code ${code}`);
  }
}

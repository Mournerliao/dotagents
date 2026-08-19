import { spawn } from "node:child_process";
import { parseAgentModelsOutput } from "./models.ts";
import { buildSpawnEnv, resolveAgentPath, resolveApiKey } from "./spawn.ts";
import type { CursorModelDef, EnvMap } from "./types.ts";

export const DISCOVERY_TIMEOUT_MS = 15_000;

export type SpawnFn = typeof spawn;

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
  const doSpawn = options.spawn ?? spawn;
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
  doSpawn: SpawnFn = spawn,
): Promise<CursorModelDef[]> {
  const agentPath = resolveAgentPath(env);
  const { code, stdout, stderr } = await runCaptured(agentPath, ["models"], {
    env: buildSpawnEnv(env, resolveApiKey(env)),
    timeoutMs: DISCOVERY_TIMEOUT_MS,
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
  doSpawn: SpawnFn = spawn,
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
  doSpawn: SpawnFn = spawn,
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
  doSpawn: SpawnFn = spawn,
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

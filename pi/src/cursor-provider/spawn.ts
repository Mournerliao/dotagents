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

/**
 * The prompt is the whole serialized context and travels as one argv entry, so a long
 * session can exceed the OS argument limit (~1 MB on macOS, shared with the environment).
 * Refusing early turns an opaque E2BIG spawn failure into something actionable.
 */
export const MAX_PROMPT_BYTES = 256 * 1024;

export function promptByteLength(prompt: string): number {
  return Buffer.byteLength(prompt, "utf8");
}

export function checkPromptSize(prompt: string, limit = MAX_PROMPT_BYTES): string | undefined {
  const bytes = promptByteLength(prompt);
  if (bytes <= limit) return undefined;
  return [
    `Context is ${Math.round(bytes / 1024)} KB, over the ${Math.round(limit / 1024)} KB this provider sends to the Cursor CLI.`,
    "The CLI takes the prompt as a command-line argument, so a larger context would fail with an unhelpful spawn error.",
    "Run /compact, or start a new session.",
  ].join(" ");
}

export type PrintArgsOptions = {
  modelId: string;
  workspacePath: string;
  prompt: string;
  force?: boolean;
};

export function buildPrintArgs(options: PrintArgsOptions): string[] {
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--model",
    options.modelId,
    "--trust",
    "--workspace",
    options.workspacePath,
  ];
  if (options.force) {
    args.push("--force");
  }
  args.push(options.prompt);
  return args;
}

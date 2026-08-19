import type { EnvMap } from "./types.ts";

export function resolveAgentPath(env: EnvMap = process.env): string {
  return env["CURSOR_AGENT_PATH"] ?? env["AGENT_PATH"] ?? "agent";
}

export function resolveApiKey(env: EnvMap = process.env): string | undefined {
  const key = env["CURSOR_API_KEY"];
  return key ? key : undefined;
}

export type PrintArgsOptions = {
  modelId: string;
  workspacePath: string;
  prompt: string;
  force?: boolean;
  apiKey?: string | undefined;
};

export function buildPrintArgs(options: PrintArgsOptions): string[] {
  const args: string[] = [];
  if (options.apiKey) {
    args.push("--api-key", options.apiKey);
  }
  args.push(
    "--print",
    "--output-format",
    "stream-json",
    "--model",
    options.modelId,
    "--trust",
    "--workspace",
    options.workspacePath,
  );
  if (options.force) {
    args.push("--force");
  }
  args.push(options.prompt);
  return args;
}

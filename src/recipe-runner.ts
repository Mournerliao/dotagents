import { spawn } from "node:child_process";

export interface RecipeRunResult {
  argv: string[];
  dryRun: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function formatRecipePermissionReview(input: {
  name: string;
  action: "install" | "update" | "remove";
  upstream: string;
  argv: string[];
}): string {
  return [
    `Permission review for delegated ${input.action}: ${input.name}`,
    `upstream: ${input.upstream}`,
    `command: ${formatArgv(input.argv)}`,
    "effect: runs upstream installer (may use network, npx, and write agent skill directories)",
    "",
  ].join("\n");
}

export function formatArgv(argv: string[]): string {
  return argv
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

export async function runRecipeArgv(
  argv: string[],
  options: { dryRun?: boolean; cwd?: string } = {},
): Promise<RecipeRunResult> {
  if (argv.length === 0) {
    throw new Error("Recipe argv must not be empty.");
  }

  if (options.dryRun === true) {
    return {
      argv,
      dryRun: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  const [command, ...args] = argv;
  if (command === undefined) {
    throw new Error("Recipe argv must not be empty.");
  }

  const result = await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", rejectPromise);
    child.on("close", (exitCode) => {
      resolvePromise({ exitCode, stdout, stderr });
    });
  });

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || "no output";
    throw new Error(
      `Delegated command failed (${formatArgv(argv)}), exit ${String(result.exitCode)}: ${detail}`,
    );
  }

  return {
    argv,
    dryRun: false,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

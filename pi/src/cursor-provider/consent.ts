import type { ForceScope, ToolRejection } from "./types.ts";

export function takeForce(scope: ForceScope): { force: boolean; next: ForceScope } {
  switch (scope) {
    case "once":
      return { force: true, next: "off" };
    case "session":
      return { force: true, next: "session" };
    default:
      return { force: false, next: "off" };
  }
}

export function parseForceArg(args: string): ForceScope | undefined {
  const mode = args.trim().toLowerCase();
  if (mode === "" || mode === "once") return "once";
  if (mode === "session") return "session";
  if (mode === "off" || mode === "never") return "off";
  return undefined;
}

function summarizeArgs(args: Record<string, unknown>): string {
  const path = args["path"] ?? args["targetDirectory"] ?? args["command"];
  return path == null ? "" : String(path);
}

export function formatConfirmSummary(rejections: readonly ToolRejection[]): string {
  const lines = rejections.map((r) => {
    const target = summarizeArgs(r.args);
    return `- ${r.toolName}${target ? ` ${target}` : ""}: ${r.reason}`;
  });
  return [
    "Cursor CLI blocked the following tool(s).",
    "",
    ...lines,
    "",
    "Retry this turn with --force? Already-applied edits may run again.",
    "This is one spawn only; it does not change ~/.cursor/cli-config.json.",
  ].join("\n");
}

export function formatNoUiHint(rejections: readonly ToolRejection[]): string {
  return [
    "",
    "Cursor CLI blocked tool(s) and there is no UI to confirm a retry:",
    ...rejections.map((r) => `- ${r.toolName}: ${r.reason}`),
    "Run /cursor-allow then retry, or confirm in a TUI session.",
    "",
  ].join("\n");
}

export type RetryDecision =
  | { kind: "ask"; summary: string }
  | { kind: "skip"; hint: string }
  | { kind: "skip" };

export function decideRetry(input: {
  alreadyForced: boolean;
  rejections: readonly ToolRejection[];
  hasUI: boolean;
}): RetryDecision {
  if (input.alreadyForced || input.rejections.length === 0) {
    return { kind: "skip" };
  }
  if (!input.hasUI) {
    return { kind: "skip", hint: formatNoUiHint(input.rejections) };
  }
  return { kind: "ask", summary: formatConfirmSummary(input.rejections) };
}

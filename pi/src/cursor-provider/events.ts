import type { CursorStreamEvent, CursorToolCallEvent, ToolRejection } from "./types.ts";

export const TOOL_NAME_MAP: Record<string, string> = {
  shellToolCall: "Shell",
  readToolCall: "Read",
  editToolCall: "Edit",
  writeToolCall: "Write",
  deleteToolCall: "Delete",
  grepToolCall: "Grep",
  globToolCall: "Glob",
  lsToolCall: "Ls",
  todoToolCall: "Todo",
  updateTodosToolCall: "UpdateTodos",
  findToolCall: "Find",
  webFetchToolCall: "WebFetch",
  webSearchToolCall: "WebSearch",
};

export function toPiToolName(cliKey: string): string {
  return TOOL_NAME_MAP[cliKey] ?? cliKey.replace(/ToolCall$/, "");
}

export function parseLine(line: string): CursorStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as CursorStreamEvent;
  } catch {
    return null;
  }
}

export function isToolCallEvent(event: CursorStreamEvent): event is CursorToolCallEvent {
  return event.type === "tool_call" && "subtype" in event && "tool_call" in event;
}

export function toolCallKey(event: CursorToolCallEvent): string | undefined {
  return Object.keys(event.tool_call)[0];
}

/**
 * Cursor runs its own tools, so their activity reaches Pi as assistant text rather than
 * structured tool calls. These prefixes tag those lines so the next turn's prompt can
 * drop them instead of replaying this transcript decoration back to the model.
 */
export const TRANSCRIPT_MARKERS = ["⏳ ", "⛔ ", "↻ "] as const;

export function isTranscriptMarkerLine(line: string): boolean {
  return TRANSCRIPT_MARKERS.some((marker) => line.startsWith(marker));
}

export function formatToolStarted(toolName: string, args: Record<string, unknown>): string {
  const argsSnippet = JSON.stringify(args);
  const brief = argsSnippet.length > 120 ? `${argsSnippet.slice(0, 120)}…` : argsSnippet;
  return `\n⏳ [${toolName}] ${brief}\n`;
}

export function formatRejected(rejection: ToolRejection): string {
  return `\n⛔ [${rejection.toolName}] blocked: ${rejection.reason}\n`;
}

export function formatRetrying(): string {
  return "\n↻ Retrying this turn with --force (Cursor will auto-approve tools).\n";
}

export function extractRejection(event: CursorToolCallEvent): ToolRejection | undefined {
  if (event.subtype !== "completed") return undefined;
  const key = toolCallKey(event);
  if (!key) return undefined;
  const payload = event.tool_call[key];
  const rejected = payload?.result?.rejected;
  if (!rejected) return undefined;
  return {
    toolName: toPiToolName(key),
    args: payload.args ?? {},
    reason: rejected.reason ?? "rejected",
  };
}

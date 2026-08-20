import type { AcpSessionUpdate } from "./types.ts";

/**
 * Cursor runs its own tools, so their activity reaches Pi as assistant text rather than
 * structured tool calls. These prefixes tag those lines so the next turn's prompt can
 * drop them instead of replaying this transcript decoration back to the model.
 * `↻ ` is no longer emitted; it is kept so older sessions still strip the --force retry line.
 */
export const TRANSCRIPT_MARKERS = ["⏳ ", "⛔ ", "↻ "] as const;

export function isTranscriptMarkerLine(line: string): boolean {
  return TRANSCRIPT_MARKERS.some((marker) => line.startsWith(marker));
}

export function formatToolActivity(title: string, status?: string): string {
  const suffix = status && status !== "pending" ? ` ${status}` : "";
  return `\n⏳ ${title}${suffix}\n`;
}

export function formatRejected(title: string, reason?: string): string {
  return reason
    ? `\n⛔ ${title} blocked: ${reason}\n`
    : `\n⛔ ${title} blocked\n`;
}

export function chunkText(update: AcpSessionUpdate): string | undefined {
  if (update.sessionUpdate !== "agent_message_chunk") return undefined;
  const text = update.content?.text;
  return text ? text : undefined;
}

export function thoughtText(update: AcpSessionUpdate): string | undefined {
  if (update.sessionUpdate !== "agent_thought_chunk") return undefined;
  const text = update.content?.text;
  return text ? text : undefined;
}

export function toolMarker(update: AcpSessionUpdate): string | undefined {
  if (update.sessionUpdate === "tool_call") {
    const title = update.title?.trim() || "tool";
    return formatToolActivity(title, update.status);
  }
  if (update.sessionUpdate === "tool_call_update" && update.title) {
    return formatToolActivity(update.title, update.status);
  }
  return undefined;
}

export type WindowUsage = {
  size: number;
  used: number;
  cost?: unknown;
};

export function windowUsage(update: AcpSessionUpdate): WindowUsage | undefined {
  if (update.sessionUpdate !== "usage_update") return undefined;
  if (typeof update.size !== "number" || typeof update.used !== "number") return undefined;
  return {
    size: update.size,
    used: update.used,
    ...(update.cost !== undefined ? { cost: update.cost } : {}),
  };
}

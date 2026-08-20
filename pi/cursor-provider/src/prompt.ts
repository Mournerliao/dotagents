import type { Context, ImageContent, TextContent } from "@earendil-works/pi-ai";

/**
 * Cursor runs its own tools, so their activity reaches Pi as assistant text rather than
 * structured tool calls. These prefixes tag those lines so the next turn's prompt can
 * drop them instead of replaying this transcript decoration back to the model.
 * `↻ ` is no longer emitted; it is kept so older sessions still strip the --force retry line.
 */
const TRANSCRIPT_MARKERS = ["⏳ ", "⛔ ", "↻ "] as const;

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

function contentBlockToText(block: TextContent | ImageContent): string {
  if (block.type === "text") return block.text;
  const bytes = Math.round((block.data.length * 3) / 4);
  return `[Image: ${block.mimeType}, ~${bytes} bytes — note: image input is not supported by the Cursor Agent CLI; the visual content cannot be passed through]`;
}

/** Strips the tool markers this provider adds for display; they are not model output. */
function stripTranscriptMarkers(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isTranscriptMarkerLine(line))
    .join("\n")
    .trim();
}

export function serializeContext(context: Context): string {
  const lines: string[] = [];

  if (context.systemPrompt) {
    lines.push(`[System]\n${context.systemPrompt}\n`);
  }

  for (const msg of context.messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content.map(contentBlockToText).join("\n");
      lines.push(`[User]\n${text}`);
    } else if (msg.role === "assistant") {
      const text = stripTranscriptMarkers(
        msg.content
          .filter((c): c is TextContent => c.type === "text")
          .map((c) => c.text)
          .join("\n"),
      );
      if (text) {
        lines.push(`[Assistant]\n${text}`);
      }
    } else if (msg.role === "toolResult") {
      const text = msg.content.map(contentBlockToText).join("\n");
      if (text.trim()) {
        lines.push(`[Tool result: ${msg.toolName}]\n${text}`);
      }
    }
  }

  return lines.join("\n\n");
}

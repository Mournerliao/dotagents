export type CursorModelDef = {
  id: string;
  name: string;
};

/**
 * Reasoning effort words Cursor encodes into model ids, e.g. `gpt-5.6-sol-xhigh`.
 * `extra-high` is a spelling of `xhigh`; `none` means the model can stop reasoning.
 */
export type CursorEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "extra-high"
  | "max";

export type ParsedModelId = {
  base: string;
  thinking: boolean;
  effort?: CursorEffort | undefined;
  fast: boolean;
};

export type CursorToolCallPayload = {
  args: Record<string, unknown>;
  result?: {
    success?: Record<string, unknown>;
    rejected?: { reason?: string };
    error?: { message?: string };
  };
};

export type CursorAssistantEvent = {
  type: "assistant";
  message: { role: "assistant"; content: Array<{ type: "text"; text: string }> };
};

export type CursorToolCallEvent = {
  type: "tool_call";
  subtype: "started" | "completed";
  tool_call: Record<string, CursorToolCallPayload>;
};

export type CursorResultEvent = {
  type: "result";
  subtype: string;
  duration_ms: number;
};

export type CursorStreamEvent =
  | CursorAssistantEvent
  | CursorToolCallEvent
  | CursorResultEvent
  | { type: string };

export type ToolRejection = {
  toolName: string;
  args: Record<string, unknown>;
  reason: string;
};

export type ForceScope = "off" | "once" | "session";

export type EnvMap = Record<string, string | undefined>;

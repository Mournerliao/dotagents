export type ReasoningLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CursorModelDef = {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
};

export type ModelVariants = {
  default: string;
  minimal?: string;
  low?: string;
  medium?: string;
  high?: string;
  xhigh?: string;
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

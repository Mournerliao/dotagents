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

export type AllowScope = "off" | "once" | "session";

export type EnvMap = Record<string, string | undefined>;

export type PermissionOption = {
  optionId: string;
  name: string;
  kind?: string;
};

export type PermissionContentBlock = {
  type: string;
  content?: { type: string; text?: string };
};

export type PermissionToolCall = {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  content?: PermissionContentBlock[];
};

export type PermissionParams = {
  sessionId: string;
  toolCall: PermissionToolCall;
  options: PermissionOption[];
};

export type AcpContent = {
  type: string;
  text?: string;
};

export type AcpUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedReadTokens?: number;
  cachedWriteTokens?: number;
  thoughtTokens?: number;
};

export type AcpPromptResult = {
  stopReason: string;
  usage?: AcpUsage;
};

export type AcpSessionUpdate = {
  sessionUpdate: string;
  content?: AcpContent;
  title?: string;
  kind?: string;
  status?: string;
  toolCallId?: string;
  size?: number;
  used?: number;
  cost?: unknown;
};

export type AcpPermissionOutcome =
  | { outcome: "selected"; optionId: string }
  | { outcome: "cancelled" };

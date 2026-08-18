export type SupportedAgent = "claude-code" | "codex";
export type SupportedScope = "global" | "project";

const SUPPORTED_AGENTS: readonly SupportedAgent[] = ["claude-code", "codex"];
const SUPPORTED_SCOPES: readonly SupportedScope[] = ["global", "project"];

export function parseSupportedAgent(value: string): SupportedAgent {
  if (!isSupportedAgent(value)) {
    throw new Error(
      `Unsupported agent "${value}". Supported agents: ${SUPPORTED_AGENTS.join(", ")}.`,
    );
  }

  return value;
}

export function parseSupportedScope(value: string): SupportedScope {
  if (!isSupportedScope(value)) {
    throw new Error(
      `Unsupported scope "${value}". Supported scopes: ${SUPPORTED_SCOPES.join(", ")}.`,
    );
  }

  return value;
}

function isSupportedAgent(value: string): value is SupportedAgent {
  return (SUPPORTED_AGENTS as readonly string[]).includes(value);
}

function isSupportedScope(value: string): value is SupportedScope {
  return (SUPPORTED_SCOPES as readonly string[]).includes(value);
}

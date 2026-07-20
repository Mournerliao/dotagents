export type SupportedAgent = "codex";
export type SupportedScope = "project";

export function parseSupportedAgent(value: string): SupportedAgent {
  if (value !== "codex") {
    throw new Error(`Unsupported agent "${value}". Supported agents: codex.`);
  }

  return value;
}

export function parseSupportedScope(value: string): SupportedScope {
  if (value !== "project") {
    throw new Error(`Unsupported scope "${value}". Supported scopes: project.`);
  }

  return value;
}

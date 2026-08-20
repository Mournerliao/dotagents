import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  buildSpawnEnv,
  resolveAgentPath,
  resolveApiKey,
  type EnvMap,
  type SpawnFn,
} from "../agent-cli.ts";
import type { PermissionOption, PermissionParams } from "../consent.ts";
import { AcpPeer } from "./protocol.ts";

export type { SpawnFn };

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

export type AcpMessageChunk = {
  sessionUpdate: "agent_message_chunk";
  content?: AcpContent;
};

export type AcpThoughtChunk = {
  sessionUpdate: "agent_thought_chunk";
  content?: AcpContent;
};

export type AcpToolCall = {
  sessionUpdate: "tool_call";
  title?: string;
  kind?: string;
  status?: string;
  toolCallId?: string;
};

export type AcpToolCallUpdate = {
  sessionUpdate: "tool_call_update";
  title?: string;
  kind?: string;
  status?: string;
  toolCallId?: string;
};

export type AcpUsageUpdate = {
  sessionUpdate: "usage_update";
  size?: number;
  used?: number;
  cost?: unknown;
};

export type AcpSessionUpdate =
  | AcpMessageChunk
  | AcpThoughtChunk
  | AcpToolCall
  | AcpToolCallUpdate
  | AcpUsageUpdate;

export type AcpPermissionOutcome =
  | { outcome: "selected"; optionId: string }
  | { outcome: "cancelled" };

export type WindowUsage = {
  size: number;
  used: number;
  cost?: unknown;
};

export type AcpTurnHost = {
  spawn?: SpawnFn;
  env?: EnvMap;
  agentPath?: string;
  cwd: string;
  modelId: string;
  signal?: AbortSignal;
  onUpdate: (update: AcpSessionUpdate) => void;
  onPermission: (params: PermissionParams) => Promise<AcpPermissionOutcome>;
  onWindowUsage?: (usage: WindowUsage) => void;
};

function rec(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asSessionId(result: unknown): string | undefined {
  const id = rec(result)?.["sessionId"];
  return typeof id === "string" && id ? id : undefined;
}

function asUsage(value: unknown): AcpUsage | undefined {
  const raw = rec(value);
  if (!raw) return undefined;
  if (typeof raw["inputTokens"] !== "number" || typeof raw["outputTokens"] !== "number") return undefined;
  const usage: AcpUsage = {
    inputTokens: raw["inputTokens"],
    outputTokens: raw["outputTokens"],
    totalTokens: typeof raw["totalTokens"] === "number" ? raw["totalTokens"] : raw["inputTokens"] + raw["outputTokens"],
  };
  if (typeof raw["cachedReadTokens"] === "number") usage.cachedReadTokens = raw["cachedReadTokens"];
  if (typeof raw["cachedWriteTokens"] === "number") usage.cachedWriteTokens = raw["cachedWriteTokens"];
  if (typeof raw["thoughtTokens"] === "number") usage.thoughtTokens = raw["thoughtTokens"];
  return usage;
}

function asPromptResult(result: unknown): AcpPromptResult {
  const raw = rec(result);
  const stopReason = typeof raw?.["stopReason"] === "string" ? raw["stopReason"] : "end_turn";
  const usage = asUsage(raw?.["usage"]);
  return usage ? { stopReason, usage } : { stopReason };
}

function asPermissionParams(params: unknown): PermissionParams | undefined {
  const raw = rec(params);
  const toolCall = rec(raw?.["toolCall"]);
  const sessionId = raw?.["sessionId"];
  const optionList = raw?.["options"];
  if (typeof sessionId !== "string" || !toolCall || !Array.isArray(optionList)) return undefined;
  if (typeof toolCall["toolCallId"] !== "string") return undefined;

  const options: PermissionOption[] = [];
  for (const item of optionList) {
    const option = rec(item);
    if (!option || typeof option["optionId"] !== "string" || typeof option["name"] !== "string") continue;
    options.push({
      optionId: option["optionId"],
      name: option["name"],
      ...(typeof option["kind"] === "string" ? { kind: option["kind"] } : {}),
    });
  }
  if (options.length === 0) return undefined;

  const contentRaw = toolCall["content"];
  const content = Array.isArray(contentRaw)
    ? contentRaw.flatMap((block) => {
        const b = rec(block);
        if (!b) return [];
        const inner = rec(b["content"]);
        return [
          {
            type: typeof b["type"] === "string" ? b["type"] : "content",
            ...(inner
              ? {
                  content: {
                    type: typeof inner["type"] === "string" ? inner["type"] : "text",
                    ...(typeof inner["text"] === "string" ? { text: inner["text"] } : {}),
                  },
                }
              : {}),
          },
        ];
      })
    : undefined;

  return {
    sessionId,
    toolCall: {
      toolCallId: toolCall["toolCallId"],
      ...(typeof toolCall["title"] === "string" ? { title: toolCall["title"] } : {}),
      ...(typeof toolCall["kind"] === "string" ? { kind: toolCall["kind"] } : {}),
      ...(typeof toolCall["status"] === "string" ? { status: toolCall["status"] } : {}),
      ...(content ? { content } : {}),
    },
    options,
  };
}

function asContent(value: unknown): AcpContent | undefined {
  const raw = rec(value);
  if (!raw) return undefined;
  return {
    type: typeof raw["type"] === "string" ? raw["type"] : "text",
    ...(typeof raw["text"] === "string" ? { text: raw["text"] } : {}),
  };
}

function asToolFields(nested: Record<string, unknown>): {
  title?: string;
  kind?: string;
  status?: string;
  toolCallId?: string;
} {
  return {
    ...(typeof nested["title"] === "string" ? { title: nested["title"] } : {}),
    ...(typeof nested["kind"] === "string" ? { kind: nested["kind"] } : {}),
    ...(typeof nested["status"] === "string" ? { status: nested["status"] } : {}),
    ...(typeof nested["toolCallId"] === "string" ? { toolCallId: nested["toolCallId"] } : {}),
  };
}

function asUpdate(params: unknown): AcpSessionUpdate | undefined {
  const raw = rec(params);
  const nested = rec(raw?.["update"]) ?? raw;
  if (!nested || typeof nested["sessionUpdate"] !== "string") return undefined;
  const kind = nested["sessionUpdate"];
  switch (kind) {
    case "agent_message_chunk":
    case "agent_thought_chunk": {
      const content = asContent(nested["content"]);
      return content ? { sessionUpdate: kind, content } : { sessionUpdate: kind };
    }
    case "tool_call":
    case "tool_call_update":
      return { sessionUpdate: kind, ...asToolFields(nested) };
    case "usage_update":
      return {
        sessionUpdate: kind,
        ...(typeof nested["size"] === "number" ? { size: nested["size"] } : {}),
        ...(typeof nested["used"] === "number" ? { used: nested["used"] } : {}),
        ...(nested["cost"] !== undefined ? { cost: nested["cost"] } : {}),
      };
    default:
      return undefined;
  }
}

/**
 * One Cursor ACP turn: spawn `agent acp`, handshake, prompt, then tear down.
 * `session/set_model` maps to the CLI's unstable_setSessionModel; a failure is
 * ignored so the turn still runs on whatever model the CLI defaulted to.
 */
export async function runAcpTurn(prompt: string, host: AcpTurnHost): Promise<AcpPromptResult> {
  const doSpawn: SpawnFn = host.spawn ?? (spawn as SpawnFn);
  const env = host.env ?? process.env;
  const agentPath = host.agentPath ?? resolveAgentPath(env);

  const child = doSpawn(agentPath, ["acp"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: buildSpawnEnv(env, resolveApiKey(env)) as NodeJS.ProcessEnv,
  });

  const stderrChunks: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  let sessionId: string | undefined;
  const peer = new AcpPeer({
    write: (line) => {
      child.stdin?.write(`${line}\n`);
    },
    onNotification: (notification) => {
      if (notification.method !== "session/update") return;
      const update = asUpdate(notification.params);
      if (!update) return;
      if (update.sessionUpdate === "usage_update") {
        if (typeof update.size === "number" && typeof update.used === "number") {
          host.onWindowUsage?.({
            size: update.size,
            used: update.used,
            ...(update.cost !== undefined ? { cost: update.cost } : {}),
          });
        }
        return;
      }
      host.onUpdate(update);
    },
    onRequest: async (request) => {
      if (request.method !== "session/request_permission") {
        peer.fail(request.id, { code: -32601, message: `Method not found: ${request.method}` });
        return;
      }
      const params = asPermissionParams(request.params);
      if (!params) {
        peer.fail(request.id, { code: -32602, message: "invalid session/request_permission params" });
        return;
      }
      try {
        const outcome = await host.onPermission(params);
        peer.reply(request.id, { outcome });
      } catch {
        peer.reply(request.id, { outcome: { outcome: "cancelled" } });
      }
    },
  });

  const rl = child.stdout
    ? createInterface({ input: child.stdout, crlfDelay: Infinity })
    : undefined;
  rl?.on("line", (line) => peer.pushLine(line));

  const onAbort = (): void => {
    if (sessionId) {
      void peer.request("session/cancel", { sessionId }).catch(() => undefined);
    }
    child.kill("SIGTERM");
  };
  host.signal?.addEventListener("abort", onAbort, { once: true });

  child.on("error", (err) => peer.close(err));
  child.on("close", (code) => {
    const stderr = stderrChunks.join("").trim();
    const message =
      code && code !== 0
        ? stderr || `Cursor ACP exited with code ${code}`
        : "Cursor ACP session ended";
    peer.close(new Error(message));
  });

  try {
    if (host.signal?.aborted) throw new Error("aborted");

    await peer.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    });
    await peer.request("authenticate", { methodId: "cursor_login" });
    const created = await peer.request("session/new", { cwd: host.cwd, mcpServers: [] });
    sessionId = asSessionId(created);
    if (!sessionId) throw new Error("ACP session/new returned no sessionId");

    try {
      await peer.request("session/set_model", { sessionId, modelId: host.modelId });
    } catch {
      // Unstable in the CLI; keep the turn alive on the default model.
    }

    const result = await peer.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: prompt }],
    });
    return asPromptResult(result);
  } finally {
    host.signal?.removeEventListener("abort", onAbort);
    rl?.close();
    child.kill("SIGTERM");
  }
}

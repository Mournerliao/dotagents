import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
  TextContent,
  ThinkingContent,
  ThinkingLevel,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { runAcpTurn, type SpawnFn } from "./acp/session.ts";
import { decidePermission } from "./consent.ts";
import { chunkText, formatRejected, thoughtText, toolMarker } from "./events.ts";
import { serializeContext } from "./prompt.ts";
import type { AcpUsage, EnvMap, PermissionParams } from "./types.ts";

export type { SpawnFn };

export type CursorStreamHost = {
  spawn?: SpawnFn;
  now?: () => number;
  agentPath?: string;
  workspacePath?: string;
  env?: EnvMap;
  hasUI?: boolean;
  autoAllow?: boolean;
  select?: (title: string, options: string[]) => Promise<string | undefined>;
  resolveCliId?: (canonicalId: string, level?: ThinkingLevel) => string;
};

function emptyUsage(): AssistantMessage["usage"] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function toPiUsage(usage?: AcpUsage): AssistantMessage["usage"] {
  if (!usage) return emptyUsage();
  const cacheRead = usage.cachedReadTokens ?? 0;
  const cacheWrite = usage.cachedWriteTokens ?? 0;
  const input = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);
  return {
    input,
    output: usage.outputTokens,
    cacheRead,
    cacheWrite,
    ...(usage.thoughtTokens !== undefined ? { reasoning: usage.thoughtTokens } : {}),
    totalTokens: usage.totalTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function streamCursorCli(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
  host: CursorStreamHost = {},
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const now = host.now ?? Date.now;
  const workspacePath = host.workspacePath ?? process.cwd();
  const resolveCliId = host.resolveCliId ?? ((canonicalId: string) => canonicalId);

  void (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: emptyUsage(),
      stopReason: "pending",
      timestamp: now(),
    };

    let textOpen = false;
    let thinkingOpen = false;
    let accumulatedText = "";
    let accumulatedThinking = "";

    const closeText = (): void => {
      if (!textOpen) return;
      const idx = output.content.length - 1;
      stream.push({ type: "text_end", contentIndex: idx, content: accumulatedText, partial: output });
      textOpen = false;
      accumulatedText = "";
    };

    const closeThinking = (): void => {
      if (!thinkingOpen) return;
      const idx = output.content.length - 1;
      stream.push({
        type: "thinking_end",
        contentIndex: idx,
        content: accumulatedThinking,
        partial: output,
      });
      thinkingOpen = false;
      accumulatedThinking = "";
    };

    const pushText = (delta: string): void => {
      if (!delta) return;
      closeThinking();
      if (!textOpen) {
        output.content.push({ type: "text", text: "" });
        const idx = output.content.length - 1;
        stream.push({ type: "text_start", contentIndex: idx, partial: output });
        textOpen = true;
      }
      const idx = output.content.length - 1;
      const textBlock = output.content[idx] as TextContent;
      textBlock.text += delta;
      accumulatedText += delta;
      stream.push({ type: "text_delta", contentIndex: idx, delta, partial: output });
    };

    const pushThinking = (delta: string): void => {
      if (!delta) return;
      closeText();
      if (!thinkingOpen) {
        output.content.push({ type: "thinking", thinking: "" });
        const idx = output.content.length - 1;
        stream.push({ type: "thinking_start", contentIndex: idx, partial: output });
        thinkingOpen = true;
      }
      const idx = output.content.length - 1;
      const thinkingBlock = output.content[idx] as ThinkingContent;
      thinkingBlock.thinking += delta;
      accumulatedThinking += delta;
      stream.push({ type: "thinking_delta", contentIndex: idx, delta, partial: output });
    };

    const fail = (reason: "error" | "aborted", message: string): void => {
      closeThinking();
      closeText();
      output.stopReason = reason;
      output.errorMessage = message;
      stream.push({ type: "error", reason, error: output });
      stream.end();
    };

    const answerPermission = async (request: PermissionParams) => {
      const decision = decidePermission({
        hasUI: host.hasUI ?? false,
        autoAllow: host.autoAllow ?? false,
        request,
      });
      if (decision.kind === "ask") {
        const picked = host.select ? await host.select(decision.title, decision.labels) : undefined;
        const optionId = picked ? decision.optionIdFor(picked) : undefined;
        if (!optionId) return { outcome: "cancelled" as const };
        if (optionId === "reject-once") {
          pushText(formatRejected(request.toolCall.title ?? "tool"));
        }
        return { outcome: "selected" as const, optionId };
      }
      if (decision.hint) pushText(decision.hint);
      if (decision.optionId === "reject-once") {
        pushText(formatRejected(request.toolCall.title ?? "tool"));
      }
      return { outcome: "selected" as const, optionId: decision.optionId };
    };

    try {
      stream.push({ type: "start", partial: output });
      const prompt = serializeContext(context);

      const result = await runAcpTurn(prompt, {
        ...(host.spawn ? { spawn: host.spawn } : {}),
        ...(host.env ? { env: host.env } : {}),
        ...(host.agentPath ? { agentPath: host.agentPath } : {}),
        cwd: workspacePath,
        modelId: resolveCliId(model.id, options?.reasoning),
        ...(options?.signal ? { signal: options.signal } : {}),
        onUpdate: (update) => {
          const thought = thoughtText(update);
          if (thought) {
            pushThinking(thought);
            return;
          }
          const text = chunkText(update);
          if (text) {
            pushText(text);
            return;
          }
          const marker = toolMarker(update);
          if (marker) pushText(marker);
        },
        onPermission: answerPermission,
        onWindowUsage: (usage) => {
          if (process.env["PI_CURSOR_ACP_DEBUG"] === "1") {
            process.stderr.write(
              `[pi-cursor-provider] usage_update ${JSON.stringify({ size: usage.size, used: usage.used, cost: usage.cost })}\n`,
            );
          }
        },
      });

      if (options?.signal?.aborted) {
        fail("aborted", "aborted");
        return;
      }

      output.usage = toPiUsage(result.usage);
      closeThinking();
      closeText();
      output.stopReason = "stop";
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (error) {
      const reason = options?.signal?.aborted ? "aborted" : "error";
      fail(reason, error instanceof Error ? error.message : String(error));
    }
  })();

  return stream;
}

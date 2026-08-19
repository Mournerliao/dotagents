import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
  TextContent,
  ThinkingLevel,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { decideRetry } from "./consent.ts";
import {
  extractRejection,
  formatRejected,
  formatRetrying,
  formatToolStarted,
  isToolCallEvent,
  parseLine,
  toPiToolName,
  toolCallKey,
} from "./events.ts";
import { serializeContext } from "./prompt.ts";
import {
  buildPrintArgs,
  buildSpawnEnv,
  checkPromptSize,
  resolveAgentPath,
  resolveApiKey,
} from "./spawn.ts";
import type { CursorAssistantEvent, EnvMap, ToolRejection } from "./types.ts";

export type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: { stdio?: unknown; env?: NodeJS.ProcessEnv },
) => ChildProcess;

export type CursorStreamHost = {
  spawn?: SpawnFn;
  now?: () => number;
  agentPath?: string;
  workspacePath?: string;
  env?: EnvMap;
  hasUI?: boolean;
  confirm?: (title: string, message: string) => Promise<boolean>;
  /** Whether this turn was already granted `--force` by `/cursor-allow`. */
  force?: boolean;
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

export function streamCursorCli(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
  host: CursorStreamHost = {},
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const doSpawn: SpawnFn = host.spawn ?? (spawn as SpawnFn);
  const now = host.now ?? Date.now;
  const env = host.env ?? process.env;
  const agentPath = host.agentPath ?? resolveAgentPath(env);
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

    let textBlockOpen = false;
    let accumulatedText = "";

    const closeText = (): void => {
      if (!textBlockOpen) return;
      const idx = output.content.length - 1;
      stream.push({ type: "text_end", contentIndex: idx, content: accumulatedText, partial: output });
      textBlockOpen = false;
      accumulatedText = "";
    };

    const pushText = (delta: string): void => {
      if (!delta) return;
      if (!textBlockOpen) {
        output.content.push({ type: "text", text: "" });
        const idx = output.content.length - 1;
        stream.push({ type: "text_start", contentIndex: idx, partial: output });
        textBlockOpen = true;
      }
      const idx = output.content.length - 1;
      const textBlock = output.content[idx] as TextContent;
      textBlock.text += delta;
      accumulatedText += delta;
      stream.push({ type: "text_delta", contentIndex: idx, delta, partial: output });
    };

    const fail = (reason: "error" | "aborted", message: string): void => {
      closeText();
      output.stopReason = reason;
      output.errorMessage = message;
      stream.push({ type: "error", reason, error: output });
      stream.end();
    };

    const prompt = serializeContext(context);

    const runSpawn = async (force: boolean): Promise<{
      outcome: "ok" | "aborted" | "error";
      rejections: ToolRejection[];
      errorMessage?: string;
    }> => {
      const rejections: ToolRejection[] = [];
      const args = buildPrintArgs({
        modelId: resolveCliId(model.id, options?.reasoning),
        workspacePath,
        prompt,
        force,
      });

      const child = doSpawn(agentPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: buildSpawnEnv(env, resolveApiKey(env)) as NodeJS.ProcessEnv,
      });

      const onAbort = (): void => {
        child.kill("SIGTERM");
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      const stderrChunks: string[] = [];
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString());
      });

      const rl = child.stdout
        ? createInterface({ input: child.stdout, crlfDelay: Infinity })
        : undefined;
      rl?.on("line", (line: string) => {
        const event = parseLine(line);
        if (!event) return;

        if (event.type === "assistant") {
          const ae = event as CursorAssistantEvent;
          for (const block of ae.message.content) {
            if (block.type !== "text" || !block.text.trim()) continue;
            pushText(block.text);
          }
          return;
        }

        if (!isToolCallEvent(event)) return;
        const cliKey = toolCallKey(event);
        if (!cliKey) return;
        const toolName = toPiToolName(cliKey);

        if (event.subtype === "started") {
          const payload = event.tool_call[cliKey];
          pushText(formatToolStarted(toolName, payload?.args ?? {}));
          return;
        }

        const rejection = extractRejection(event);
        if (rejection) {
          rejections.push(rejection);
          pushText(formatRejected(rejection));
        }
      });

      return await new Promise((resolve) => {
        child.on("close", (code) => {
          rl?.close();
          options?.signal?.removeEventListener("abort", onAbort);
          closeText();
          if (options?.signal?.aborted) {
            resolve({ outcome: "aborted", rejections });
            return;
          }
          // A rejected tool is a normal non-zero exit; the caller may retry it with
          // --force. Any other non-zero exit is a real failure even if text arrived.
          if (code !== 0 && rejections.length === 0) {
            const stderr = stderrChunks.join("").trim();
            resolve({
              outcome: "error",
              rejections,
              errorMessage: stderr || `Cursor CLI exited with code ${code}`,
            });
            return;
          }
          resolve({ outcome: "ok", rejections });
        });

        child.on("error", (err) => {
          rl?.close();
          options?.signal?.removeEventListener("abort", onAbort);
          closeText();
          resolve({ outcome: "error", rejections, errorMessage: err.message });
        });
      });
    };

    try {
      stream.push({ type: "start", partial: output });

      const oversized = checkPromptSize(prompt);
      if (oversized) {
        fail("error", oversized);
        return;
      }

      const alreadyForced = host.force ?? false;
      const first = await runSpawn(alreadyForced);
      if (first.outcome === "aborted") {
        fail("aborted", "aborted");
        return;
      }
      if (first.outcome === "error") {
        fail("error", first.errorMessage ?? "Cursor CLI error");
        return;
      }

      const decision = decideRetry({
        alreadyForced,
        rejections: first.rejections,
        hasUI: host.hasUI ?? false,
      });

      if (decision.kind === "ask" && host.confirm) {
        const ok = await host.confirm("Cursor blocked a tool", decision.summary);
        if (ok) {
          pushText(formatRetrying());
          const retry = await runSpawn(true);
          if (retry.outcome === "aborted") {
            fail("aborted", "aborted");
            return;
          }
          if (retry.outcome === "error") {
            fail("error", retry.errorMessage ?? "Cursor CLI error");
            return;
          }
        }
      } else if (decision.kind === "skip" && "hint" in decision) {
        pushText(decision.hint);
      }

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

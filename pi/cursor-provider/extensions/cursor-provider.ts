import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runAgentLogin, runAgentLogout, runAgentModels, runAgentStatus } from "../src/agent-cli.ts";
import { catalogCachePath, loadCatalog } from "../src/catalog.ts";
import { createAllowGrant, parseAllowArg } from "../src/consent.ts";
import { streamCursorCli } from "../src/stream.ts";

export default async function cursorProvider(pi: ExtensionAPI): Promise<void> {
  const grant = createAllowGrant();
  let turnCtx: ExtensionContext | undefined;
  let autoAllowThisTurn = false;

  // The grant is bound to the start of a turn so compaction cannot spend it.
  pi.on("before_agent_start", (_event, ctx) => {
    turnCtx = ctx;
    autoAllowThisTurn = grant.claimForTurn();
  });
  pi.on("agent_end", () => {
    turnCtx = undefined;
    autoAllowThisTurn = false;
  });

  const cachePath = catalogCachePath();
  const catalog = await loadCatalog({
    readCache: async () => {
      try {
        return await readFile(cachePath, "utf8");
      } catch {
        return undefined;
      }
    },
    writeCache: async (contents) => {
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, contents, "utf8");
    },
    fetchModels: () => runAgentModels(),
    now: Date.now,
  });

  pi.registerProvider("cursor", {
    name: "Cursor",
    baseUrl: "cli://cursor-agent",
    apiKey: "CURSOR_API_KEY",
    api: "cursor-cli" as Api,
    models: catalog.models,
    streamSimple: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => {
      const host = {
        hasUI: turnCtx?.hasUI ?? false,
        autoAllow: autoAllowThisTurn,
        resolveCliId: catalog.resolveCliId,
      };
      return streamCursorCli(
        model,
        context,
        options,
        turnCtx?.hasUI
          ? { ...host, select: (title, choices) => turnCtx!.ui.select(title, choices) }
          : host,
      );
    },
  });

  pi.registerCommand("cursor-login", {
    description: "Log in to Cursor (runs `agent login`)",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Starting Cursor login (NO_OPEN_BROWSER=1 — copy the URL from the output)…", "info");
      try {
        await runAgentLogin();
        ctx.ui.notify("Cursor login successful.", "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Cursor login failed: ${msg}`, "error");
      }
    },
  });

  pi.registerCommand("cursor-status", {
    description: "Show Cursor authentication status (runs `agent status`)",
    handler: async (_args, ctx) => {
      try {
        const status = await runAgentStatus();
        ctx.ui.notify(status || "No output from `agent status`.", "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Could not get Cursor status: ${msg}`, "error");
      }
    },
  });

  pi.registerCommand("cursor-logout", {
    description: "Log out of Cursor (runs `agent logout`)",
    handler: async (_args, ctx) => {
      try {
        await runAgentLogout();
        ctx.ui.notify("Logged out of Cursor.", "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Cursor logout failed: ${msg}`, "error");
      }
    },
  });

  pi.registerCommand("cursor-allow", {
    description: "In print mode, auto-answer Cursor permission prompts with allow-once (once|session|off)",
    handler: async (args, ctx) => {
      const scope = parseAllowArg(args);
      if (!scope) {
        ctx.ui.notify("Usage: /cursor-allow [once|session|off]", "error");
        return;
      }
      grant.set(scope);
      if (scope === "once") {
        ctx.ui.notify(
          "Next Cursor turn without a UI will auto-answer allow-once. Interactive sessions still ask.",
          "info",
        );
      } else if (scope === "session") {
        ctx.ui.notify(
          "This Pi session will auto-answer allow-once when there is no UI. Interactive sessions still ask.",
          "info",
        );
      } else {
        ctx.ui.notify("Print-mode auto-allow is off. Permission prompts without a UI will be rejected.", "info");
      }
    },
  });
}

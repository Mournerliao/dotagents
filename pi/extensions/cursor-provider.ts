import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { runAgentLogin, runAgentLogout, runAgentModels, runAgentStatus } from "../src/cursor-provider/agent-cli.ts";
import { parseForceArg, takeForce } from "../src/cursor-provider/consent.ts";
import { STATIC_MODELS, toProviderModels } from "../src/cursor-provider/models.ts";
import { streamCursorCli } from "../src/cursor-provider/stream.ts";
import type { ForceScope } from "../src/cursor-provider/types.ts";

export default async function cursorProvider(pi: ExtensionAPI): Promise<void> {
  const forceState: { scope: ForceScope } = { scope: "off" };
  let turnCtx: ExtensionContext | undefined;

  pi.on("before_agent_start", (_event, ctx) => {
    turnCtx = ctx;
  });
  pi.on("agent_end", () => {
    turnCtx = undefined;
  });

  let modelDefs = STATIC_MODELS;
  try {
    modelDefs = await runAgentModels();
  } catch {
    modelDefs = STATIC_MODELS;
  }

  pi.registerProvider("cursor", {
    name: "Cursor",
    baseUrl: "cli://cursor-agent",
    apiKey: "CURSOR_API_KEY",
    api: "cursor-cli" as Api,
    models: toProviderModels(modelDefs),
    streamSimple: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => {
      const host = {
        hasUI: turnCtx?.hasUI ?? false,
        takeForce: () => {
          const result = takeForce(forceState.scope);
          forceState.scope = result.next;
          return result.force;
        },
      };
      return streamCursorCli(model, context, options, turnCtx?.hasUI
        ? { ...host, confirm: (title, message) => turnCtx!.ui.confirm(title, message) }
        : host);
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
    description: "Allow Cursor CLI tools for the next turn, this session, or turn off (once|session|off)",
    handler: async (args, ctx) => {
      const scope = parseForceArg(args);
      if (!scope) {
        ctx.ui.notify("Usage: /cursor-allow [once|session|off]", "error");
        return;
      }
      forceState.scope = scope;
      if (scope === "once") {
        ctx.ui.notify("Next Cursor turn will spawn with --force. This does not edit cli-config.json.", "info");
      } else if (scope === "session") {
        ctx.ui.notify("This Pi session will spawn Cursor with --force until /cursor-allow off.", "info");
      } else {
        ctx.ui.notify("Cursor --force is off. Blocked tools can still prompt for a one-turn retry.", "info");
      }
    },
  });
}

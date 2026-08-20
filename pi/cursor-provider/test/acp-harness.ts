import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import type { SpawnFn } from "../src/agent-cli.ts";
import type { AcpSessionUpdate, AcpUsage } from "../src/acp/session.ts";
import type { PermissionParams } from "../src/consent.ts";

export type AcpScript = {
  authenticateError?: string;
  setModelError?: string;
  updates?: AcpSessionUpdate[];
  afterPermission?: AcpSessionUpdate[];
  permission?: PermissionParams;
  usage?: AcpUsage;
  stopReason?: string;
  hangUntilAbort?: boolean;
  junkParams?: unknown[];
};

export function scriptedAcp(script: AcpScript = {}): {
  spawn: SpawnFn;
  argv: string[][];
  methods: string[];
  permissionOptionIds: string[];
} {
  const argv: string[][] = [];
  const methods: string[] = [];
  const permissionOptionIds: string[] = [];

  const spawn: SpawnFn = (_command, args) => {
    argv.push([...args]);
    return startServer(script, methods, permissionOptionIds);
  };

  return { spawn, argv, methods, permissionOptionIds };
}

function startServer(
  script: AcpScript,
  methods: string[],
  permissionOptionIds: string[],
): ChildProcess {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as ChildProcess;
  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = stderr;

  let closed = false;
  const finish = (code = 0): void => {
    if (closed) return;
    closed = true;
    stdin.end();
    stdout.end();
    stderr.end();
    setImmediate(() => child.emit("close", code));
  };

  child.kill = () => {
    finish(0);
    return true;
  };

  const send = (msg: unknown): void => {
    if (!closed) stdout.write(`${JSON.stringify(msg)}\n`);
  };

  const permissionWaiters = new Map<number, (result: unknown) => void>();

  const rl = createInterface({ input: stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if ("result" in msg || "error" in msg) {
      const waiter = permissionWaiters.get(msg["id"] as number);
      if (waiter) {
        permissionWaiters.delete(msg["id"] as number);
        waiter(msg["result"]);
      }
      return;
    }

    const method = String(msg["method"] ?? "");
    const id = msg["id"];
    methods.push(method);

    const reply = (result: unknown): void => {
      send({ jsonrpc: "2.0", id, result });
    };
    const fail = (message: string): void => {
      send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
    };

    if (method === "initialize") {
      reply({ protocolVersion: 1 });
      return;
    }
    if (method === "authenticate") {
      if (script.authenticateError) {
        fail(script.authenticateError);
        return;
      }
      reply({});
      return;
    }
    if (method === "session/new") {
      reply({ sessionId: "sess-1" });
      return;
    }
    if (method === "session/set_model") {
      if (script.setModelError) {
        fail(script.setModelError);
        return;
      }
      reply({});
      return;
    }
    if (method === "session/cancel") {
      reply({});
      finish(0);
      return;
    }
    if (method === "session/prompt") {
      void (async () => {
        for (const params of script.junkParams ?? []) {
          send({ jsonrpc: "2.0", method: "session/update", params });
        }
        for (const update of script.updates ?? []) {
          send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "sess-1", update } });
        }
        if (script.permission) {
          const permId = 9000;
          send({
            jsonrpc: "2.0",
            id: permId,
            method: "session/request_permission",
            params: script.permission,
          });
          const result = await new Promise<unknown>((resolve) => {
            permissionWaiters.set(permId, resolve);
          });
          const outcome = (result as { outcome?: { optionId?: string } } | undefined)?.outcome;
          if (outcome?.optionId) permissionOptionIds.push(outcome.optionId);
        }
        for (const update of script.afterPermission ?? []) {
          send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "sess-1", update } });
        }
        if (script.hangUntilAbort) return;
        const payload: Record<string, unknown> = { stopReason: script.stopReason ?? "end_turn" };
        if (script.usage) payload["usage"] = script.usage;
        reply(payload);
      })();
      return;
    }
    fail(`unknown method ${method}`);
  });

  return child;
}

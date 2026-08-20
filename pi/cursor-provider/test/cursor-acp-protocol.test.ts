import assert from "node:assert/strict";
import test from "node:test";
import {
  AcpPeer,
  encodeRequest,
  encodeResponse,
  parseIncoming,
} from "../src/acp/protocol.ts";

test("parseIncoming splits responses, notifications, and server requests", () => {
  assert.equal(parseIncoming(""), undefined);
  assert.equal(parseIncoming("not-json"), undefined);

  assert.deepEqual(parseIncoming(encodeRequest(1, "initialize", { protocolVersion: 1 })), {
    kind: "request",
    id: 1,
    method: "initialize",
    params: { protocolVersion: 1 },
  });

  assert.deepEqual(parseIncoming('{"jsonrpc":"2.0","method":"session/update","params":{"x":1}}'), {
    kind: "notification",
    method: "session/update",
    params: { x: 1 },
  });

  assert.deepEqual(parseIncoming(encodeResponse(7, { sessionId: "s" })), {
    kind: "response",
    id: 7,
    result: { sessionId: "s" },
  });

  assert.deepEqual(
    parseIncoming('{"jsonrpc":"2.0","id":3,"error":{"code":-32000,"message":"nope"}}'),
    { kind: "error", id: 3, error: { code: -32000, message: "nope" } },
  );
});

test("a server request is not treated as a client response just because it has an id", () => {
  const incoming = parseIncoming(
    '{"jsonrpc":"2.0","id":99,"method":"session/request_permission","params":{"sessionId":"s"}}',
  );
  assert.equal(incoming?.kind, "request");
  if (incoming?.kind === "request") {
    assert.equal(incoming.method, "session/request_permission");
    assert.equal(incoming.id, 99);
  }
});

test("AcpPeer resolves client requests and surfaces server requests separately", async () => {
  const written: string[] = [];
  const seen: string[] = [];
  const peer = new AcpPeer({
    write: (line) => written.push(line),
    onRequest: (req) => {
      seen.push(req.method);
      peer.reply(req.id, { outcome: { outcome: "selected", optionId: "reject-once" } });
    },
  });

  const pending = peer.request("session/new", { cwd: "/tmp" });
  assert.match(written[0] ?? "", /"method":"session\/new"/);

  peer.pushLine('{"jsonrpc":"2.0","id":1,"result":{"sessionId":"abc"}}');
  assert.deepEqual(await pending, { sessionId: "abc" });

  peer.pushLine(
    '{"jsonrpc":"2.0","id":50,"method":"session/request_permission","params":{"sessionId":"abc"}}',
  );
  assert.deepEqual(seen, ["session/request_permission"]);
  assert.match(written[1] ?? "", /"id":50/);
  assert.match(written[1] ?? "", /reject-once/);
});

test("AcpPeer rejects a pending request when the server returns an error or the peer closes", async () => {
  const peer = new AcpPeer({ write: () => undefined });
  const failed = peer.request("authenticate", { methodId: "cursor_login" });
  peer.pushLine('{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"login required"}}');
  await assert.rejects(failed, /login required/);

  const hanging = peer.request("session/prompt", {});
  peer.close(new Error("agent exited"));
  await assert.rejects(hanging, /agent exited/);
});

export type JsonRpcId = number | string;

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type IncomingRequest = {
  kind: "request";
  id: JsonRpcId;
  method: string;
  params: unknown;
};

export type IncomingNotification = {
  kind: "notification";
  method: string;
  params: unknown;
};

export type IncomingResponse = {
  kind: "response";
  id: JsonRpcId;
  result: unknown;
};

export type IncomingError = {
  kind: "error";
  id: JsonRpcId;
  error: JsonRpcError;
};

export type IncomingMessage = IncomingRequest | IncomingNotification | IncomingResponse | IncomingError;

export function encodeRequest(id: JsonRpcId, method: string, params?: unknown): string {
  const msg: Record<string, unknown> = { jsonrpc: "2.0", id, method };
  if (params !== undefined) msg["params"] = params;
  return JSON.stringify(msg);
}

export function encodeResponse(id: JsonRpcId, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

export function encodeError(id: JsonRpcId, error: JsonRpcError): string {
  return JSON.stringify({ jsonrpc: "2.0", id, error });
}

function asId(value: unknown): JsonRpcId | undefined {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function asError(value: unknown): JsonRpcError {
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec["code"] === "number" && typeof rec["message"] === "string") {
      return {
        code: rec["code"],
        message: rec["message"],
        ...(rec["data"] !== undefined ? { data: rec["data"] } : {}),
      };
    }
  }
  return { code: -32603, message: "unknown error" };
}

export function parseIncoming(line: string): IncomingMessage | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== "object") return undefined;
  const msg = raw as Record<string, unknown>;
  const method = typeof msg["method"] === "string" ? msg["method"] : undefined;
  const id = asId(msg["id"]);

  if (method && id !== undefined) {
    return { kind: "request", id, method, params: msg["params"] };
  }
  if (method) {
    return { kind: "notification", method, params: msg["params"] };
  }
  if (id !== undefined && "error" in msg) {
    return { kind: "error", id, error: asError(msg["error"]) };
  }
  if (id !== undefined && "result" in msg) {
    return { kind: "response", id, result: msg["result"] };
  }
  return undefined;
}

export type AcpWrite = (line: string) => void;

export type AcpPeerOptions = {
  write: AcpWrite;
  onRequest?: (request: IncomingRequest) => void | Promise<void>;
  onNotification?: (notification: IncomingNotification) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

/**
 * One JSON-RPC peer over newline-delimited stdout/stdin. Client calls go through
 * `request`; the server can also send requests (permission, fs, terminal) which
 * must not be confused with responses just because they carry an id.
 */
export class AcpPeer {
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, Pending>();
  private closed: Error | undefined;
  private readonly options: AcpPeerOptions;

  constructor(options: AcpPeerOptions) {
    this.options = options;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(this.closed);
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.options.write(encodeRequest(id, method, params));
    });
  }

  reply(id: JsonRpcId, result: unknown): void {
    this.options.write(encodeResponse(id, result));
  }

  fail(id: JsonRpcId, error: JsonRpcError): void {
    this.options.write(encodeError(id, error));
  }

  pushLine(line: string): void {
    const incoming = parseIncoming(line);
    if (!incoming) return;

    if (incoming.kind === "response") {
      const waiter = this.pending.get(incoming.id);
      if (!waiter) return;
      this.pending.delete(incoming.id);
      waiter.resolve(incoming.result);
      return;
    }
    if (incoming.kind === "error") {
      const waiter = this.pending.get(incoming.id);
      if (!waiter) return;
      this.pending.delete(incoming.id);
      waiter.reject(new Error(incoming.error.message));
      return;
    }
    if (incoming.kind === "notification") {
      this.options.onNotification?.(incoming);
      return;
    }
    void this.options.onRequest?.(incoming);
  }

  close(reason: Error): void {
    if (this.closed) return;
    this.closed = reason;
    for (const waiter of this.pending.values()) waiter.reject(reason);
    this.pending.clear();
  }
}

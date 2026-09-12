/**
 * MCP stdio JSON-RPC: newline-delimited JSON (spec) plus LSP Content-Length
 * on read so tests and mixed servers still parse.
 */

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

export type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
};

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccess
  | JsonRpcFailure;

const CONTENT_LENGTH_PREFIX = "content-length:";

/** Official MCP stdio: one JSON object per line, no embedded newlines. */
export function encodeJsonRpcNdjson(payload: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
}

/** LSP Content-Length frame — kept for tests and dual-mode parse coverage. */
export function encodeJsonRpcFrame(payload: unknown): Buffer {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

export function isJsonRpcResponse(
  value: unknown,
): value is JsonRpcSuccess | JsonRpcFailure {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return row.jsonrpc === "2.0" && ("result" in row || "error" in row);
}

export function isJsonRpcNotification(
  value: unknown,
): value is JsonRpcNotification {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    row.jsonrpc === "2.0" &&
    typeof row.method === "string" &&
    !("id" in row)
  );
}

function indexOfHeaderEnd(buffer: Buffer): { index: number; width: number } | null {
  const crlf = buffer.indexOf("\r\n\r\n");
  const lf = buffer.indexOf("\n\n");
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
    return { index: crlf, width: 4 };
  }
  if (lf >= 0) {
    return { index: lf, width: 2 };
  }
  return null;
}

/**
 * Incremental framer: Content-Length (`\r\n\r\n` or `\n\n`) and NDJSON.
 * Ignores malformed bodies rather than throwing.
 */
export class JsonRpcFramer {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];
    while (this.consumeOne(messages)) {
      // drain
    }
    return messages;
  }

  private consumeOne(messages: unknown[]): boolean {
    this.skipLeadingNewlines();
    if (this.buffer.length === 0) {
      return false;
    }
    if (this.isContentLengthStart()) {
      return this.consumeContentLength(messages);
    }
    return this.consumeNdjson(messages);
  }

  private skipLeadingNewlines(): void {
    let i = 0;
    while (i < this.buffer.length) {
      const c = this.buffer[i];
      if (c === 0x0a || c === 0x0d) {
        i += 1;
        continue;
      }
      break;
    }
    if (i > 0) {
      this.buffer = this.buffer.subarray(i);
    }
  }

  private isContentLengthStart(): boolean {
    const peek = this.buffer
      .subarray(0, Math.min(this.buffer.length, 32))
      .toString("utf8")
      .replace(/^[\t ]+/, "")
      .toLowerCase();
    if (peek.startsWith("{") || peek.startsWith("[")) {
      return false;
    }
    if (peek.startsWith(CONTENT_LENGTH_PREFIX)) {
      return true;
    }
    return (
      peek.length < CONTENT_LENGTH_PREFIX.length &&
      CONTENT_LENGTH_PREFIX.startsWith(peek) &&
      peek.length > 0
    );
  }

  private consumeContentLength(messages: unknown[]): boolean {
    const headerEnd = indexOfHeaderEnd(this.buffer);
    if (!headerEnd) {
      return false;
    }
    const header = this.buffer.subarray(0, headerEnd.index).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match?.[1]) {
      this.buffer = this.buffer.subarray(headerEnd.index + headerEnd.width);
      return true;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd.index + headerEnd.width;
    if (this.buffer.length < bodyStart + len) {
      return false;
    }
    const body = this.buffer.subarray(bodyStart, bodyStart + len).toString("utf8");
    this.buffer = this.buffer.subarray(bodyStart + len);
    try {
      messages.push(JSON.parse(body) as unknown);
    } catch {
      // skip malformed JSON
    }
    return true;
  }

  private consumeNdjson(messages: unknown[]): boolean {
    const nl = this.buffer.indexOf("\n");
    if (nl < 0) {
      return false;
    }
    let line = this.buffer.subarray(0, nl).toString("utf8");
    this.buffer = this.buffer.subarray(nl + 1);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }
    try {
      messages.push(JSON.parse(trimmed) as unknown);
    } catch {
      // skip cmd.exe noise / non-JSON lines
    }
    return true;
  }
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type JsonRpcStdioStreams = {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
};

/**
 * JSON-RPC client over MCP NDJSON stdio. Child crashes must not throw
 * uncaught — pending requests reject instead.
 */
export class JsonRpcStdioClient {
  private readonly framer = new JsonRpcFramer();
  private readonly pending = new Map<JsonRpcId, Pending>();
  private nextId = 1;
  private closed = false;
  private readonly onNotification: (msg: JsonRpcNotification) => void;
  private readonly onStdout: (chunk: Buffer) => void;

  constructor(
    private readonly streams: JsonRpcStdioStreams,
    options?: {
      onNotification?: (msg: JsonRpcNotification) => void;
    },
  ) {
    this.onNotification = options?.onNotification ?? (() => undefined);
    this.onStdout = (chunk: Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      for (const msg of this.framer.push(buf)) {
        this.handleMessage(msg);
      }
    };
    this.streams.stdout.on("data", this.onStdout);
  }

  async request(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (this.closed) {
      throw new Error("JSON-RPC client is closed");
    }
    const id = this.nextId++;
    const frame = encodeJsonRpcNdjson({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC timeout (${timeoutMs}ms): ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.streams.stdin.write(frame, (err) => {
          if (err) {
            clearTimeout(timer);
            this.pending.delete(id);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) {
      return;
    }
    try {
      this.streams.stdin.write(
        encodeJsonRpcNdjson({ jsonrpc: "2.0", method, params }),
      );
    } catch {
      // child already gone
    }
  }

  close(reason = "JSON-RPC client closed"): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.streams.stdout.off("data", this.onStdout);
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private handleMessage(msg: unknown): void {
    if (isJsonRpcNotification(msg)) {
      try {
        this.onNotification(msg);
      } catch {
        // never let Studio notifications crash Electron
      }
      return;
    }
    if (!isJsonRpcResponse(msg)) {
      if (
        typeof msg === "object" &&
        msg !== null &&
        "method" in msg &&
        typeof (msg as { method: unknown }).method === "string"
      ) {
        try {
          this.onNotification(msg as JsonRpcNotification);
        } catch {
          // ignore
        }
      }
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(msg.id);
    if ("error" in msg && msg.error) {
      pending.reject(
        new Error(msg.error.message || `JSON-RPC error ${msg.error.code}`),
      );
      return;
    }
    pending.resolve("result" in msg ? msg.result : undefined);
  }
}

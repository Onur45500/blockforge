import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import { encodeJsonRpcFrame, encodeJsonRpcNdjson, JsonRpcFramer } from "./mcp-jsonrpc.js";
import { StudioMcpMux, type MuxChild } from "./studio-mcp-mux.js";

class FakeStudioChild extends EventEmitter implements MuxChild {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  pid: number | undefined = undefined;
  private readonly framer = new JsonRpcFramer();
  readonly calls: string[] = [];
  handleInitialize = true;
  replyWithContentLength = false;

  constructor(private readonly tools: Array<{ name: string; description?: string }>) {
    super();
    this.stdin.on("data", (chunk: Buffer) => {
      for (const msg of this.framer.push(chunk)) {
        this.handle(msg);
      }
    });
  }

  private writeReply(payload: unknown): void {
    const encode = this.replyWithContentLength
      ? encodeJsonRpcFrame
      : encodeJsonRpcNdjson;
    this.stdout.write(encode(payload));
  }

  on(
    event: "exit" | "error",
    listener: ((code: number | null, signal: NodeJS.Signals | null) => void) &
      ((err: Error) => void),
  ): this {
    super.on(event, listener);
    return this;
  }

  kill(): boolean {
    this.emit("exit", 0, null);
    return true;
  }

  private handle(msg: unknown): void {
    if (typeof msg !== "object" || msg === null) {
      return;
    }
    const row = msg as {
      id?: number;
      method?: string;
      params?: { name?: string };
    };
    if (!row.method) {
      return;
    }
    this.calls.push(row.method);
    if (row.method === "initialize" && row.id !== undefined) {
      if (!this.handleInitialize) {
        return;
      }
      this.writeReply({
        jsonrpc: "2.0",
        id: row.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "fake-studio", version: "test" },
        },
      });
      return;
    }
    if (row.method === "tools/list" && row.id !== undefined) {
      this.writeReply({
        jsonrpc: "2.0",
        id: row.id,
        result: { tools: this.tools },
      });
      return;
    }
    if (row.method === "tools/call" && row.id !== undefined) {
      this.writeReply({
        jsonrpc: "2.0",
        id: row.id,
        result: {
          content: [{ type: "text", text: `called:${row.params?.name ?? ""}` }],
        },
      });
    }
  }
}

describe("StudioMcpMux", () => {
  it("initializes, caches tools/list, and drops empty names", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mux-"));
    const cachePath = join(dir, "studio-tools-cache.json");
    const child = new FakeStudioChild([
      { name: "execute_luau" },
      { name: "" },
      { name: "search_game_tree" },
    ]);
    const mux = new StudioMcpMux({
      cachePath,
      spawnChild: () => child,
      reconnectDelayMs: 60_000,
      requestTimeoutMs: 2_000,
      initializeTimeoutMs: 2_000,
    });
    await mux.start();
    try {
      assert.equal(mux.getStatus().phase, "Connected");
      const names = mux.getCachedTools().map((t) => t.name);
      assert.deepEqual(names, ["execute_luau", "search_game_tree"]);
      assert.ok(mux.getCatalogGeneration() >= 1);
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
        tools: Array<{ name: string }>;
      };
      assert.deepEqual(
        cached.tools.map((t) => t.name),
        ["execute_luau", "search_game_tree"],
      );
      const result = await mux.callTool("execute_luau", { code: "print(1)" });
      assert.match(result.content[0]?.text ?? "", /called:execute_luau/);
    } finally {
      await mux.stop();
    }
  });

  it("initializes when the child replies with Content-Length frames", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mux-cl-"));
    const cachePath = join(dir, "studio-tools-cache.json");
    const child = new FakeStudioChild([{ name: "execute_luau" }]);
    child.replyWithContentLength = true;
    const mux = new StudioMcpMux({
      cachePath,
      spawnChild: () => child,
      reconnectDelayMs: 60_000,
      requestTimeoutMs: 2_000,
      initializeTimeoutMs: 2_000,
    });
    await mux.start();
    try {
      assert.equal(mux.getStatus().phase, "Connected");
      assert.deepEqual(mux.getCachedTools().map((t) => t.name), ["execute_luau"]);
    } finally {
      await mux.stop();
    }
  });

  it("serves a degraded disk cache when the child cannot start", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mux-deg-"));
    const cachePath = join(dir, "studio-tools-cache.json");
    await writeFile(
      cachePath,
      JSON.stringify({
        version: 1,
        generation: 4,
        updatedAt: new Date().toISOString(),
        tools: [{ name: "execute_luau" }, { name: "" }],
      }),
      "utf8",
    );
    const mux = new StudioMcpMux({
      cachePath,
      spawnChild: () =>
        ({
          stdin: null,
          stdout: null,
          stderr: null,
          kill: () => true,
          on() {
            return this;
          },
        }) as MuxChild,
      reconnectDelayMs: 60_000,
    });
    await mux.start();
    try {
      assert.equal(mux.isDegraded(), true);
      assert.equal(mux.getCatalogGeneration(), 4);
      assert.deepEqual(
        mux.getCachedTools().map((t) => t.name),
        ["execute_luau"],
      );
    } finally {
      await mux.stop();
    }
  });

  it("treats initialize timeout as NoStudio without throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mux-to-"));
    const cachePath = join(dir, "studio-tools-cache.json");
    const logs: string[] = [];
    const child = new FakeStudioChild([]);
    child.handleInitialize = false;
    const mux = new StudioMcpMux({
      cachePath,
      spawnChild: () => child,
      reconnectDelayMs: 60_000,
      maxReconnectDelayMs: 60_000,
      initializeTimeoutMs: 40,
      requestTimeoutMs: 40,
      log: (message) => {
        logs.push(message);
      },
    });
    await mux.start();
    try {
      assert.equal(mux.getStatus().phase, "NoStudio");
      assert.match(mux.getStatus().detail, /stdio handshake/i);
      assert.equal(
        logs.some((line) => /stdio handshake/i.test(line)),
        true,
      );
      assert.equal(
        logs.some((line) => /connect failed/i.test(line)),
        false,
      );
    } finally {
      await mux.stop();
    }
  });
});

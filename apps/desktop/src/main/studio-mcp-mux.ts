import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  JsonRpcStdioClient,
  type JsonRpcNotification,
} from "./mcp-jsonrpc.js";
import { dropEmptyToolNames, type McpToolDef, type McpToolResult } from "./mcp-tool-catalog.js";
import {
  resolveStudioMcpBinary,
  resolveStudioMcpLauncher,
} from "./studio-mcp-config.js";
import { killProcessTree } from "./process-tree.js";

export type StudioMuxPhase =
  | "Unavailable"
  | "NoStudio"
  | "Reconnecting"
  | "Connected";

export type StudioMuxStatus = {
  phase: StudioMuxPhase;
  detail: string;
  degraded: boolean;
  catalogGeneration: number;
  toolCount: number;
};

export type StudioToolClient = {
  getStatus(): StudioMuxStatus;
  getCachedTools(): McpToolDef[];
  isDegraded(): boolean;
  getCatalogGeneration(): number;
  reconnect(): Promise<void>;
  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult>;
};

export type MuxChild = {
  pid?: number | undefined;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill: (signal?: NodeJS.Signals) => boolean;
  on(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): MuxChild;
  on(event: "error", listener: (err: Error) => void): MuxChild;
};

export type StudioMcpMuxOptions = {
  cachePath: string;
  spawnChild?: () => MuxChild | null;
  requestTimeoutMs?: number;
  initializeTimeoutMs?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  log?: (message: string, err?: unknown) => void;
};

type CacheFile = {
  version: number;
  generation: number;
  updatedAt: string;
  tools: McpToolDef[];
};

function asToolList(value: unknown): McpToolDef[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const tools = (value as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return [];
  }
  const out: McpToolDef[] = [];
  for (const row of tools) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const rec = row as Record<string, unknown>;
    if (typeof rec.name !== "string") {
      continue;
    }
    const def: McpToolDef = { name: rec.name };
    if (typeof rec.description === "string") {
      def.description = rec.description;
    }
    if (typeof rec.inputSchema === "object" && rec.inputSchema !== null) {
      def.inputSchema = rec.inputSchema as Record<string, unknown>;
    }
    out.push(def);
  }
  return out;
}

function asToolResult(value: unknown): McpToolResult {
  if (typeof value !== "object" || value === null) {
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
  const rec = value as Record<string, unknown>;
  const contentRaw = rec.content;
  const content: McpToolResult["content"] = [];
  if (Array.isArray(contentRaw)) {
    for (const part of contentRaw) {
      if (typeof part !== "object" || part === null) {
        continue;
      }
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") {
        content.push({ type: "text", text: p.text });
      } else {
        content.push({ type: "text", text: JSON.stringify(part) });
      }
    }
  }
  if (content.length === 0) {
    content.push({ type: "text", text: JSON.stringify(value) });
  }
  return {
    content,
    isError: rec.isError === true,
  };
}

const STDIO_PREVIEW_BYTES = 500;

function previewStdio(buf: Buffer): string {
  const slice = buf.subarray(0, STDIO_PREVIEW_BYTES);
  if (slice.length === 0) {
    return "(empty)";
  }
  return JSON.stringify(slice.toString("utf8"));
}

function defaultSpawn(): MuxChild | null {
  const spawnOpts = {
    stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
    windowsHide: true,
  };
  const binary = resolveStudioMcpBinary();
  if (binary && existsSync(binary)) {
    return spawn(binary, [], spawnOpts);
  }
  const launcher = resolveStudioMcpLauncher();
  if (!launcher || !existsSync(launcher.path)) {
    return null;
  }
  if (launcher.kind === "bat") {
    return spawn("cmd.exe", ["/c", launcher.path], spawnOpts);
  }
  return spawn(launcher.path, launcher.args ?? [], spawnOpts);
}

function isHandshakeTimeout(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /JSON-RPC timeout/i.test(message) && /initialize/i.test(message);
}

/**
 * Isolated official Studio MCP child. A crash or tools/list hang must not
 * take down the Electron host.
 */
export class StudioMcpMux implements StudioToolClient {
  private child: MuxChild | null = null;
  private rpc: JsonRpcStdioClient | null = null;
  private phase: StudioMuxPhase = "Unavailable";
  private detail = "Studio MCP mux has not started";
  private degraded = false;
  private catalogGeneration = 0;
  private cachedTools: McpToolDef[] = [];
  private toolKey = "";
  private running = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private liveListSucceeded = false;
  private connectInFlight = false;
  private handshakeFailures = 0;
  private readonly requestTimeoutMs: number;
  private readonly initializeTimeoutMs: number;
  private readonly reconnectDelayMs: number;
  private readonly maxReconnectDelayMs: number;
  private readonly log: (message: string, err?: unknown) => void;

  constructor(private readonly options: StudioMcpMuxOptions) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60_000;
    this.initializeTimeoutMs = options.initializeTimeoutMs ?? 20_000;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 2_000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 60_000;
    this.log =
      options.log ??
      ((message, err) => {
        if (err !== undefined) {
          console.warn(`[blockforge] ${message}`, err);
        } else {
          console.info(`[blockforge] ${message}`);
        }
      });
  }

  getStatus(): StudioMuxStatus {
    return {
      phase: this.phase,
      detail: this.detail,
      degraded: this.degraded,
      catalogGeneration: this.catalogGeneration,
      toolCount: this.cachedTools.length,
    };
  }

  getCachedTools(): McpToolDef[] {
    return this.cachedTools;
  }

  isDegraded(): boolean {
    return this.degraded;
  }

  getCatalogGeneration(): number {
    return this.catalogGeneration;
  }

  async start(): Promise<void> {
    this.running = true;
    await this.loadCache();
    await this.connectOnce();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.clearTimers();
    this.rpc?.close("Studio MCP mux stopped");
    this.rpc = null;
    await this.killChild();
    this.phase = "Unavailable";
    this.detail = "Studio MCP mux stopped";
  }

  async reconnect(): Promise<void> {
    this.clearTimers();
    this.rpc?.close("Studio MCP mux reconnect");
    this.rpc = null;
    await this.killChild();
    this.phase = "Reconnecting";
    this.detail = "Respawning official Studio MCP";
    this.degraded = this.cachedTools.length > 0;
    if (this.running) {
      await this.connectOnce();
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    if (!this.rpc) {
      throw new Error(
        `Studio MCP mux is ${this.phase}: ${this.detail}. Cached catalog generation=${this.catalogGeneration}.`,
      );
    }
    const result = await this.rpc.request(
      "tools/call",
      { name, arguments: args },
      this.requestTimeoutMs,
    );
    return asToolResult(result);
  }

  private async connectOnce(): Promise<void> {
    if (!this.running || this.connectInFlight) {
      return;
    }
    this.connectInFlight = true;
    const preview = { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    try {
      const child = this.options.spawnChild?.() ?? defaultSpawn();
      if (!child?.stdin || !child.stdout) {
        this.markNotReady(
          "Studio MCP launcher not found. Install Studio and enable MCP in Assistant Settings. The app works without it (bridge + host tools).",
        );
        this.scheduleReconnect(this.maxReconnectDelayMs);
        return;
      }
      this.child = child;
      child.on("error", (err) => {
        this.log("Studio MCP child error", err);
        this.handleChildGone("child error");
      });
      child.on("exit", (code) => {
        this.handleChildGone(`child exit ${code ?? "?"}`);
      });
      child.stdout.on("data", (chunk: Buffer) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        preview.stdout = Buffer.concat([preview.stdout, buf]).subarray(
          0,
          STDIO_PREVIEW_BYTES,
        );
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        preview.stderr = Buffer.concat([preview.stderr, buf]).subarray(
          0,
          STDIO_PREVIEW_BYTES,
        );
        const text = buf.toString("utf8").trim();
        if (text) {
          this.log(`Studio MCP stderr: ${text.slice(0, 400)}`);
        }
      });

      this.rpc = new JsonRpcStdioClient(
        { stdin: child.stdin, stdout: child.stdout },
        {
          onNotification: (msg) => {
            this.handleNotification(msg);
          },
        },
      );

      await this.rpc.request(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "blockforge-studio-mux", version: "0.1.0" },
        },
        this.initializeTimeoutMs,
      );
      this.handshakeFailures = 0;
      this.rpc.notify("notifications/initialized", {});
      await this.refreshTools(true);
      this.schedulePoll();
    } catch (err) {
      const timeout = isHandshakeTimeout(err);
      if (timeout) {
        this.handshakeFailures += 1;
        this.log(
          `Studio MCP not ready yet (initialize timed out). StudioMCP did not complete MCP initialize (stdio handshake). stdout=${previewStdio(preview.stdout)} stderr=${previewStdio(preview.stderr)}. Blockforge keeps running.`,
        );
        this.markNotReady(
          "StudioMCP did not complete MCP initialize (stdio handshake). Host tools and the Studio bridge still work.",
        );
      } else {
        this.log("Studio MCP mux connect failed", err);
        this.phase = "Reconnecting";
        this.detail =
          err instanceof Error ? err.message : "Studio MCP connect failed";
        this.degraded = this.cachedTools.length > 0;
      }
      this.rpc?.close("connect failed");
      this.rpc = null;
      await this.killChild();
      this.scheduleReconnect(timeout ? this.backoffDelay() : this.reconnectDelayMs);
    } finally {
      this.connectInFlight = false;
    }
  }

  private markNotReady(detail: string): void {
    this.phase = "NoStudio";
    this.detail = detail;
    this.degraded = this.cachedTools.length > 0;
  }

  private backoffDelay(): number {
    const exp = Math.min(this.handshakeFailures, 5);
    return Math.min(this.maxReconnectDelayMs, 15_000 * 2 ** Math.max(0, exp - 1));
  }

  private handleNotification(msg: JsonRpcNotification): void {
    if (msg.method === "notifications/tools/list_changed") {
      void this.refreshTools(false);
    }
  }

  private async refreshTools(fromConnect: boolean): Promise<void> {
    if (!this.rpc) {
      return;
    }
    try {
      const listed = await this.rpc.request("tools/list", {}, this.requestTimeoutMs);
      const tools = dropEmptyToolNames(asToolList(listed));
      await this.applyTools(tools);
      this.handshakeFailures = 0;
      this.phase = "Connected";
      this.detail = `Official Studio MCP connected (${tools.length} tools)`;
      this.degraded = false;
      this.liveListSucceeded = true;
      if (fromConnect) {
        this.log(this.detail);
      }
    } catch (err) {
      this.log("Studio MCP tools/list failed", err);
      if (fromConnect) {
        this.degraded = this.cachedTools.length > 0;
        this.phase = this.cachedTools.length > 0 ? "Reconnecting" : "Unavailable";
        this.detail =
          err instanceof Error ? err.message : "tools/list failed";
      }
    }
  }

  private async applyTools(tools: McpToolDef[]): Promise<void> {
    const key = tools.map((t) => t.name).join("|");
    if (key === this.toolKey && this.cachedTools.length === tools.length) {
      this.cachedTools = tools;
      return;
    }
    this.toolKey = key;
    this.cachedTools = tools;
    this.catalogGeneration += 1;
    await this.writeCache();
  }

  private schedulePoll(): void {
    this.clearPoll();
    if (!this.running) {
      return;
    }
    const delay = this.liveListSucceeded ? 30_000 : 2_000;
    this.pollTimer = setTimeout(() => {
      void (async () => {
        await this.refreshTools(false);
        this.schedulePoll();
      })();
    }, delay);
    this.pollTimer.unref();
  }

  private scheduleReconnect(delayMs = this.reconnectDelayMs): void {
    if (!this.running || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.running) {
        void this.connectOnce();
      }
    }, delayMs);
    this.reconnectTimer.unref();
  }

  private handleChildGone(reason: string): void {
    if (!this.running) {
      return;
    }
    this.rpc?.close(reason);
    this.rpc = null;
    this.child = null;
    this.liveListSucceeded = false;
    if (this.connectInFlight) {
      return;
    }
    this.phase = "Reconnecting";
    this.detail = `Studio MCP ${reason}`;
    this.degraded = this.cachedTools.length > 0;
    this.scheduleReconnect();
  }

  private clearPoll(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearPoll();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async killChild(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child) {
      return;
    }
    const pid = child.pid;
    try {
      if (typeof pid === "number" && pid > 0) {
        await killProcessTree(pid);
      }
    } catch (err) {
      this.log("Studio MCP killProcessTree failed", err);
    }
    try {
      child.kill();
    } catch {
      // already dead
    }
  }

  private async loadCache(): Promise<void> {
    try {
      const raw = await readFile(this.options.cachePath, "utf8");
      const parsed = JSON.parse(raw) as CacheFile;
      if (!Array.isArray(parsed.tools)) {
        return;
      }
      const tools = dropEmptyToolNames(parsed.tools);
      this.cachedTools = tools;
      this.toolKey = tools.map((t) => t.name).join("|");
      this.catalogGeneration =
        typeof parsed.generation === "number" && parsed.generation > 0
          ? parsed.generation
          : tools.length > 0
            ? 1
            : 0;
      this.degraded = tools.length > 0;
      this.phase = tools.length > 0 ? "Reconnecting" : "Unavailable";
      this.detail = "Loaded Studio tool catalog from disk cache (degraded until live tools/list)";
    } catch {
      // no cache yet
    }
  }

  private async writeCache(): Promise<void> {
    const payload: CacheFile = {
      version: 1,
      generation: this.catalogGeneration,
      updatedAt: new Date().toISOString(),
      tools: this.cachedTools,
    };
    try {
      await mkdir(dirname(this.options.cachePath), { recursive: true });
      await writeFile(
        this.options.cachePath,
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
    } catch (err) {
      this.log("Failed to write Studio tools cache", err);
    }
  }
}

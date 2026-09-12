import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import { studioLocks } from "./studio-locks.js";
import { getOpenCloudSettings } from "./open-cloud-store.js";
import {
  StudioMcpMux,
  type StudioMuxStatus,
  type StudioToolClient,
} from "./studio-mcp-mux.js";
import {
  HOST_MCP_TOOLS,
  HOST_TOOL_NAMES,
  jsonResult,
  mergeMcpToolCatalogs,
  prependDiskSotReminder,
  requireDriveLease,
  shouldPrependDiskSotReminder,
  type McpToolDef,
  type McpToolResult,
} from "./mcp-tool-catalog.js";
import {
  dispatchHostTool,
  injectStudioId,
  type McpPtyController,
} from "./mcp-host-dispatch.js";
import { registerStudioMuxStatusGetter } from "./mcp-runtime.js";

export { getStudioMuxStatus } from "./mcp-runtime.js";

export const DEFAULT_BLOCKFORGE_MCP_PORT = 34874;

/** @deprecated Use HOST_MCP_TOOLS — kept so existing imports keep compiling. */
export const BLOCKFORGE_MCP_TOOLS = HOST_MCP_TOOLS;

let listeningPort = DEFAULT_BLOCKFORGE_MCP_PORT;
let getWindow: (() => BrowserWindow | null) | null = null;
let gatewayToken = randomBytes(24).toString("hex");
let mux: StudioMcpMux | null = null;
let ptyController: McpPtyController | null = null;
let httpServer: ReturnType<typeof createServer> | null = null;

const activeStudioByProject = new Map<string, string>();
let lastStudioId: string | undefined;

const studioStore = {
  get(projectPath: string): string | undefined {
    if (projectPath && activeStudioByProject.has(projectPath)) {
      return activeStudioByProject.get(projectPath);
    }
    return lastStudioId;
  },
  set(projectPath: string, studioId: string): void {
    lastStudioId = studioId;
    if (projectPath) {
      activeStudioByProject.set(projectPath, studioId);
    }
  },
  last(): string | undefined {
    return lastStudioId;
  },
};

export function getBlockforgeMcpUrl(): string {
  return `http://127.0.0.1:${listeningPort}`;
}

export function getBlockforgeMcpPort(): number {
  return listeningPort;
}

export function getBlockforgeMcpToken(): string {
  return gatewayToken;
}

export function setBlockforgeMcpPtyController(
  controller: McpPtyController | null,
): void {
  ptyController = controller;
}

function readAuthToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    const bearer = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (bearer?.[1]) {
      return bearer[1].trim();
    }
  }
  const alt = req.headers["x-blockforge-token"];
  if (typeof alt === "string" && alt.trim()) {
    return alt.trim();
  }
  return null;
}

function requireGatewayAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const token = readAuthToken(req);
  if (!token || token !== gatewayToken) {
    sendJson(res, 401, { error: "Unauthorized — set BLOCKFORGE_MCP_TOKEN" });
    return false;
  }
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function listMergedTools(): Promise<{
  tools: McpToolDef[];
  degraded: boolean;
  catalogGeneration: number;
  mux: StudioMuxStatus | null;
}> {
  let hasOpenCloudKey = false;
  try {
    const settings = await getOpenCloudSettings();
    hasOpenCloudKey = settings.hasApiKey === true;
  } catch (err) {
    console.warn("[blockforge] capability lookup failed", err);
  }
  const studioTools = mux?.getCachedTools() ?? [];
  const merged = mergeMcpToolCatalogs(HOST_MCP_TOOLS, studioTools, {
    hasOpenCloudKey,
  });
  const status = mux?.getStatus() ?? null;
  return {
    tools: merged.tools,
    degraded: status?.degraded === true,
    catalogGeneration: status?.catalogGeneration ?? 0,
    mux: status,
  };
}

async function callMergedTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const projectPath =
    typeof args.projectPath === "string" ? args.projectPath : "";
  const sessionId = typeof args.sessionId === "string" ? args.sessionId : "";
  const forwarded = injectStudioId(args, projectPath, studioStore);

  if (!mux) {
    const host = await dispatchHostTool(name, forwarded, {
      getWindow: () => getWindow?.() ?? null,
      mux: missingMuxClient(),
      locks: studioLocks,
      pty: ptyController,
      studios: studioStore,
    });
    if (host) {
      return host;
    }
    return jsonResult(
      {
        error: "Studio MCP mux is not running",
        code: "MUX_UNAVAILABLE",
      },
      true,
    );
  }

  if (HOST_TOOL_NAMES.has(name)) {
    const host = await dispatchHostTool(name, forwarded, {
      getWindow: () => getWindow?.() ?? null,
      mux,
      locks: studioLocks,
      pty: ptyController,
      studios: studioStore,
    });
    if (host) {
      return host;
    }
  }

  const leaseError = requireDriveLease(name, sessionId, studioLocks);
  if (leaseError) {
    return jsonResult({ error: leaseError, code: "STUDIO_LEASE_REQUIRED" }, true);
  }

  let result = await mux.callTool(name, forwarded);
  if (shouldPrependDiskSotReminder(name)) {
    result = prependDiskSotReminder(result);
  }
  return result;
}

function missingMuxClient(): StudioToolClient {
  return {
    getStatus: () => ({
      phase: "Unavailable",
      detail: "Mux not started",
      degraded: false,
      catalogGeneration: 0,
      toolCount: 0,
    }),
    getCachedTools: () => [],
    isDegraded: () => false,
    getCatalogGeneration: () => 0,
    reconnect: async () => undefined,
    callTool: async () => {
      throw new Error("Studio MCP mux is not running");
    },
  };
}

export function startBlockforgeMcpGateway(
  getMainWindow: () => BrowserWindow | null,
  preferredPort = DEFAULT_BLOCKFORGE_MCP_PORT,
  pty?: McpPtyController | null,
): void {
  getWindow = getMainWindow;
  ptyController = pty ?? ptyController;
  gatewayToken = randomBytes(24).toString("hex");

  let cachePath = join(".", "studio-tools-cache.json");
  try {
    cachePath = join(app.getPath("userData"), "studio-tools-cache.json");
  } catch {
    cachePath = join(process.cwd(), ".blockforge-studio-tools-cache.json");
  }

  mux = new StudioMcpMux({ cachePath });
  registerStudioMuxStatusGetter(() => mux?.getStatus() ?? null);
  void mux.start().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[blockforge] Studio MCP mux failed to start: ${message}`);
  });

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, {
          ok: true,
          port: listeningPort,
          mux: mux?.getStatus() ?? null,
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/tools") {
        if (!requireGatewayAuth(req, res)) return;
        const listed = await listMergedTools();
        sendJson(res, 200, listed);
        return;
      }
      if (req.method === "POST" && url.pathname === "/tools/call") {
        if (!requireGatewayAuth(req, res)) return;
        const raw = await readBody(req);
        let parsed: { name?: string; arguments?: Record<string, unknown> };
        try {
          parsed = JSON.parse(raw) as {
            name?: string;
            arguments?: Record<string, unknown>;
          };
        } catch {
          sendJson(res, 400, { error: "Invalid JSON" });
          return;
        }
        if (!parsed.name) {
          sendJson(res, 400, { error: "Missing tool name" });
          return;
        }
        try {
          const result = await callMergedTool(
            parsed.name,
            parsed.arguments ?? {},
          );
          sendJson(res, 200, result);
        } catch (err) {
          console.error("[blockforge] MCP tools/call failed", err);
          sendJson(res, 500, {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Something went wrong" }),
              },
            ],
          });
        }
        return;
      }
      sendJson(res, 404, { error: "Not found" });
    })().catch((err) => {
      console.error("[blockforge] MCP gateway request failed", err);
      sendJson(res, 500, { error: "Something went wrong" });
    });
  });

  httpServer = server;

  const tryListen = (port: number): void => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && port < preferredPort + 20) {
        console.warn(
          `[blockforge] MCP port ${port} is already in use (another Blockforge is probably still running). Binding ${port + 1} instead.`,
        );
        tryListen(port + 1);
      } else {
        console.error("[blockforge] MCP gateway failed to bind", err);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      listeningPort = port;
      console.info(`[blockforge] MCP gateway on http://127.0.0.1:${port}`);
    });
  };

  tryListen(preferredPort);
}

export async function stopBlockforgeMcpGateway(): Promise<void> {
  registerStudioMuxStatusGetter(null);
  await mux?.stop();
  mux = null;
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer?.close(() => resolve());
    });
    httpServer = null;
  }
}

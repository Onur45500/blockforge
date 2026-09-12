/**
 * Local HTTP bridge that receives Studio Play Output + World state from the
 * BlockforgeBridge plugin and writes:
 *   <project>/.blockforge/studio-output.jsonl
 *   <project>/.blockforge/studio-state.json
 *   <project>/.blockforge/studio-exports/*.model.json
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StudioSyncStatus } from "../shared/ipc-types.js";

export const STUDIO_BRIDGE_PORT = 34873;
/** Bridge snapshot older than this is treated as stale (Sync panel + playtest_check). */
export const STUDIO_STATE_STALE_MS = 20_000;
const LOG_MAX_BYTES = 1_000_000;
const STATE_STALE_MS = STUDIO_STATE_STALE_MS;

export type StudioLogEntry = {
  ts: string;
  level: string;
  message: string;
  source?: string;
  stack?: string;
  running?: boolean;
  isStudio?: boolean;
  backfill?: boolean;
};

export type StudioWorldChild = {
  name: string;
  className: string;
  position?: number[];
  anchored?: boolean;
  size?: number[];
};

export type StudioStateSnapshot = {
  ts: string;
  receivedAt: string;
  running: boolean;
  worldPresent: boolean;
  worldChildren: StudioWorldChild[];
  spawnLocations: Array<{
    name: string;
    position?: number[];
    enabled?: boolean;
  }>;
  serverScripts: string[];
  rojoTsPresent: boolean;
};

export type StudioBridgeStatus = {
  running: boolean;
  port: number | null;
  projectPath: string | null;
  lastClientAt: string | null;
  lastRuntimeError: string | null;
  connected: boolean;
  studioWorldPresent: boolean | null;
  studioSyncStatus: StudioSyncStatus;
  studioWorldNames: string[];
};

type BridgePayload = {
  entries?: unknown[];
  ts?: string;
  level?: string;
  message?: string;
  source?: string;
  stack?: string;
};

type StudioExport = {
  filename: string;
  content: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEntry(raw: unknown): StudioLogEntry | null {
  if (!isRecord(raw)) {
    return null;
  }
  const message = raw.message;
  if (typeof message !== "string") {
    return null;
  }
  const level = typeof raw.level === "string" ? raw.level : "info";
  const ts =
    typeof raw.ts === "string" && raw.ts.length > 0
      ? raw.ts
      : new Date().toISOString();
  const entry: StudioLogEntry = { ts, level, message };
  if (typeof raw.source === "string") {
    entry.source = raw.source;
  }
  if (typeof raw.stack === "string") {
    entry.stack = raw.stack;
  }
  if (typeof raw.running === "boolean") {
    entry.running = raw.running;
  }
  if (typeof raw.isStudio === "boolean") {
    entry.isStudio = raw.isStudio;
  }
  if (raw.backfill === true) {
    entry.backfill = true;
  }
  return entry;
}

function normalizeExports(raw: unknown): StudioExport[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.exports)) {
    return null;
  }
  const exports: StudioExport[] = [];
  for (const item of raw.exports) {
    if (
      !isRecord(item) ||
      typeof item.filename !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.model\.json$/.test(item.filename) ||
      !isRecord(item.content)
    ) {
      return null;
    }
    exports.push({ filename: item.filename, content: item.content });
  }
  return exports.length > 0 ? exports : null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 2_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

type WorldNode = {
  Name?: string;
  ClassName?: string;
  Children?: WorldNode[];
};

function collectDiskWorldNames(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  const n = node as WorldNode;
  if (typeof n.Name === "string" && n.Name.length > 0) {
    out.add(n.Name);
  }
  if (Array.isArray(n.Children)) {
    for (const child of n.Children) {
      collectDiskWorldNames(child, out);
    }
  }
}

export async function collectDiskWorldNamesFromProject(
  projectPath: string,
): Promise<Set<string>> {
  const names = new Set<string>();
  const worldDir = join(projectPath, "world");
  let entries;
  try {
    entries = await readdir(worldDir, { withFileTypes: true });
  } catch {
    return names;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".model.json")) continue;
    try {
      const raw = await readFile(join(worldDir, entry.name), "utf8");
      collectDiskWorldNames(JSON.parse(raw) as unknown, names);
    } catch {
      // skip
    }
  }
  return names;
}

export function computeStudioSyncStatus(options: {
  hasDiskWorldFiles: boolean;
  snapshot: StudioStateSnapshot | null;
  nowMs?: number;
}): StudioSyncStatus {
  const { hasDiskWorldFiles, snapshot } = options;
  const now = options.nowMs ?? Date.now();
  if (!snapshot) {
    return "unknown";
  }
  const age = now - Date.parse(snapshot.receivedAt);
  if (!Number.isFinite(age) || age > STATE_STALE_MS) {
    return "stale";
  }
  if (hasDiskWorldFiles && !snapshot.worldPresent) {
    return "world-missing";
  }
  if (snapshot.worldPresent) {
    return "in-sync";
  }
  return hasDiskWorldFiles ? "world-missing" : "unknown";
}

function normalizeStatePayload(raw: unknown): StudioStateSnapshot | null {
  if (!isRecord(raw)) {
    return null;
  }
  const worldPresent = raw.worldPresent === true;
  const worldChildren: StudioWorldChild[] = [];
  if (Array.isArray(raw.worldChildren)) {
    for (const item of raw.worldChildren) {
      if (!isRecord(item) || typeof item.name !== "string") continue;
      const child: StudioWorldChild = {
        name: item.name,
        className: typeof item.className === "string" ? item.className : "Instance",
      };
      if (Array.isArray(item.position) && item.position.every((n) => typeof n === "number")) {
        child.position = item.position as number[];
      }
      if (typeof item.anchored === "boolean") {
        child.anchored = item.anchored;
      }
      if (Array.isArray(item.size) && item.size.every((n) => typeof n === "number")) {
        child.size = item.size as number[];
      }
      worldChildren.push(child);
    }
  }
  const spawnLocations: StudioStateSnapshot["spawnLocations"] = [];
  if (Array.isArray(raw.spawnLocations)) {
    for (const item of raw.spawnLocations) {
      if (!isRecord(item) || typeof item.name !== "string") continue;
      const spawn: StudioStateSnapshot["spawnLocations"][number] = {
        name: item.name,
      };
      if (Array.isArray(item.position) && item.position.every((n) => typeof n === "number")) {
        spawn.position = item.position as number[];
      }
      if (typeof item.enabled === "boolean") {
        spawn.enabled = item.enabled;
      }
      spawnLocations.push(spawn);
    }
  }
  const serverScripts = Array.isArray(raw.serverScripts)
    ? raw.serverScripts.filter((s): s is string => typeof s === "string")
    : [];

  return {
    ts: typeof raw.ts === "string" ? raw.ts : new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    running: raw.running === true,
    worldPresent,
    worldChildren,
    spawnLocations,
    serverScripts,
    rojoTsPresent: raw.rojoTsPresent === true,
  };
}

export class StudioBridge {
  private server: Server | null = null;
  private projectPath: string | null = null;
  private lastClientAt: string | null = null;
  private lastRuntimeError: string | null = null;
  private lastSnapshot: StudioStateSnapshot | null = null;
  private diskWorldNames: string[] = [];
  private hasDiskWorldFiles = false;
  private boundPort: number | null = null;
  private readonly preferredPort: number;
  private statusListener: ((status: StudioBridgeStatus) => void) | null = null;

  constructor(options: { port?: number } = {}) {
    this.preferredPort = options.port ?? STUDIO_BRIDGE_PORT;
  }

  onStatusChanged(listener: (status: StudioBridgeStatus) => void): void {
    this.statusListener = listener;
  }

  getStatus(): StudioBridgeStatus {
    const recentlySeen =
      this.lastClientAt !== null &&
      Date.now() - Date.parse(this.lastClientAt) < 15_000;
    const studioSyncStatus = computeStudioSyncStatus({
      hasDiskWorldFiles: this.hasDiskWorldFiles,
      snapshot: this.lastSnapshot,
    });
    return {
      running: this.server !== null,
      port: this.boundPort,
      projectPath: this.projectPath,
      lastClientAt: this.lastClientAt,
      lastRuntimeError: this.lastRuntimeError,
      connected: recentlySeen,
      studioWorldPresent: this.lastSnapshot ? this.lastSnapshot.worldPresent : null,
      studioSyncStatus,
      studioWorldNames: this.lastSnapshot
        ? this.lastSnapshot.worldChildren.map((c) => c.name)
        : [],
    };
  }

  private emitStatus(): void {
    this.statusListener?.(this.getStatus());
  }

  private blockforgeDir(): string {
    if (!this.projectPath) {
      throw new Error("StudioBridge has no projectPath");
    }
    return join(this.projectPath, ".blockforge");
  }

  private logPath(): string {
    return join(this.blockforgeDir(), "studio-output.jsonl");
  }

  private statePath(): string {
    return join(this.blockforgeDir(), "studio-state.json");
  }

  private exportDir(): string {
    return join(this.blockforgeDir(), "studio-exports");
  }

  private async refreshDiskWorldMeta(): Promise<void> {
    if (!this.projectPath) {
      this.diskWorldNames = [];
      this.hasDiskWorldFiles = false;
      return;
    }
    const names = await collectDiskWorldNamesFromProject(this.projectPath);
    this.diskWorldNames = [...names];
    try {
      const entries = await readdir(join(this.projectPath, "world"), {
        withFileTypes: true,
      });
      this.hasDiskWorldFiles = entries.some(
        (e) => e.isFile() && e.name.endsWith(".model.json"),
      );
    } catch {
      this.hasDiskWorldFiles = false;
    }
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.blockforgeDir(), { recursive: true });
    await writeFile(
      join(this.blockforgeDir(), "bridge.json"),
      JSON.stringify(
        {
          port: this.boundPort ?? this.preferredPort,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    const sessionMark = join(this.blockforgeDir(), "session-start.json");
    try {
      await readFile(sessionMark, "utf8");
    } catch {
      await writeFile(
        sessionMark,
        JSON.stringify({ startedAt: new Date().toISOString() }, null, 2),
        "utf8",
      );
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    const path = this.logPath();
    try {
      const info = await stat(path);
      if (info.size < LOG_MAX_BYTES) {
        return;
      }
      const rotated = join(this.blockforgeDir(), "studio-output.prev.jsonl");
      await rename(path, rotated);
    } catch {
      // missing file is fine
    }
  }

  private async appendEntries(entries: StudioLogEntry[]): Promise<void> {
    if (entries.length === 0 || !this.projectPath) {
      return;
    }
    await this.ensureDirs();
    await this.rotateIfNeeded();
    const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    await appendFile(this.logPath(), lines, "utf8");

    for (const entry of entries) {
      const level = entry.level.toLowerCase();
      if (level === "error" || level === "messageerror") {
        this.lastRuntimeError = entry.message;
      }
    }
    this.lastClientAt = new Date().toISOString();
    this.emitStatus();
  }

  private async writeState(snapshot: StudioStateSnapshot): Promise<void> {
    await this.ensureDirs();
    await this.refreshDiskWorldMeta();
    this.lastSnapshot = snapshot;
    await writeFile(this.statePath(), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    this.lastClientAt = new Date().toISOString();
    this.emitStatus();
  }

  private async writeExports(exports: StudioExport[]): Promise<void> {
    await mkdir(this.exportDir(), { recursive: true });
    for (const studioExport of exports) {
      const path = join(this.exportDir(), studioExport.filename);
      const temporaryPath = `${path}.tmp`;
      await writeFile(
        temporaryPath,
        `${JSON.stringify(studioExport.content, null, 2)}\n`,
        "utf8",
      );
      await rename(temporaryPath, path);
    }
    this.lastClientAt = new Date().toISOString();
    this.emitStatus();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();

    if (method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (method === "GET" && (url === "/health" || url.startsWith("/health?"))) {
      sendJson(res, 200, {
        ok: true,
        projectPath: this.projectPath,
        port: this.boundPort ?? this.preferredPort,
      });
      this.lastClientAt = new Date().toISOString();
      this.emitStatus();
      return;
    }

    if (method === "POST" && (url === "/state" || url.startsWith("/state?"))) {
      if (!this.projectPath) {
        sendJson(res, 503, { ok: false, error: "no project open" });
        return;
      }
      let raw: string;
      try {
        raw = await readBody(req);
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        sendJson(res, 400, { ok: false, error: "invalid JSON" });
        return;
      }
      const snapshot = normalizeStatePayload(parsed);
      if (!snapshot) {
        sendJson(res, 400, { ok: false, error: "invalid state payload" });
        return;
      }
      await this.writeState(snapshot);
      sendJson(res, 200, {
        ok: true,
        syncStatus: this.getStatus().studioSyncStatus,
        diskWorldNames: this.diskWorldNames,
      });
      return;
    }

    if (method === "POST" && (url === "/export" || url.startsWith("/export?"))) {
      if (!this.projectPath) {
        sendJson(res, 503, { ok: false, error: "no project open" });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readBody(req)) as unknown;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : "invalid JSON",
        });
        return;
      }
      const exports = normalizeExports(parsed);
      if (!exports) {
        sendJson(res, 400, { ok: false, error: "invalid export payload" });
        return;
      }
      await this.writeExports(exports);
      sendJson(res, 200, {
        ok: true,
        accepted: exports.map((studioExport) => studioExport.filename),
      });
      return;
    }

    if (method === "POST" && (url === "/log" || url.startsWith("/log?"))) {
      if (!this.projectPath) {
        sendJson(res, 503, { ok: false, error: "no project open" });
        return;
      }
      let raw: string;
      try {
        raw = await readBody(req);
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        sendJson(res, 400, { ok: false, error: "invalid JSON" });
        return;
      }

      const entries: StudioLogEntry[] = [];
      if (isRecord(parsed) && Array.isArray((parsed as BridgePayload).entries)) {
        for (const item of (parsed as BridgePayload).entries ?? []) {
          const entry = normalizeEntry(item);
          if (entry) {
            entries.push(entry);
          }
        }
      } else {
        const entry = normalizeEntry(parsed);
        if (entry) {
          entries.push(entry);
        }
      }

      if (entries.length === 0) {
        sendJson(res, 400, { ok: false, error: "no entries" });
        return;
      }

      await this.appendEntries(entries);
      sendJson(res, 200, { ok: true, accepted: entries.length });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  }

  async start(projectPath: string): Promise<number> {
    await this.stop();
    this.projectPath = projectPath;
    this.lastRuntimeError = null;
    this.lastSnapshot = null;
    await this.ensureDirs();
    await this.refreshDiskWorldMeta();

    await new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => {
        void this.handleRequest(req, res).catch((err: unknown) => {
          sendJson(res, 500, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });

      server.once("error", (err) => {
        this.server = null;
        this.boundPort = null;
        reject(err);
      });

      server.listen(this.preferredPort, "127.0.0.1", () => {
        this.server = server;
        const address = server.address();
        this.boundPort =
          address && typeof address === "object" ? address.port : this.preferredPort;
        void this.ensureDirs().then(() => {
          this.emitStatus();
          resolve();
        });
      });
    });

    return this.boundPort ?? this.preferredPort;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.boundPort = null;
    this.projectPath = null;
    this.lastClientAt = null;
    this.lastSnapshot = null;
    this.diskWorldNames = [];
    this.hasDiskWorldFiles = false;
    if (!server) {
      this.emitStatus();
      return;
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    this.emitStatus();
  }
}

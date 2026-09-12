import { watch, type FSWatcher } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isAgentId, type AgentId } from "../shared/agent-adapter.js";
import type { PtyManager } from "./pty-manager.js";

export type AgentUiCommand = {
  op: "spawn-terminal" | "focus-terminal" | "close-terminal" | "pin-terminal";
  adapterId?: string;
  label?: string;
  role?: string;
  sessionId?: string;
  focus?: boolean;
  pinned?: boolean;
};

type WatchState = {
  watcher: FSWatcher;
  offset: number;
  processing: boolean;
};

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

function controlPath(projectPath: string): string {
  return join(projectPath, ".blockforge", "agent-ui-commands.jsonl");
}

function logPath(projectPath: string): string {
  return join(projectPath, ".blockforge", "agent-ui-commands.log");
}

function parseCommand(line: string): AgentUiCommand | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(trimmed);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    const obj = raw as Record<string, unknown>;
    const op = obj.op;
    if (
      op !== "spawn-terminal" &&
      op !== "focus-terminal" &&
      op !== "close-terminal" &&
      op !== "pin-terminal"
    ) {
      return null;
    }
    return {
      op,
      adapterId: typeof obj.adapterId === "string" ? obj.adapterId : undefined,
      label: typeof obj.label === "string" ? obj.label : undefined,
      role: typeof obj.role === "string" ? obj.role : undefined,
      sessionId: typeof obj.sessionId === "string" ? obj.sessionId : undefined,
      focus: typeof obj.focus === "boolean" ? obj.focus : undefined,
      pinned: typeof obj.pinned === "boolean" ? obj.pinned : undefined,
    };
  } catch {
    return null;
  }
}

async function appendLog(projectPath: string, message: string): Promise<void> {
  try {
    await appendFile(
      logPath(projectPath),
      `${new Date().toISOString()} ${message}\n`,
      "utf8",
    );
  } catch {
    // ignore
  }
}

/**
 * Watches `.blockforge/agent-ui-commands.jsonl` so the lead agent can spawn/focus/close UI terminals.
 */
export class PtyControlWatcher {
  private readonly watches = new Map<string, WatchState>();

  constructor(private readonly ptyManager: PtyManager) {}

  async watchProject(projectPath: string): Promise<void> {
    if (this.watches.has(projectPath)) {
      return;
    }
    const file = controlPath(projectPath);
    await mkdir(dirname(file), { recursive: true });
    try {
      await writeFile(file, "", { flag: "a" });
    } catch {
      // continue; read may still work later
    }

    let offset = 0;
    try {
      const existing = await readFile(file, "utf8");
      offset = Buffer.byteLength(existing, "utf8");
    } catch {
      offset = 0;
    }

    const state: WatchState = {
      watcher: watch(file, () => {
        void this.drain(projectPath);
      }),
      offset,
      processing: false,
    };
    this.watches.set(projectPath, state);
    await this.drain(projectPath);
  }

  unwatchProject(projectPath: string): void {
    const state = this.watches.get(projectPath);
    if (!state) {
      return;
    }
    state.watcher.close();
    this.watches.delete(projectPath);
  }

  unwatchAll(): void {
    for (const path of [...this.watches.keys()]) {
      this.unwatchProject(path);
    }
  }

  private async drain(projectPath: string): Promise<void> {
    const state = this.watches.get(projectPath);
    if (!state || state.processing) {
      return;
    }
    state.processing = true;
    try {
      const file = controlPath(projectPath);
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        return;
      }
      const buf = Buffer.from(content, "utf8");
      if (buf.length < state.offset) {
        state.offset = 0;
      }
      if (buf.length === state.offset) {
        return;
      }
      const chunk = buf.subarray(state.offset).toString("utf8");
      state.offset = buf.length;
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        const cmd = parseCommand(line);
        if (!cmd) {
          if (line.trim()) {
            await appendLog(projectPath, `ignored malformed: ${line.trim().slice(0, 120)}`);
          }
          continue;
        }
        await this.handleCommand(projectPath, cmd);
      }
    } finally {
      state.processing = false;
    }
  }

  private async handleCommand(
    projectPath: string,
    cmd: AgentUiCommand,
  ): Promise<void> {
    try {
      switch (cmd.op) {
        case "spawn-terminal": {
          const adapterId: AgentId = isAgentId(cmd.adapterId)
            ? cmd.adapterId
            : "claude-code";
          const { sessionId } = await this.ptyManager.start({
            projectPath,
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            adapterId,
            label: cmd.label,
            role: cmd.role ?? cmd.label,
            source: "agent",
            focus: cmd.focus === true,
            resume: false,
          });
          await appendLog(
            projectPath,
            `spawn-terminal ok sessionId=${sessionId} adapter=${adapterId} label=${cmd.label ?? ""}`,
          );
          break;
        }
        case "focus-terminal": {
          if (!cmd.sessionId) {
            await appendLog(projectPath, "focus-terminal missing sessionId");
            return;
          }
          this.ptyManager.requestFocus(cmd.sessionId);
          await appendLog(projectPath, `focus-terminal ok sessionId=${cmd.sessionId}`);
          break;
        }
        case "close-terminal": {
          if (!cmd.sessionId) {
            await appendLog(projectPath, "close-terminal missing sessionId");
            return;
          }
          await this.ptyManager.stop({ sessionId: cmd.sessionId });
          await appendLog(projectPath, `close-terminal ok sessionId=${cmd.sessionId}`);
          break;
        }
        case "pin-terminal": {
          if (!cmd.sessionId) {
            await appendLog(projectPath, "pin-terminal missing sessionId");
            return;
          }
          this.ptyManager.setPinned(cmd.sessionId, cmd.pinned !== false);
          await appendLog(
            projectPath,
            `pin-terminal ok sessionId=${cmd.sessionId} pinned=${cmd.pinned !== false}`,
          );
          break;
        }
        default:
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await appendLog(projectPath, `${cmd.op} error: ${message}`);
    }
  }
}

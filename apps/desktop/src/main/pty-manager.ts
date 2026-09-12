import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import * as pty from "node-pty";
import { IPC } from "../shared/ipc-types.js";
import type {
  PtyAdapterId,
  PtyDataEvent,
  PtyExitEvent,
  PtyResizeRequest,
  PtySessionInfo,
  PtySessionKind,
  PtySessionSource,
  PtySessionStatus,
  PtyStartRequest,
  PtyStatusChangedEvent,
  PtyStopRequest,
  PtyWriteRequest,
} from "../shared/ipc-types.js";
import { SHELL_ADAPTER_ID } from "../shared/ipc-types.js";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_AGENT_MODEL,
  findGitBash,
  getAgentAdapter,
  isAgentId,
  type AgentId,
} from "../shared/agent-adapter.js";
import { resolveCatalogPath } from "./asset-service.js";
import { getOpenCloudSettings } from "./open-cloud-store.js";
import {
  getPreferredResume,
  setPreferredResume,
} from "./agent-session-store.js";
import { killProcessTree } from "./process-tree.js";
import { studioLocks } from "./studio-locks.js";
import { getBlockforgeMcpUrl, getBlockforgeMcpToken } from "./blockforge-mcp-gateway.js";
import { resolveShellLaunch, shellEnv } from "./shell-launch.js";

type PtySession = {
  id: string;
  kind: PtySessionKind;
  adapterId: PtyAdapterId;
  projectPath: string;
  label?: string;
  role?: string;
  source: PtySessionSource;
  pinned: boolean;
  pid: number | null;
  startedAt: string;
  lastActivityAt: string;
  status: PtySessionStatus;
  exitCode?: number;
  pty: IPty | null;
};

function toInfo(session: PtySession): PtySessionInfo {
  return {
    sessionId: session.id,
    kind: session.kind,
    adapterId: session.adapterId,
    projectPath: session.projectPath,
    label: session.label,
    role: session.role,
    status: session.status,
    source: session.source,
    pinned: session.pinned,
    pid: session.pid,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    exitCode: session.exitCode,
  };
}

export class PtyManager {
  private readonly sessions = new Map<string, PtySession>();

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  listSessions(
    projectPath?: string,
    adapterId?: PtyAdapterId,
    kind?: PtySessionKind,
  ): PtySessionInfo[] {
    const out: PtySessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (projectPath && session.projectPath !== projectPath) {
        continue;
      }
      if (adapterId && session.adapterId !== adapterId) {
        continue;
      }
      if (kind && session.kind !== kind) {
        continue;
      }
      out.push(toInfo(session));
    }
    out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return out;
  }

  findSession(
    projectPath: string,
    adapterId: AgentId,
    label?: string,
  ): PtySessionInfo | null {
    const matches = this.listSessions(projectPath, adapterId);
    if (label !== undefined) {
      return matches.find((s) => s.label === label) ?? null;
    }
    return matches[0] ?? null;
  }

  getSession(sessionId: string): PtySessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session ? toInfo(session) : null;
  }

  setPinned(sessionId: string, pinned: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.pinned = pinned;
    this.emitStatus(session.projectPath);
    void this.writeTerminalsMirror(session.projectPath);
  }

  requestFocus(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    this.emitStatus(session.projectPath, sessionId);
  }

  async start(request: PtyStartRequest): Promise<{ sessionId: string }> {
    if (request.replaceSessionId) {
      await this.stop({ sessionId: request.replaceSessionId });
    }

    if (request.kind === "shell") {
      return this.startShell(request);
    }

    const adapterId: AgentId = isAgentId(request.adapterId)
      ? request.adapterId
      : DEFAULT_AGENT_ID;

    const adapter = getAgentAdapter(adapterId);
    let catalogPath: string | undefined;
    try {
      catalogPath = await resolveCatalogPath();
    } catch {
      catalogPath = undefined;
    }

    let model = DEFAULT_AGENT_MODEL;
    let runInWsl = false;
    let agentTeams = true;
    let preferStudioMcp = true;
    try {
      const settings = await getOpenCloudSettings();
      model = settings.agentModel ?? DEFAULT_AGENT_MODEL;
      runInWsl = settings.runInWsl === true;
      agentTeams = settings.agentTeams !== false;
      preferStudioMcp = settings.preferStudioMcp !== false;
    } catch {
      // keep defaults
    }

    const resume =
      request.resume ??
      (await getPreferredResume(request.projectPath, adapterId));

    await setPreferredResume(request.projectPath, adapterId, resume);

    const launch = await adapter.getLaunchCommand(request.projectPath, {
      resume,
      catalogPath,
      model,
      runInWsl,
      preferStudioMcp,
      agentTeams: adapterId === "claude-code" ? agentTeams : false,
    });

    let executable = launch.file;
    if (launch.file !== "wsl.exe" && process.platform === "win32") {
      const bash = await findGitBash();
      executable = bash ?? launch.file;
    }

    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const baseEnv = launch.env ?? (process.env as Record<string, string>);
    const env: Record<string, string> = {
      ...baseEnv,
      BLOCKFORGE_PROJECT_PATH: request.projectPath,
      BLOCKFORGE_SESSION_ID: sessionId,
      BLOCKFORGE_ADAPTER_ID: adapterId,
      BLOCKFORGE_AGENT_LABEL: request.label ?? request.role ?? adapterId,
      BLOCKFORGE_MCP_URL: getBlockforgeMcpUrl(),
      BLOCKFORGE_MCP_TOKEN: getBlockforgeMcpToken(),
    };

    const shell = pty.spawn(executable, launch.args, {
      name: "xterm-256color",
      cols: request.cols,
      rows: request.rows,
      cwd: launch.cwd,
      env,
    });

    const session: PtySession = {
      id: sessionId,
      kind: "agent",
      adapterId,
      projectPath: request.projectPath,
      label: request.label,
      role: request.role ?? request.label,
      source: request.source ?? "ui",
      pinned: false,
      pid: shell.pid,
      startedAt: now,
      lastActivityAt: now,
      status: "running",
      pty: shell,
    };
    this.sessions.set(sessionId, session);

    shell.onData((data) => {
      session.lastActivityAt = new Date().toISOString();
      if (session.status === "idle") {
        session.status = "running";
      }
      this.emitData({ sessionId, data });
    });

    shell.onExit(({ exitCode }) => {
      session.status = "exited";
      session.exitCode = exitCode;
      session.pid = null;
      session.pty = null;
      session.lastActivityAt = new Date().toISOString();
      void studioLocks.releaseAllForSession(sessionId);
      this.emitExit({ sessionId, exitCode });
      this.emitStatus(session.projectPath);
      void this.writeTerminalsMirror(session.projectPath);
    });

    this.emitStatus(
      request.projectPath,
      request.focus === true ? sessionId : undefined,
    );
    void this.writeTerminalsMirror(request.projectPath);

    return { sessionId };
  }

  private startShell(request: PtyStartRequest): { sessionId: string } {
    const launch = resolveShellLaunch(request.projectPath);
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const env = shellEnv(request.projectPath);

    const spawned = pty.spawn(launch.file, launch.args, {
      name: "xterm-256color",
      cols: request.cols,
      rows: request.rows,
      cwd: launch.cwd,
      env,
    });

    const session: PtySession = {
      id: sessionId,
      kind: "shell",
      adapterId: SHELL_ADAPTER_ID,
      projectPath: request.projectPath,
      label: request.label,
      role: request.role ?? request.label,
      source: request.source ?? "ui",
      pinned: false,
      pid: spawned.pid,
      startedAt: now,
      lastActivityAt: now,
      status: "running",
      pty: spawned,
    };
    this.sessions.set(sessionId, session);

    spawned.onData((data) => {
      session.lastActivityAt = new Date().toISOString();
      if (session.status === "idle") {
        session.status = "running";
      }
      this.emitData({ sessionId, data });
    });

    spawned.onExit(({ exitCode }) => {
      session.status = "exited";
      session.exitCode = exitCode;
      session.pid = null;
      session.pty = null;
      session.lastActivityAt = new Date().toISOString();
      void studioLocks.releaseAllForSession(sessionId);
      this.emitExit({ sessionId, exitCode });
      this.emitStatus(session.projectPath);
      void this.writeTerminalsMirror(session.projectPath);
    });

    this.emitStatus(
      request.projectPath,
      request.focus === true ? sessionId : undefined,
    );
    void this.writeTerminalsMirror(request.projectPath);

    return { sessionId };
  }

  write(request: PtyWriteRequest): void {
    const session = this.sessions.get(request.sessionId);
    if (!session?.pty) {
      return;
    }
    if (session.status === "paused") {
      return;
    }
    session.lastActivityAt = new Date().toISOString();
    session.pty.write(request.data);
  }

  resize(request: PtyResizeRequest): void {
    const session = this.sessions.get(request.sessionId);
    if (!session?.pty) {
      return;
    }
    session.pty.resize(request.cols, request.rows);
  }

  async stop(request: PtyStopRequest): Promise<void> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return;
    }
    const projectPath = session.projectPath;
    await studioLocks.releaseAllForSession(request.sessionId);
    if (session.pty && session.pid !== null) {
      await killProcessTree(session.pid);
      try {
        session.pty.kill();
      } catch {
        // already dead
      }
    }
    this.sessions.delete(request.sessionId);
    this.emitStatus(projectPath);
    void this.writeTerminalsMirror(projectPath);
  }

  pauseProject(projectPath: string): { paused: number } {
    let paused = 0;
    for (const session of this.sessions.values()) {
      if (session.projectPath !== projectPath) {
        continue;
      }
      if (session.status === "running" || session.status === "idle") {
        session.status = "paused";
        paused += 1;
      }
    }
    if (paused > 0) {
      this.emitStatus(projectPath);
      void this.writeTerminalsMirror(projectPath);
    }
    return { paused };
  }

  async stopAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    for (const id of ids) {
      await this.stop({ sessionId: id });
    }
  }

  async stopProject(projectPath: string): Promise<void> {
    const ids = [...this.sessions.values()]
      .filter((s) => s.projectPath === projectPath)
      .map((s) => s.id);
    for (const id of ids) {
      await this.stop({ sessionId: id });
    }
  }

  private emitData(event: PtyDataEvent): void {
    const win = this.getWindow();
    win?.webContents.send(IPC.PTY_DATA, event);
  }

  private emitExit(event: PtyExitEvent): void {
    const win = this.getWindow();
    win?.webContents.send(IPC.PTY_EXIT, event);
  }

  private emitStatus(projectPath: string, focusSessionId?: string): void {
    const win = this.getWindow();
    const payload: PtyStatusChangedEvent = {
      projectPath,
      sessions: this.listSessions(projectPath),
      focusSessionId,
    };
    win?.webContents.send(IPC.PTY_STATUS_CHANGED, payload);
  }

  private async writeTerminalsMirror(projectPath: string): Promise<void> {
    try {
      const dir = join(projectPath, ".blockforge");
      await mkdir(dir, { recursive: true });
      const payload = {
        updatedAt: new Date().toISOString(),
        sessions: this.listSessions(projectPath, undefined, "agent"),
      };
      await writeFile(
        join(dir, "terminals.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
    } catch {
      // disk mirror is best-effort
    }
  }
}

import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import { app } from "electron";
import type {
  OpenProjectState,
  OpenProjectsSnapshot,
  ProjectCreateProgressEvent,
  ProjectSummary,
  RojoSyncStatus,
} from "../shared/ipc-types.js";
import { slugify } from "../shared/slugify.js";
import { RojoSupervisor } from "./rojo-supervisor.js";
import { StudioBridge } from "./studio-bridge.js";
import { upgradeProjectTemplate } from "./template-upgrade.js";
import {
  detectStudioMcpLauncherInstalled,
  ensureProjectStudioMcpConfig,
} from "./studio-mcp-config.js";
import { getStudioMuxStatus } from "./mcp-runtime.js";
import { getBlockforgeMcpPort } from "./blockforge-mcp-gateway.js";

export { slugify } from "../shared/slugify.js";

type BlockforgeProjectMeta = {
  id: string;
  name: string;
  templateVersion: string;
  createdAt: string;
};

type OpenSlot = {
  state: NonNullable<OpenProjectState>;
  rojo: RojoSupervisor;
};

function projectsRoot(): string {
  return join(app.getPath("userData"), "projects");
}

function metaPath(projectDir: string): string {
  return join(projectDir, ".blockforge", "meta.json");
}

async function findRepoRoot(start: string): Promise<string | null> {
  let dir = start;
  while (dir !== join(dir, "..")) {
    try {
      await readFile(join(dir, "pnpm-workspace.yaml"), "utf8");
      return dir;
    } catch {
      dir = join(dir, "..");
    }
  }
  return null;
}

async function resolveTemplateDir(): Promise<string> {
  const repoRoot = await findRepoRoot(app.getAppPath());
  if (repoRoot) {
    return join(repoRoot, "packages", "project-template");
  }
  return join(process.resourcesPath, "project-template");
}

async function runCaptured(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const tail: string[] = [];
    const pushTail = (chunk: Buffer): void => {
      const lines = chunk.toString("utf8").split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        tail.push(line);
        if (tail.length > 40) {
          tail.shift();
        }
      }
    };
    child.stdout?.on("data", pushTail);
    child.stderr?.on("data", pushTail);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const recent = tail.slice(-20).join("\n");
      const base = `${command} ${args.join(" ")} failed with exit code ${String(code)}`;
      reject(new Error(recent ? `${base}\n${recent}` : base));
    });
  });
}

async function runNpmInstall(cwd: string): Promise<void> {
  await runCaptured("npm", ["install"], cwd);
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  await runCaptured(command, args, cwd);
}

async function initialProjectBuild(cwd: string): Promise<void> {
  await runCommand("npm", ["run", "typecheck"], cwd);
  await runCommand("node", ["./scripts/copy-include.mjs"], cwd);
}

async function readMeta(projectDir: string): Promise<BlockforgeProjectMeta | null> {
  try {
    const raw = await readFile(metaPath(projectDir), "utf8");
    return JSON.parse(raw) as BlockforgeProjectMeta;
  } catch {
    return null;
  }
}

export class ProjectManager {
  private readonly openSlots = new Map<string, OpenSlot>();
  private activeProjectId: string | null = null;
  private readonly studioBridge = new StudioBridge();
  private statusListener: ((status: RojoSyncStatus) => void) | null = null;
  private createProgressListener:
    | ((event: ProjectCreateProgressEvent) => void)
    | null = null;

  constructor() {
    this.studioBridge.onStatusChanged(() => {
      this.emitMergedStatus();
    });
    this.refreshMcpSnapshot();
  }

  onStatusChanged(listener: (status: RojoSyncStatus) => void): void {
    this.statusListener = listener;
  }

  onCreateProgress(
    listener: (event: ProjectCreateProgressEvent) => void,
  ): void {
    this.createProgressListener = listener;
  }

  private emitCreateProgress(event: ProjectCreateProgressEvent): void {
    this.createProgressListener?.(event);
  }

  private emitMergedStatus(): void {
    this.statusListener?.(this.getMergedStatus());
  }

  private activeSlot(): OpenSlot | null {
    if (!this.activeProjectId) {
      return null;
    }
    return this.openSlots.get(this.activeProjectId) ?? null;
  }

  getMergedStatus(): RojoSyncStatus {
    const slot = this.activeSlot();
    const rojo = slot?.rojo.getStatus() ?? {
      running: false,
      port: null,
      rbxtscRunning: false,
      rojoServeRunning: false,
      studioConnected: false,
      oneWaySyncWarning: true as const,
      lastError: null,
      compilerStatus: "idle" as const,
      compilerLog: null,
      studioBridgeRunning: false,
      studioBridgeConnected: false,
      lastRuntimeError: null,
      studioWorldPresent: null,
      studioSyncStatus: "unknown" as const,
      studioWorldNames: [],
      studioMcpLauncherFound: false,
      studioMcpConnected: false,
      studioMcpDetail: "Studio MCP status unknown",
      foreignRojoPort: false,
      foreignRojoDetail: null,
    };
    const bridge = this.studioBridge.getStatus();
    const mcpSnapshot = this.lastMcpSnapshot;
    const mux = getStudioMuxStatus();
    return {
      ...rojo,
      studioBridgeRunning: bridge.running,
      studioBridgeConnected: bridge.connected,
      lastRuntimeError: bridge.lastRuntimeError,
      studioWorldPresent: bridge.studioWorldPresent,
      studioSyncStatus: bridge.studioSyncStatus,
      studioWorldNames: bridge.studioWorldNames,
      studioMcpLauncherFound: mcpSnapshot.found,
      studioMcpConnected: mux?.phase === "Connected",
      studioMcpDetail: mux?.detail ?? mcpSnapshot.detail,
    };
  }

  private lastMcpSnapshot: { found: boolean; detail: string } = {
    found: false,
    detail: "Studio MCP: checking launcher…",
  };

  private refreshMcpSnapshot(): void {
    void detectStudioMcpLauncherInstalled().then((detected) => {
      this.lastMcpSnapshot = detected.installed
        ? {
            found: true,
            detail:
              "Studio MCP launcher found — enable in Assistant Settings + Quick Connect; prefer MCP playtest over bridge-only",
          }
        : {
            found: false,
            detail:
              "Studio MCP launcher missing — install/update Studio, or use Blockforge bridge as fallback",
          };
      this.emitMergedStatus();
    });
  }

  getRojoSupervisor(): RojoSupervisor | null {
    return this.activeSlot()?.rojo ?? null;
  }

  getStudioBridge(): StudioBridge {
    return this.studioBridge;
  }

  getOpenProject(): OpenProjectState {
    return this.activeSlot()?.state ?? null;
  }

  listOpenProjects(): OpenProjectsSnapshot {
    return {
      activeProjectId: this.activeProjectId,
      projects: [...this.openSlots.values()].map((s) => s.state),
    };
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const root = projectsRoot();
    await mkdir(root, { recursive: true });
    const entries = await readdir(root, { withFileTypes: true });
    const projects: ProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const projectDir = join(root, entry.name);
      const meta = await readMeta(projectDir);
      if (!meta) {
        continue;
      }
      projects.push({
        id: meta.id,
        name: meta.name,
        path: projectDir,
        templateVersion: meta.templateVersion,
        createdAt: meta.createdAt,
      });
    }

    return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createProject(name: string): Promise<ProjectSummary> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Project name is required");
    }

    const root = projectsRoot();
    await mkdir(root, { recursive: true });

    const id = `${slugify(trimmed)}-${Date.now().toString(36)}`;
    const projectDir = join(root, id);
    const templateDir = await resolveTemplateDir();

    this.emitCreateProgress({
      step: "copy",
      detail: "Copying template…",
    });
    await cp(templateDir, projectDir, {
      recursive: true,
      filter: (src) => !src.includes("node_modules"),
    });

    const templatePkgRaw = await readFile(join(templateDir, "package.json"), "utf8");
    const templatePkg = JSON.parse(templatePkgRaw) as {
      blockforge?: { templateVersion?: string };
    };
    const templateVersion =
      templatePkg.blockforge?.templateVersion ?? "0.1.0";

    await writeFile(
      join(projectDir, "blockforge.json"),
      JSON.stringify({ templateVersion }, null, 2),
      "utf8",
    );

    const meta: BlockforgeProjectMeta = {
      id,
      name: trimmed,
      templateVersion,
      createdAt: new Date().toISOString(),
    };
    await mkdir(join(projectDir, ".blockforge"), { recursive: true });
    await writeFile(metaPath(projectDir), JSON.stringify(meta, null, 2), "utf8");

    this.emitCreateProgress({
      step: "npm-install",
      detail: "Installing npm dependencies…",
    });
    await runNpmInstall(projectDir);

    this.emitCreateProgress({
      step: "typecheck",
      detail: "Typechecking template…",
    });
    await initialProjectBuild(projectDir);
    try {
      await ensureProjectStudioMcpConfig(projectDir, process.platform, process.env, getBlockforgeMcpPort());
    } catch (err) {
      console.error("[blockforge] studio MCP config write failed:", err);
    }

    this.emitCreateProgress({
      step: "done",
      detail: "Project ready",
    });

    return {
      id: meta.id,
      name: meta.name,
      path: projectDir,
      templateVersion: meta.templateVersion,
      createdAt: meta.createdAt,
    };
  }

  async openProject(id: string): Promise<OpenProjectState> {
    const existing = this.openSlots.get(id);
    if (existing) {
      this.activeProjectId = id;
      await this.reattachStudioBridge(existing.state.project.path);
      this.emitMergedStatus();
      return existing.state;
    }

    const root = projectsRoot();
    const projectDir = join(root, id);
    const meta = await readMeta(projectDir);
    if (!meta) {
      throw new Error(`Project not found: ${basename(projectDir)}`);
    }

    const templateDir = await resolveTemplateDir();
    let templateUpgrade;
    try {
      templateUpgrade = await upgradeProjectTemplate(projectDir, templateDir);
    } catch (err) {
      console.error("[blockforge] template upgrade failed:", err);
      templateUpgrade = {
        upgraded: false,
        from: meta.templateVersion,
        to: meta.templateVersion,
        skipped: [err instanceof Error ? err.message : String(err)],
      };
    }

    const metaAfter = (await readMeta(projectDir)) ?? meta;
    try {
      await ensureProjectStudioMcpConfig(projectDir, process.platform, process.env, getBlockforgeMcpPort());
    } catch (err) {
      console.error("[blockforge] studio MCP config write failed:", err);
    }
    this.refreshMcpSnapshot();
    const rojo = new RojoSupervisor();
    rojo.onStatusChanged(() => this.emitMergedStatus());
    const port = await rojo.start(projectDir);

    const state: NonNullable<OpenProjectState> = {
      project: {
        id: metaAfter.id,
        name: metaAfter.name,
        path: projectDir,
        templateVersion: metaAfter.templateVersion,
        createdAt: metaAfter.createdAt,
      },
      rojoPort: port,
      templateUpgrade,
    };

    this.openSlots.set(id, { state, rojo });
    this.activeProjectId = id;
    await this.reattachStudioBridge(projectDir);
    this.emitMergedStatus();
    return state;
  }

  async switchProject(id: string): Promise<OpenProjectState> {
    return this.openProject(id);
  }

  /**
   * Bridge follows the *active* project only (single port 34873).
   * Switching projects reattaches; inactive open projects do not get concurrent bridges.
   */
  private async reattachStudioBridge(projectPath: string): Promise<void> {
    try {
      await this.studioBridge.stop();
      await this.studioBridge.start(projectPath);
    } catch (err) {
      console.error("[blockforge] studio bridge failed to start:", err);
    }
  }

  /** Close the active project only (keeps other open sessions). */
  async closeProject(): Promise<void> {
    const id = this.activeProjectId;
    if (!id) {
      await this.studioBridge.stop();
      return;
    }
    const slot = this.openSlots.get(id);
    if (slot) {
      await slot.rojo.stop();
      this.openSlots.delete(id);
    }
    const remaining = [...this.openSlots.keys()];
    this.activeProjectId = remaining[0] ?? null;
    if (this.activeProjectId) {
      const next = this.openSlots.get(this.activeProjectId);
      if (next) {
        await this.reattachStudioBridge(next.state.project.path);
      }
    } else {
      await this.studioBridge.stop();
    }
    this.emitMergedStatus();
  }

  async closeAllProjects(): Promise<void> {
    for (const [id, slot] of this.openSlots) {
      await slot.rojo.stop();
      this.openSlots.delete(id);
    }
    this.activeProjectId = null;
    await this.studioBridge.stop();
    this.emitMergedStatus();
  }

  async stopRojo(): Promise<OpenProjectState> {
    const slot = this.activeSlot();
    if (!slot) {
      throw new Error("No project open");
    }
    await slot.rojo.stop();
    slot.state = { ...slot.state, rojoPort: 0 };
    this.emitMergedStatus();
    return slot.state;
  }

  async startRojo(): Promise<OpenProjectState> {
    const slot = this.activeSlot();
    if (!slot) {
      throw new Error("No project open");
    }
    const port = await slot.rojo.start(slot.state.project.path);
    try {
      if (!this.studioBridge.getStatus().running) {
        await this.studioBridge.start(slot.state.project.path);
      }
    } catch (err) {
      console.error("[blockforge] studio bridge failed to start:", err);
    }
    slot.state = { ...slot.state, rojoPort: port };
    this.emitMergedStatus();
    return slot.state;
  }

  async restartRojo(): Promise<OpenProjectState> {
    return this.startRojo();
  }
}

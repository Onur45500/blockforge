import { createWriteStream } from "node:fs";
import { mkdir, access, writeFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:net";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { app } from "electron";
import type { RojoSyncStatus } from "../shared/ipc-types.js";
import {
  applyCompilerChunk,
  compilerErrorSummary,
  stripAnsi,
  type CompilerWatchState,
} from "./compiler-output.js";
import { killProcessTree, unixProcessGroupSpawnOptions } from "./process-tree.js";
import {
  findListeningPids,
  getProcessCommandLine,
  getProcessImageName,
  isReclaimableRojoListener,
} from "./listen-port.js";

/** Must match the Studio Rojo plugin default Connect port. */
export const DEFAULT_ROJO_PORT = 34872;

const execFileAsync = promisify(execFile);

/** Must match the Studio Rojo plugin (Creator Store / Plugin Manager). */
const ROJO_VERSION = "7.7.0";
const ROJO_RELEASE_BASE = `https://github.com/rojo-rbx/rojo/releases/download/v${ROJO_VERSION}`;

type ManagedProcess = {
  name: string;
  child: ChildProcessWithoutNullStreams;
  pid: number;
};

export class RojoSupervisor {
  private port: number | null = null;
  private processes: ManagedProcess[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private studioConnected = false;
  private lastError: string | null = null;
  private compiler: CompilerWatchState = { status: "idle", log: null };
  private foreignRojoPort = false;
  private foreignRojoDetail: string | null = null;
  private statusListener: ((status: RojoSyncStatus) => void) | null = null;

  onStatusChanged(listener: (status: RojoSyncStatus) => void): void {
    this.statusListener = listener;
  }

  getStatus(): RojoSyncStatus {
    return {
      running: this.processes.length > 0,
      port: this.port,
      rbxtscRunning: this.processes.some((p) => p.name === "rbxtsc"),
      rojoServeRunning: this.processes.some((p) => p.name === "rojo"),
      studioConnected: this.studioConnected,
      oneWaySyncWarning: true,
      lastError: this.lastError,
      compilerStatus: this.compiler.status,
      compilerLog: this.compiler.log,
      studioBridgeRunning: false,
      studioBridgeConnected: false,
      lastRuntimeError: null,
      studioWorldPresent: null,
      studioSyncStatus: "unknown",
      studioWorldNames: [],
      studioMcpLauncherFound: false,
      studioMcpConnected: false,
      studioMcpDetail: "Studio MCP status unknown",
      foreignRojoPort: this.foreignRojoPort,
      foreignRojoDetail: this.foreignRojoDetail,
    };
  }

  private emitStatus(): void {
    this.statusListener?.(this.getStatus());
  }

  private binDir(): string {
    return join(app.getPath("userData"), "bin");
  }

  private rojoExePath(): string {
    return join(this.binDir(), process.platform === "win32" ? "rojo.exe" : "rojo");
  }

  private versionMarkerPath(): string {
    return join(this.binDir(), "rojo-version.txt");
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async download(url: string, dest: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status}): ${url}`);
    }
    await mkdir(join(dest, ".."), { recursive: true });
    const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(nodeStream, createWriteStream(dest));
  }

  private async readInstalledVersion(): Promise<string | null> {
    try {
      const marker = (await readFile(this.versionMarkerPath(), "utf8")).trim();
      if (marker) {
        return marker;
      }
    } catch {
      // fall through to --version
    }
    const exe = this.rojoExePath();
    if (!(await this.fileExists(exe))) {
      return null;
    }
    try {
      const { stdout } = await execFileAsync(exe, ["--version"], { windowsHide: true });
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  private async installRojoBinary(): Promise<string> {
    const exe = this.rojoExePath();
    await mkdir(this.binDir(), { recursive: true });

    const platform =
      process.platform === "win32"
        ? "windows-x86_64"
        : process.platform === "darwin"
          ? process.arch === "arm64"
            ? "macos-aarch64"
            : "macos-x86_64"
          : "linux-x86_64";
    const archiveName = `rojo-${ROJO_VERSION}-${platform}.zip`;
    const zipPath = join(this.binDir(), archiveName);

    await this.download(`${ROJO_RELEASE_BASE}/${archiveName}`, zipPath);

    if (process.platform === "win32") {
      await execFileAsync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${this.binDir().replace(/'/g, "''")}' -Force`,
        ],
        { windowsHide: true },
      );
    } else {
      await execFileAsync("unzip", ["-o", zipPath, "-d", this.binDir()], {
        windowsHide: true,
      });
    }

    if (!(await this.fileExists(exe))) {
      throw new Error(`Rojo binary not found after extract: ${exe}`);
    }

    await writeFile(this.versionMarkerPath(), `${ROJO_VERSION}\n`, "utf8");
    return exe;
  }

  private async ensureRojoBinary(): Promise<string> {
    const exe = this.rojoExePath();
    const installed = await this.readInstalledVersion();
    if (!(await this.fileExists(exe)) || installed !== ROJO_VERSION) {
      await this.installRojoBinary();
    }
    return exe;
  }

  /** Never use bare `npx rbxtsc` — npm has a decoy package named rbxtsc. */
  private async resolveLocalRbxtsc(projectPath: string): Promise<string> {
    const candidates =
      process.platform === "win32"
        ? [
            join(projectPath, "node_modules", ".bin", "rbxtsc.cmd"),
            join(projectPath, "node_modules", "roblox-ts", "bin", "rbxtsc.js"),
          ]
        : [
            join(projectPath, "node_modules", ".bin", "rbxtsc"),
            join(projectPath, "node_modules", "roblox-ts", "bin", "rbxtsc.js"),
          ];

    for (const candidate of candidates) {
      if (await this.fileExists(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      "rbxtsc not found in project node_modules. Run npm install in the project (roblox-ts provides rbxtsc — do not use the npm package named rbxtsc).",
    );
  }

  private async ensureProjectToolchain(projectPath: string): Promise<string> {
    try {
      return await this.resolveLocalRbxtsc(projectPath);
    } catch {
      await new Promise<void>((resolve, reject) => {
        const child = spawn("npm", ["install"], {
          cwd: projectPath,
          shell: true,
          windowsHide: true,
          stdio: "ignore",
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`npm install failed with exit code ${String(code)}`));
          }
        });
      });
      return this.resolveLocalRbxtsc(projectPath);
    }
  }

  private tryListen(port: number): Promise<number | null> {
    return new Promise((resolve) => {
      const server: Server = createServer();
      server.once("error", () => {
        resolve(null);
      });
      server.listen(port, "127.0.0.1", () => {
        server.close((err) => {
          resolve(err ? null : port);
        });
      });
    });
  }

  private async reclaimDefaultRojoPort(): Promise<boolean> {
    const exePath = this.rojoExePath();
    const pids = await findListeningPids(DEFAULT_ROJO_PORT);
    let killed = false;
    for (const pid of pids) {
      if (this.processes.some((proc) => proc.pid === pid)) {
        continue;
      }
      const [commandLine, imageName] = await Promise.all([
        getProcessCommandLine(pid),
        getProcessImageName(pid),
      ]);
      if (
        !isReclaimableRojoListener({
          commandLine,
          imageName,
          exePath,
        })
      ) {
        continue;
      }
      await killProcessTree(pid);
      killed = true;
      console.info(
        `[blockforge] Reclaimed Rojo port ${DEFAULT_ROJO_PORT} from leftover pid ${pid}`,
      );
    }
    return killed;
  }

  private async allocatePort(): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const preferred = await this.tryListen(DEFAULT_ROJO_PORT);
      if (preferred !== null) {
        this.foreignRojoPort = false;
        this.foreignRojoDetail = null;
        return preferred;
      }
      const reclaimed = await this.reclaimDefaultRojoPort();
      if (!reclaimed) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    this.foreignRojoPort = true;
    this.foreignRojoDetail = `Port ${DEFAULT_ROJO_PORT} is in use by another process. Stop it so Blockforge can use the Studio Rojo plugin default (${DEFAULT_ROJO_PORT}).`;
    this.lastError = this.foreignRojoDetail;
    this.emitStatus();
    throw new Error(this.foreignRojoDetail);
  }

  private spawnManaged(
    name: string,
    command: string,
    args: string[],
    cwd: string,
  ): ManagedProcess {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: "pipe",
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      ...unixProcessGroupSpawnOptions(),
    });

    child.stdout.on("data", (chunk: Buffer) => {
      this.ingestChildOutput(name, chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      this.ingestChildOutput(name, chunk);
    });

    child.on("exit", (code, signal) => {
      this.processes = this.processes.filter((p) => p.pid !== child.pid);
      if (name === "rbxtsc" && code !== 0 && code !== null) {
        this.compiler = {
          status: "error",
          log: this.compiler.log,
        };
        this.lastError = `rbxtsc exited with code ${String(code)}${signal ? ` (${signal})` : ""}. Fix TypeScript errors so watch can stay running.`;
      }
      this.emitStatus();
    });

    const managed: ManagedProcess = {
      name,
      child,
      pid: child.pid ?? -1,
    };
    this.processes.push(managed);
    return managed;
  }

  private ingestChildOutput(name: string, chunk: Buffer): void {
    const text = stripAnsi(chunk.toString("utf8")).trim();
    if (!text) {
      return;
    }
    if (name === "rbxtsc") {
      this.compiler = applyCompilerChunk(this.compiler, text);
      this.lastError =
        this.compiler.status === "error"
          ? compilerErrorSummary(this.compiler.log)
          : null;
      this.emitStatus();
      return;
    }
    if (/error TS\d+/i.test(text) || /panic|fatal/i.test(text)) {
      this.lastError = text;
      this.emitStatus();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.pollStudioConnection();
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollStudioConnection(): Promise<void> {
    if (!this.port) {
      this.studioConnected = false;
      this.emitStatus();
      return;
    }

    try {
      // Rojo 7.7+ returns MessagePack (application/msgpack), not JSON.
      const response = await fetch(`http://127.0.0.1:${this.port}/api/rojo`, {
        signal: AbortSignal.timeout(2000),
      });
      this.studioConnected = response.ok;
    } catch {
      this.studioConnected = false;
    }
    this.emitStatus();
  }

  async start(projectPath: string): Promise<number> {
    await this.stop();
    this.lastError = null;
    this.compiler = { status: "idle", log: null };

    await new Promise<void>((resolve) => {
      const child = spawn("node", ["./scripts/copy-include.mjs"], {
        cwd: projectPath,
        shell: true,
        windowsHide: true,
        stdio: "ignore",
      });
      child.on("close", () => resolve());
      child.on("error", () => resolve());
    });

    const rbxtscBin = await this.ensureProjectToolchain(projectPath);
    const rojoExe = await this.ensureRojoBinary();
    const port = await this.allocatePort();
    this.port = port;

    // Prefer local roblox-ts binary. On Windows .cmd needs shell; .js runs via node.
    if (rbxtscBin.endsWith(".js")) {
      this.spawnManaged("rbxtsc", "node", [rbxtscBin, "-w"], projectPath);
    } else {
      this.spawnManaged("rbxtsc", rbxtscBin, ["-w"], projectPath);
    }
    this.spawnManaged("rojo", rojoExe, ["serve", "--port", String(port)], projectPath);

    this.startPolling();
    this.emitStatus();
    return port;
  }

  async stop(): Promise<void> {
    this.stopPolling();
    const toKill = [...this.processes];
    this.processes = [];
    for (const proc of toKill) {
      if (proc.pid > 0) {
        await killProcessTree(proc.pid);
      }
      try {
        proc.child.kill();
      } catch {
        // ignore
      }
    }
    this.port = null;
    this.studioConnected = false;
    this.emitStatus();
  }
}

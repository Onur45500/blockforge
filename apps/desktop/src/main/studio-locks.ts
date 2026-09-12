import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type StudioLockStatus = {
  studioHolderSessionId: string | null;
  studioHolderProjectPath: string | null;
  playtestHolderSessionId: string | null;
  playtestHolderProjectPath: string | null;
  updatedAt: string;
};

type Waiter = {
  sessionId: string;
  projectPath: string;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type StudioHolder = {
  sessionId: string;
  projectPath: string;
  renewedAt: string;
};

/**
 * Exclusive Studio drive lock + global playtest mutex (one measurement at a time).
 */
export class StudioLockManager {
  private studioHolder: StudioHolder | null = null;
  private playtestHolder: { sessionId: string; projectPath: string } | null =
    null;
  private readonly studioQueue: Waiter[] = [];
  private readonly playtestQueue: Waiter[] = [];
  private statusListener: ((status: StudioLockStatus) => void) | null = null;

  onStatusChanged(listener: (status: StudioLockStatus) => void): void {
    this.statusListener = listener;
  }

  getStatus(): StudioLockStatus {
    return {
      studioHolderSessionId: this.studioHolder?.sessionId ?? null,
      studioHolderProjectPath: this.studioHolder?.projectPath ?? null,
      playtestHolderSessionId: this.playtestHolder?.sessionId ?? null,
      playtestHolderProjectPath: this.playtestHolder?.projectPath ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  isPlaytestHeld(): boolean {
    return this.playtestHolder !== null;
  }

  holdsStudioTurn(sessionId: string): boolean {
    return this.studioHolder?.sessionId === sessionId;
  }

  /** Bump the lease timestamp while the holder keeps succeeding at drive calls. */
  renewStudioTurn(sessionId: string): boolean {
    if (this.studioHolder?.sessionId !== sessionId) {
      return false;
    }
    this.studioHolder.renewedAt = new Date().toISOString();
    return true;
  }

  async waitForStudioTurn(args: {
    sessionId: string;
    projectPath: string;
    timeoutMs?: number;
  }): Promise<StudioLockStatus> {
    const timeoutMs = args.timeoutMs ?? 120_000;
    if (
      this.studioHolder?.sessionId === args.sessionId &&
      this.studioHolder.projectPath === args.projectPath
    ) {
      this.renewStudioTurn(args.sessionId);
      return this.getStatus();
    }
    if (!this.studioHolder) {
      this.studioHolder = {
        sessionId: args.sessionId,
        projectPath: args.projectPath,
        renewedAt: new Date().toISOString(),
      };
      await this.emitAndMirror(args.projectPath);
      return this.getStatus();
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.studioQueue.findIndex(
          (w) => w.sessionId === args.sessionId,
        );
        if (idx >= 0) {
          this.studioQueue.splice(idx, 1);
        }
        reject(
          new Error(
            `Timed out waiting for Studio turn (held by ${this.studioHolder?.sessionId ?? "unknown"})`,
          ),
        );
      }, timeoutMs);
      this.studioQueue.push({
        sessionId: args.sessionId,
        projectPath: args.projectPath,
        resolve,
        reject,
        timer,
      });
    });

    return this.getStatus();
  }

  async releaseStudio(sessionId: string): Promise<StudioLockStatus> {
    if (this.studioHolder?.sessionId !== sessionId) {
      return this.getStatus();
    }
    const projectPath = this.studioHolder.projectPath;
    this.studioHolder = null;
    const next = this.studioQueue.shift();
    if (next) {
      clearTimeout(next.timer);
      this.studioHolder = {
        sessionId: next.sessionId,
        projectPath: next.projectPath,
        renewedAt: new Date().toISOString(),
      };
      next.resolve();
      await this.emitAndMirror(next.projectPath);
    } else {
      await this.emitAndMirror(projectPath);
    }
    return this.getStatus();
  }

  async acquirePlaytest(args: {
    sessionId: string;
    projectPath: string;
    timeoutMs?: number;
  }): Promise<StudioLockStatus> {
    const timeoutMs = args.timeoutMs ?? 180_000;
    if (this.playtestHolder?.sessionId === args.sessionId) {
      return this.getStatus();
    }
    if (!this.playtestHolder) {
      this.playtestHolder = {
        sessionId: args.sessionId,
        projectPath: args.projectPath,
      };
      await this.emitAndMirror(args.projectPath);
      return this.getStatus();
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.playtestQueue.findIndex(
          (w) => w.sessionId === args.sessionId,
        );
        if (idx >= 0) {
          this.playtestQueue.splice(idx, 1);
        }
        reject(
          new Error(
            `Timed out waiting for playtest lock (held by ${this.playtestHolder?.sessionId ?? "unknown"}). Only one playtest measurement at a time.`,
          ),
        );
      }, timeoutMs);
      this.playtestQueue.push({
        sessionId: args.sessionId,
        projectPath: args.projectPath,
        resolve,
        reject,
        timer,
      });
    });

    return this.getStatus();
  }

  async releasePlaytest(sessionId: string): Promise<StudioLockStatus> {
    if (this.playtestHolder?.sessionId !== sessionId) {
      return this.getStatus();
    }
    const projectPath = this.playtestHolder.projectPath;
    this.playtestHolder = null;
    const next = this.playtestQueue.shift();
    if (next) {
      clearTimeout(next.timer);
      this.playtestHolder = {
        sessionId: next.sessionId,
        projectPath: next.projectPath,
      };
      next.resolve();
      await this.emitAndMirror(next.projectPath);
    } else {
      await this.emitAndMirror(projectPath);
    }
    return this.getStatus();
  }

  /** Release any locks held by a PTY session (exit / stop). */
  async releaseAllForSession(sessionId: string): Promise<void> {
    await this.releasePlaytest(sessionId);
    await this.releaseStudio(sessionId);
  }

  private async emitAndMirror(projectPath: string): Promise<void> {
    const status = this.getStatus();
    this.statusListener?.(status);
    try {
      const dir = join(projectPath, ".blockforge");
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "studio-locks.json"),
        `${JSON.stringify(status, null, 2)}\n`,
        "utf8",
      );
    } catch {
      // best-effort
    }
  }
}

export const studioLocks = new StudioLockManager();

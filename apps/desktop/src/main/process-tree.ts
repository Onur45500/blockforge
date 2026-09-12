import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function killProcessTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill", ["/T", "/F", "/PID", String(pid)], {
        windowsHide: true,
      });
    } catch {
      // Process may already be gone.
    }
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
  }

  await new Promise((r) => setTimeout(r, 200));
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
}

/** Spawn options so Unix process-group kill (-pid) works. */
export function unixProcessGroupSpawnOptions(): { detached?: boolean } {
  if (process.platform === "win32") {
    return {};
  }
  return { detached: true };
}

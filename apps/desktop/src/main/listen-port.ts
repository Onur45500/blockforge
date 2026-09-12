import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Parse Windows `netstat -ano` LISTENING rows for a TCP port.
 * Avoids matching :348720 when looking for :34872.
 */
export function parseNetstatListeningPids(stdout: string, port: number): number[] {
  const needle = `:${port}`;
  const pids = new Set<number>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!/LISTEN/i.test(line)) {
      continue;
    }
    const idx = line.indexOf(needle);
    if (idx < 0) {
      continue;
    }
    const after = line[idx + needle.length];
    if (after !== undefined && after !== " " && after !== "]") {
      continue;
    }
    const match = /(\d+)\s*$/.exec(line);
    if (!match?.[1]) {
      continue;
    }
    const pid = Number(match[1]);
    if (pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

export function parseLsofPids(stdout: string): number[] {
  const pids = new Set<number>();
  for (const token of stdout.split(/\s+/)) {
    const pid = Number(token);
    if (pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

/** True when the listener is a Rojo serve we should replace to keep port 34872. */
export function isReclaimableRojoListener(input: {
  commandLine: string | null;
  imageName: string | null;
  exePath: string;
}): boolean {
  const image = (input.imageName ?? "").trim().toLowerCase();
  if (image === "rojo.exe" || image === "rojo") {
    return true;
  }
  const cmd = (input.commandLine ?? "").toLowerCase().replace(/\//g, "\\");
  if (!cmd) {
    return false;
  }
  const exe = input.exePath.toLowerCase().replace(/\//g, "\\");
  if (exe.length > 0 && cmd.includes(exe)) {
    return true;
  }
  if (cmd.includes("@blockforge\\desktop\\bin\\rojo") && cmd.includes("serve")) {
    return true;
  }
  return cmd.includes("rojo.exe") && cmd.includes("serve");
}

export async function findListeningPids(port: number): Promise<number[]> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"], {
        windowsHide: true,
      });
      return parseNetstatListeningPids(stdout, port);
    } catch {
      return [];
    }
  }
  try {
    const { stdout } = await execFileAsync("lsof", [
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
      "-n",
      "-P",
      "-t",
    ]);
    return parseLsofPids(stdout);
  } catch {
    try {
      const { stdout } = await execFileAsync("ss", ["-ltnp", `sport = :${port}`]);
      const pids = new Set<number>();
      for (const match of stdout.matchAll(/pid=(\d+)/g)) {
        const pid = Number(match[1]);
        if (pid > 0) {
          pids.add(pid);
        }
      }
      return [...pids];
    } catch {
      return [];
    }
  }
}

export async function getProcessImageName(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "tasklist",
        ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
        { windowsHide: true },
      );
      const first = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (!first) {
        return null;
      }
      const quoted = /^"([^"]+)"/.exec(first.trim());
      return quoted?.[1] ?? null;
    } catch {
      return null;
    }
  }
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "comm="]);
    const name = stdout.trim();
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export async function getProcessCommandLine(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { windowsHide: true },
      );
      const line = stdout.trim();
      return line.length > 0 ? line : null;
    } catch {
      return null;
    }
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(`/proc/${pid}/cmdline`);
    const line = raw.toString("utf8").replace(/\0/g, " ").trim();
    return line.length > 0 ? line : null;
  } catch {
    return null;
  }
}

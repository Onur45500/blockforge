import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import * as pty from "node-pty";
import { execSync } from "node:child_process";

let mainWindow: BrowserWindow | null = null;
let ptyProcess: pty.IPty | null = null;

function findGitBash(): string | null {
  const candidates = [
    process.env.PROGRAMFILES
      ? path.join(process.env.PROGRAMFILES, "Git", "bin", "bash.exe")
      : "",
    process.env["PROGRAMFILES(X86)"]
      ? path.join(process.env["PROGRAMFILES(X86)"], "Git", "bin", "bash.exe")
      : "",
    "C:\\Program Files\\Git\\bin\\bash.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: "ignore" });
    } catch {
      // already exited
    }
  } else {
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
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Blockforge Terminal Spike",
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer.html"));

  mainWindow.on("closed", () => {
    if (ptyProcess) {
      killProcessTree(ptyProcess.pid);
      ptyProcess = null;
    }
    mainWindow = null;
  });
}

function startPty(): void {
  if (ptyProcess) return;

  const bash = findGitBash();
  const shell =
    process.platform === "win32"
      ? bash ?? "powershell.exe"
      : process.env.SHELL ?? "/bin/bash";

  // Launch Claude Code if available, else a plain shell for the spike.
  let file = shell;
  let args: string[] = [];
  if (process.platform === "win32" && bash) {
    // Prefer interactive Claude via Git Bash without skipping permissions.
    file = bash;
    args = ["-lc", "command -v claude >/dev/null && exec claude || exec bash -l"];
  } else {
    args = ["-lc", "command -v claude >/dev/null && exec claude || exec bash -l"];
  }

  const cwd = process.cwd();
  ptyProcess = pty.spawn(file, args, {
    name: "xterm-color",
    cols: 120,
    rows: 40,
    cwd,
    env: process.env as Record<string, string>,
  });

  ptyProcess.onData((data) => {
    mainWindow?.webContents.send("pty:data", data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send(
      "pty:exit",
      `Process exited with code ${exitCode}\r\n`,
    );
    ptyProcess = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("pty:start", () => {
    startPty();
    return { ok: true, pid: ptyProcess?.pid ?? null };
  });

  ipcMain.on("pty:input", (_event, data: string) => {
    ptyProcess?.write(data);
  });

  ipcMain.on("pty:resize", (_event, size: { cols: number; rows: number }) => {
    ptyProcess?.resize(size.cols, size.rows);
  });

  ipcMain.handle("pty:stop", () => {
    if (ptyProcess) {
      killProcessTree(ptyProcess.pid);
      ptyProcess = null;
    }
    return { ok: true };
  });
});

app.on("window-all-closed", () => {
  if (ptyProcess) {
    killProcessTree(ptyProcess.pid);
    ptyProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (ptyProcess) {
    killProcessTree(ptyProcess.pid);
    ptyProcess = null;
  }
});

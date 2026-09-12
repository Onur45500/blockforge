import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, Menu, shell } from "electron";
import { registerIpcHandlers } from "./ipc.js";
import { ProjectManager } from "./projects.js";
import { PtyManager } from "./pty-manager.js";
import { startBlockforgeMcpGateway, stopBlockforgeMcpGateway, DEFAULT_BLOCKFORGE_MCP_PORT } from "./blockforge-mcp-gateway.js";

let mainWindow: BrowserWindow | null = null;
const projectManager = new ProjectManager();
const ptyManager = new PtyManager(() => mainWindow);
let quitting = false;
const isDevRuntime = Boolean(process.env.ELECTRON_RENDERER_URL);

// Keep Chromium HTTP/GPU caches off the shared userData folder so a second
// Electron (or an electron-vite restart) cannot lock GPUCache with ERROR 0x5.
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch(
  "disk-cache-dir",
  join(tmpdir(), `blockforge-chromium-cache-${process.pid}`),
);

function resolvePreloadPath(): string {
  const candidates = [
    join(__dirname, "../preload/index.cjs"),
    join(__dirname, "../preload/index.js"),
    join(__dirname, "../preload/index.mjs"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Fall back to the forced CJS name from electron.vite.config.ts
  return candidates[0] ?? join(__dirname, "../preload/index.cjs");
}

function focusMainWindow(): void {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createWindow(): void {
  const preloadPath = resolvePreloadPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("preload-error", (_event, path, error) => {
    console.error("[blockforge] preload failed:", path, error);
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function shutdownManagedProcesses(): Promise<void> {
  await ptyManager.stopAll();
  await projectManager.closeAllProjects();
  await stopBlockforgeMcpGateway();
}

function startApp(): void {
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startBlockforgeMcpGateway(() => mainWindow, DEFAULT_BLOCKFORGE_MCP_PORT, ptyManager);
    const controlWatcher = registerIpcHandlers(
      () => mainWindow,
      projectManager,
      ptyManager,
    );

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    app.on("will-quit", () => {
      controlWatcher.unwatchAll();
    });
  });
}

if (!isDevRuntime) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      focusMainWindow();
    });
    startApp();
  }
} else {
  startApp();
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void (async () => {
      await shutdownManagedProcesses();
      app.quit();
    })();
  }
});

app.on("before-quit", (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  void (async () => {
    try {
      await shutdownManagedProcesses();
    } finally {
      app.exit(0);
    }
  })();
});

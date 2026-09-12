import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type {
  DoctorCheckId,
  DoctorCheckResult,
  DoctorReport,
  InstallBridgePluginResult,
} from "../shared/ipc-types.js";
import {
  findGitBash,
  detectWsl,
  claudeCodeAdapter,
  codexAdapter,
  openCodeAdapter,
  antigravityAdapter,
} from "../shared/agent-adapter.js";
import { detectStudioMcpLauncherInstalled } from "./studio-mcp-config.js";
import { getStudioMuxStatus } from "./mcp-runtime.js";

const execFileAsync = promisify(execFile);

const STUDIO_EXE_NAMES = [
  "RobloxStudioBeta.exe",
  "RobloxStudio.exe",
  "RobloxStudioInstaller.exe",
];

const BRIDGE_PLUGIN_FILENAME = "BlockforgeBridge.lua";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function checkNode(): Promise<DoctorCheckResult> {
  try {
    const { stdout } = await execFileAsync("node", ["--version"], {
      windowsHide: true,
    });
    return {
      id: "node",
      label: "Node.js",
      status: "ok",
      detail: stdout.trim(),
    };
  } catch {
    return {
      id: "node",
      label: "Node.js",
      status: "missing",
      detail: "Node.js not found on PATH",
      installGuidance: "winget install OpenJS.NodeJS.LTS",
    };
  }
}

async function checkGitBash(): Promise<DoctorCheckResult> {
  const bash = await findGitBash();
  if (bash) {
    return {
      id: "git-bash",
      label: "Git Bash",
      status: "ok",
      detail: bash,
    };
  }
  return {
    id: "git-bash",
    label: "Git Bash",
    status: "missing",
    detail: "Git Bash not found (required for Claude Code on Windows)",
    installGuidance: "winget install Git.Git",
  };
}

/**
 * Modern Studio installs under %LOCALAPPDATA%\Roblox\Versions\version-*\RobloxStudioBeta.exe.
 * Older installs used Program Files\Roblox\Versions.
 */
export async function findRobloxStudio(
  localAppData = process.env.LOCALAPPDATA,
): Promise<string | null> {
  const versionRoots = [
    localAppData ? join(localAppData, "Roblox", "Versions") : "",
    "C:\\Program Files (x86)\\Roblox\\Versions",
    "C:\\Program Files\\Roblox\\Versions",
  ].filter(Boolean);

  for (const versionsDir of versionRoots) {
    if (!(await pathExists(versionsDir))) {
      continue;
    }

    // Direct installers / loose exes in Versions/
    for (const exeName of STUDIO_EXE_NAMES) {
      const direct = join(versionsDir, exeName);
      if (await pathExists(direct)) {
        // Prefer a real Studio build over the installer alone
        if (exeName !== "RobloxStudioInstaller.exe") {
          return direct;
        }
      }
    }

    let entries: string[] = [];
    try {
      entries = await readdir(versionsDir);
    } catch {
      continue;
    }

    // Newest version-* folders first (name sort is good enough for version- hex ids by mtime better)
    const versionDirs = entries
      .filter((name) => name.startsWith("version-"))
      .reverse();

    for (const versionName of versionDirs) {
      const versionPath = join(versionsDir, versionName);
      for (const exeName of STUDIO_EXE_NAMES) {
        if (exeName === "RobloxStudioInstaller.exe") {
          continue;
        }
        const candidate = join(versionPath, exeName);
        if (await pathExists(candidate)) {
          return candidate;
        }
      }
    }

    // Fall back: installer present means Studio has been bootstrapped at least once
    const installer = join(versionsDir, "RobloxStudioInstaller.exe");
    if (await pathExists(installer)) {
      return installer;
    }
  }

  return null;
}

async function checkRobloxStudio(): Promise<DoctorCheckResult> {
  const path = await findRobloxStudio();
  if (path) {
    return {
      id: "roblox-studio",
      label: "Roblox Studio",
      status: "ok",
      detail: path,
    };
  }
  return {
    id: "roblox-studio",
    label: "Roblox Studio",
    status: "missing",
    detail: "Roblox Studio installation not detected",
    installGuidance:
      "Download Roblox Studio from https://create.roblox.com/ — it installs under %LOCALAPPDATA%\\Roblox\\Versions",
  };
}

async function checkClaudeCode(): Promise<DoctorCheckResult> {
  const installed = await claudeCodeAdapter.detectInstalled();
  if (!installed) {
    return {
      id: "claude-code",
      label: "Claude Code CLI",
      status: "missing",
      detail: "`claude` command not found on PATH",
      installGuidance:
        "Install Claude Code from https://docs.anthropic.com/en/docs/claude-code — then run `claude login` in Git Bash",
    };
  }

  const loggedIn = await claudeCodeAdapter.detectLoggedIn();
  if (!loggedIn) {
    return {
      id: "claude-code",
      label: "Claude Code CLI",
      status: "warning",
      detail: "Claude Code is installed but may not be logged in",
      installGuidance: "Run `claude login` in Git Bash",
    };
  }

  return {
    id: "claude-code",
    label: "Claude Code CLI",
    status: "ok",
    detail: "Claude Code CLI detected and responding",
  };
}

/** Roblox user Plugins folder (per-user, not per Studio version). */
export function getRobloxPluginsDir(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (platform === "win32") {
    const local = env.LOCALAPPDATA;
    if (!local) return null;
    return join(local, "Roblox", "Plugins");
  }
  if (platform === "darwin") {
    const home = env.HOME;
    if (!home) return null;
    return join(home, "Documents", "Roblox", "Plugins");
  }
  const home = env.HOME;
  if (!home) return null;
  return join(home, ".local", "share", "Roblox", "Plugins");
}

export function resolveBridgePluginSource(): string | null {
  const candidates: string[] = [];

  // Packaged app
  if (typeof process.resourcesPath === "string" && process.resourcesPath.length > 0) {
    candidates.push(
      join(process.resourcesPath, "studio-plugin", BRIDGE_PLUGIN_FILENAME),
    );
  }

  // Dev: relative to this module (src/main or out/main)
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(
      join(here, "../../resources/studio-plugin", BRIDGE_PLUGIN_FILENAME),
      join(here, "../resources/studio-plugin", BRIDGE_PLUGIN_FILENAME),
      join(here, "../../../resources/studio-plugin", BRIDGE_PLUGIN_FILENAME),
    );
  } catch {
    // ignore
  }

  // Dev from repo cwd
  candidates.push(
    join(process.cwd(), "resources", "studio-plugin", BRIDGE_PLUGIN_FILENAME),
    join(
      process.cwd(),
      "apps",
      "desktop",
      "resources",
      "studio-plugin",
      BRIDGE_PLUGIN_FILENAME,
    ),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function checkBridgePlugin(): Promise<DoctorCheckResult> {
  const pluginsDir = getRobloxPluginsDir();
  if (!pluginsDir) {
    return {
      id: "blockforge-bridge-plugin",
      label: "Blockforge bridge plugin",
      status: "warning",
      detail: "Could not resolve Roblox Plugins folder",
      installGuidance: "Use Doctor → Install bridge plugin after Studio is installed",
    };
  }
  const dest = join(pluginsDir, BRIDGE_PLUGIN_FILENAME);
  if (await pathExists(dest)) {
    return {
      id: "blockforge-bridge-plugin",
      label: "Blockforge bridge plugin",
      status: "ok",
      detail: dest,
    };
  }
  return {
    id: "blockforge-bridge-plugin",
    label: "Blockforge bridge plugin",
    status: "missing",
    detail: "Plugin not installed — Studio Play errors will not reach Claude",
    installGuidance:
      "Click “Install bridge plugin” on this page (or copy BlockforgeBridge.lua into the Roblox Plugins folder)",
  };
}

export async function installBridgePlugin(): Promise<InstallBridgePluginResult> {
  const source = resolveBridgePluginSource();
  if (!source) {
    return {
      success: false,
      message:
        "Could not find BlockforgeBridge.lua in app resources. Rebuild the desktop app or check apps/desktop/resources/studio-plugin/.",
    };
  }
  const pluginsDir = getRobloxPluginsDir();
  if (!pluginsDir) {
    return {
      success: false,
      message: "Could not resolve Roblox Plugins folder for this OS",
    };
  }
  try {
    await mkdir(pluginsDir, { recursive: true });
    const dest = join(pluginsDir, BRIDGE_PLUGIN_FILENAME);
    await copyFile(source, dest);
    return { success: true, path: dest };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkOptionalAgent(
  id: DoctorCheckId,
  label: string,
  installed: boolean,
  guidance: string,
): Promise<DoctorCheckResult> {
  if (installed) {
    return { id, label, status: "ok", detail: `${label} detected on PATH` };
  }
  return {
    id,
    label,
    status: "warning",
    detail: `${label} not found (optional multi-agent tab)`,
    installGuidance: guidance,
  };
}

async function checkStudioMcp(): Promise<DoctorCheckResult> {
  const detected = await detectStudioMcpLauncherInstalled();
  const mux = getStudioMuxStatus();
  const muxDetail = mux
    ? ` Mux: ${mux.phase} catalogGeneration=${mux.catalogGeneration} tools=${mux.toolCount}${mux.degraded ? " (degraded cache)" : ""}.`
    : " Mux: not started.";
  if (detected.installed && detected.path) {
    return {
      id: "studio-mcp",
      label: "Studio MCP launcher",
      status: mux?.phase === "Connected" ? "ok" : "warning",
      detail: `${detected.path} — enable “Studio as MCP server” in Studio Assistant Settings when you want live playtest. The app, Rojo, and the bridge keep working without it.${muxDetail}`,
      installGuidance:
        "https://create.roblox.com/docs/studio/mcp — optional. Restart the agent after enabling Studio MCP.",
    };
  }
  return {
    id: "studio-mcp",
    label: "Studio MCP launcher",
    status: "warning",
    detail: detected.path
      ? `Launcher not found at ${detected.path} (install/update Studio).${muxDetail}`
      : `Studio MCP launcher path unknown on this OS.${muxDetail}`,
    installGuidance:
      "Install Roblox Studio, open Assistant Settings → MCP Servers → Enable Studio as MCP server. Blockforge writes project .mcp.json (`blockforge` gateway; official Studio MCP is proxied). Debug duplicate Studio server: BLOCKFORGE_MCP_DIRECT_STUDIO=1. Docs: https://create.roblox.com/docs/studio/mcp.",
  };
}

async function checkWsl2(): Promise<DoctorCheckResult> {
  const status = await detectWsl();
  if (status.available) {
    return {
      id: "wsl2",
      label: "WSL2",
      status: "ok",
      detail: status.distro
        ? `${status.detail} (distro: ${status.distro})`
        : status.detail,
    };
  }
  return {
    id: "wsl2",
    label: "WSL2",
    status: "warning",
    detail: status.detail,
    installGuidance:
      "Optional sandbox tier 1: run `wsl --install` then enable Run agents in WSL2 in Settings",
  };
}

export async function runDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];

  if (process.platform === "win32") {
    checks.push(
      await checkNode(),
      await checkGitBash(),
      await checkRobloxStudio(),
      await checkClaudeCode(),
      await checkStudioMcp(),
      await checkOptionalAgent(
        "codex",
        "Codex CLI",
        await codexAdapter.detectInstalled(),
        "Install OpenAI Codex CLI and ensure `codex` is on PATH",
      ),
      await checkOptionalAgent(
        "opencode",
        "OpenCode CLI",
        await openCodeAdapter.detectInstalled(),
        "Install OpenCode and ensure `opencode` is on PATH",
      ),
      await checkOptionalAgent(
        "antigravity",
        "Antigravity CLI",
        await antigravityAdapter.detectInstalled(),
        "Install Antigravity CLI when available and ensure `antigravity` is on PATH",
      ),
      await checkWsl2(),
      await checkBridgePlugin(),
    );
  } else {
    checks.push(
      await checkNode(),
      await checkClaudeCode(),
      await checkStudioMcp(),
      await checkOptionalAgent(
        "codex",
        "Codex CLI",
        await codexAdapter.detectInstalled(),
        "Install OpenAI Codex CLI and ensure `codex` is on PATH",
      ),
      await checkOptionalAgent(
        "opencode",
        "OpenCode CLI",
        await openCodeAdapter.detectInstalled(),
        "Install OpenCode and ensure `opencode` is on PATH",
      ),
      await checkOptionalAgent(
        "antigravity",
        "Antigravity CLI",
        await antigravityAdapter.detectInstalled(),
        "Install Antigravity CLI when available",
      ),
      await checkBridgePlugin(),
    );
  }

  return {
    checks,
    platform: process.platform,
  };
}

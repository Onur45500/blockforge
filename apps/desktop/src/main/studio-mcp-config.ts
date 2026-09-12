import { access, readFile, writeFile } from "node:fs/promises";
import { constants, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Official Roblox Studio MCP launcher paths (Creator Hub docs).
 * Blockforge proxies this via StudioMcpMux — agents use the `blockforge` server.
 * Debug: BLOCKFORGE_MCP_DIRECT_STUDIO=1 also writes a Roblox_Studio .mcp.json entry.
 */
export function resolveStudioMcpLauncher(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): { path: string; kind: "bat" | "binary"; args?: string[] } | null {
  if (platform === "win32") {
    const local = env.LOCALAPPDATA;
    if (!local) return null;
    return { path: join(local, "Roblox", "mcp.bat"), kind: "bat" };
  }
  if (platform === "darwin") {
    return {
      path: "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP",
      kind: "binary",
    };
  }
  if (platform === "linux") {
    const configured = env.BLOCKFORGE_STUDIO_MCP_PATH;
    const home = env.HOME;
    return {
      path:
        configured ||
        (home
          ? join(home, ".local", "bin", "rbx-studio-mcp")
          : "/usr/local/bin/rbx-studio-mcp"),
      kind: "binary",
      args: ["--stdio"],
    };
  }
  return null;
}

/**
 * Prefer the real StudioMCP binary over mcp.bat (Windows `else` on its own
 * line is invalid cmd, and cmd.exe wrapping hides stdio failures).
 */
export function resolveStudioMcpBinary(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (platform === "darwin" || platform === "linux") {
    const launcher = resolveStudioMcpLauncher(platform, env);
    if (launcher?.kind === "binary" && existsSync(launcher.path)) {
      return launcher.path;
    }
    return null;
  }
  if (platform !== "win32") {
    return null;
  }
  const local = env.LOCALAPPDATA;
  if (!local) {
    return null;
  }
  const bat = join(local, "Roblox", "mcp.bat");
  if (existsSync(bat)) {
    try {
      const text = readFileSync(bat, "utf8");
      const quoted = /"([^"]+StudioMCP\.exe)"/i.exec(text);
      if (quoted?.[1] && existsSync(quoted[1])) {
        return quoted[1];
      }
    } catch {
      // fall through to Versions scan
    }
  }
  const versionsDir = join(local, "Roblox", "Versions");
  if (!existsSync(versionsDir)) {
    return null;
  }
  try {
    const names = readdirSync(versionsDir);
    const matches: string[] = [];
    for (const name of names) {
      const candidate = join(versionsDir, name, "StudioMCP.exe");
      if (existsSync(candidate)) {
        matches.push(candidate);
      }
    }
    matches.sort();
    return matches.at(-1) ?? null;
  } catch {
    return null;
  }
}

export function isDirectStudioMcpEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.BLOCKFORGE_MCP_DIRECT_STUDIO === "1";
}

export function buildStudioMcpJsonConfig(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const launcher = resolveStudioMcpLauncher(platform, env);
  if (launcher?.kind === "binary") {
    return {
      mcpServers: {
        Roblox_Studio: {
          command: launcher.path,
          ...(launcher.args ? { args: launcher.args } : {}),
        },
      },
    };
  }
  // Windows: official cmd.exe + mcp.bat form.
  return {
    mcpServers: {
      Roblox_Studio: {
        command: "cmd.exe",
        args: ["/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"],
      },
    },
  };
}

export function buildBlockforgeMcpServerEntry(port: number): {
  command: string;
  args: string[];
  env: { BLOCKFORGE_MCP_URL: string };
} {
  return {
    command: "node",
    args: ["scripts/blockforge-mcp-launcher.mjs"],
    env: {
      BLOCKFORGE_MCP_URL: `http://127.0.0.1:${port}`,
    },
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure project `.mcp.json` contains `blockforge` (unified gateway).
 * Default: no Roblox_Studio entry (duplicates execute_luau via the mux).
 * Debug: BLOCKFORGE_MCP_DIRECT_STUDIO=1 keeps Roblox_Studio alongside blockforge.
 */
export async function ensureProjectStudioMcpConfig(
  projectPath: string,
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  mcpPort?: number,
): Promise<{ wrote: boolean; path: string; detail: string }> {
  const mcpPath = join(projectPath, ".mcp.json");
  const port = mcpPort ?? Number(env.BLOCKFORGE_MCP_PORT ?? 34874);
  const blockforgeEntry = buildBlockforgeMcpServerEntry(port);
  const directStudio = isDirectStudioMcpEnabled(env);
  const robloxEntry = directStudio
    ? (buildStudioMcpJsonConfig(platform, env).mcpServers as Record<string, unknown>)
        .Roblox_Studio
    : undefined;

  let existing: { mcpServers?: Record<string, unknown> } = {};
  try {
    const raw = await readFile(mcpPath, "utf8");
    existing = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
  } catch {
    existing = {};
  }

  const servers = { ...(existing.mcpServers ?? {}) };
  const prev = JSON.stringify({
    Roblox_Studio: servers.Roblox_Studio ?? null,
    blockforge: servers.blockforge ?? null,
  });
  servers.blockforge = blockforgeEntry;
  if (directStudio && robloxEntry) {
    servers.Roblox_Studio = robloxEntry;
  } else {
    delete servers.Roblox_Studio;
  }
  const next = JSON.stringify({
    Roblox_Studio: servers.Roblox_Studio ?? null,
    blockforge: servers.blockforge,
  });
  if (prev === next && (await pathExists(mcpPath))) {
    return {
      wrote: false,
      path: mcpPath,
      detail: directStudio
        ? "Roblox_Studio + blockforge MCP entries already present"
        : "blockforge MCP entry already present (Studio proxied via mux)",
    };
  }

  const payload = { ...existing, mcpServers: servers };
  await writeFile(mcpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    wrote: true,
    path: mcpPath,
    detail: directStudio
      ? "Wrote Roblox_Studio + blockforge MCP server entries to .mcp.json"
      : "Wrote blockforge MCP server entry to .mcp.json (Studio tools proxied by the host mux)",
  };
}

export async function detectStudioMcpLauncherInstalled(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ installed: boolean; path: string | null }> {
  const launcher = resolveStudioMcpLauncher(platform, env);
  if (!launcher) {
    return { installed: false, path: null };
  }
  return {
    installed: await pathExists(launcher.path),
    path: launcher.path,
  };
}

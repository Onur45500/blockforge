import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import {
  BLOCKFORGE_AGENT_BOOTSTRAP,
  buildDynamicBootstrap,
} from "./agent-bootstrap.js";

const execFileAsync = promisify(execFile);

export type LaunchCommand = {
  file: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
};

/** Claude Code model aliases Blockforge may force via --model. */
export type AgentModelId = "sonnet" | "opus" | "haiku";

export const DEFAULT_AGENT_MODEL: AgentModelId = "sonnet";

export type AgentId =
  | "claude-code"
  | "codex"
  | "opencode"
  | "antigravity";

export const DEFAULT_AGENT_ID: AgentId = "claude-code";

export type GetLaunchCommandOptions = {
  resume?: boolean;
  /** Absolute path to asset-bank catalog/index.json */
  catalogPath?: string;
  /** Prebuilt prompt; when omitted, built from projectDir */
  systemPrompt?: string;
  /** Overrides the user's global Claude Code model default (e.g. haiku). */
  model?: AgentModelId | string;
  /** Run the agent inside WSL2 (Windows only). */
  runInWsl?: boolean;
  /** Prefer official Studio MCP; false forces bridge-only verification guidance. */
  preferStudioMcp?: boolean;
  /**
   * Enable Claude Code Agent Teams (lead + teammates).
   * Injects CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 into the launch env.
   */
  agentTeams?: boolean;
};

export type AgentAdapter = {
  id: AgentId;
  displayName: string;
  instructionsFilename: string;
  supportsResume: boolean;
  detectInstalled: () => Promise<boolean>;
  detectLoggedIn: () => Promise<boolean>;
  getLaunchCommand: (
    projectPath: string,
    options?: GetLaunchCommandOptions,
  ) => Promise<LaunchCommand>;
};

const GIT_BASH_CANDIDATES = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
];

export async function findGitBash(): Promise<string | null> {
  for (const candidate of GIT_BASH_CANDIDATES) {
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

export async function commandExists(command: string): Promise<boolean> {
  const checker =
    process.platform === "win32"
      ? (["where", command] as const)
      : (["which", command] as const);
  try {
    await execFileAsync(checker[0], [checker[1]], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** Single-quote for bash -lc argument embedding. */
export function bashSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Convert a Windows path to a WSL path (e.g. C:\foo → /mnt/c/foo). */
export function windowsPathToWsl(windowsPath: string): string {
  const normalized = windowsPath.replace(/\\/g, "/");
  const match = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (!match) {
    return normalized;
  }
  return `/mnt/${(match[1] ?? "c").toLowerCase()}/${match[2] ?? ""}`;
}

export type WslStatus = {
  available: boolean;
  detail: string;
  distro?: string;
};

/** Detect WSL2 availability (Windows only). */
export async function detectWsl(): Promise<WslStatus> {
  if (process.platform !== "win32") {
    return { available: false, detail: "WSL is Windows-only" };
  }
  try {
    const { stdout } = await execFileAsync(
      "wsl.exe",
      ["-l", "-v"],
      { windowsHide: true, timeout: 8_000, encoding: "utf16le" },
    );
    const text = stdout.replace(/\0/g, "");
    const hasVersion2 = /\s2\s*$/m.test(text) || /\s+2\s+/m.test(text);
    const defaultLine = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("*") || line.length > 0);
    const distroMatch = defaultLine
      ? /\*?\s*(\S+)/.exec(defaultLine.replace(/^\*/, "").trim())
      : null;
    if (!hasVersion2 && !/VERSION/i.test(text)) {
      // Older wsl -l without -v still means WSL exists
      if (/Ubuntu|Debian|openSUSE|kali|Alpine/i.test(text)) {
        return {
          available: true,
          detail: "WSL detected (version unknown)",
          distro: distroMatch?.[1],
        };
      }
    }
    if (hasVersion2 || /VERSION/i.test(text)) {
      return {
        available: true,
        detail: hasVersion2 ? "WSL2 available" : "WSL available",
        distro: distroMatch?.[1],
      };
    }
    return { available: false, detail: "WSL installed but no distro listed" };
  } catch {
    return {
      available: false,
      detail: "wsl.exe not found — install WSL2 via `wsl --install`",
    };
  }
}

function cloneEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = { TERM: "xterm-256color", ...extra };
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && env[key] === undefined) {
      env[key] = value;
    }
  }
  return env;
}

/** Env for Claude Code Agent Teams (lead + workers). */
export function agentTeamsEnv(enabled: boolean): Record<string, string> {
  if (!enabled) {
    return {};
  }
  return {
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
  };
}

async function resolveBootstrap(
  projectPath: string,
  options: GetLaunchCommandOptions,
): Promise<string> {
  if (options.systemPrompt) {
    return options.systemPrompt;
  }
  try {
    return await buildDynamicBootstrap(projectPath, {
      catalogPath: options.catalogPath,
      preferStudioMcp: options.preferStudioMcp,
    });
  } catch {
    return BLOCKFORGE_AGENT_BOOTSTRAP;
  }
}

/**
 * Wrap a bash -lc payload so it runs under WSL2 with the project as cwd.
 * Host cwd stays the Windows project path for node-pty; the inner shell cds into WSL path.
 */
export function wrapLaunchForWsl(
  projectPath: string,
  innerCommand: string,
  extraEnv?: Record<string, string>,
): LaunchCommand {
  const wslPath = windowsPathToWsl(projectPath);
  const script = `cd ${bashSingleQuote(wslPath)} && ${innerCommand}`;
  return {
    file: "wsl.exe",
    args: ["-e", "bash", "-lc", script],
    cwd: projectPath,
    env: cloneEnv(extraEnv),
  };
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = "claude-code" as const;
  readonly displayName = "Claude Code";
  readonly instructionsFilename = "CLAUDE.md";
  readonly supportsResume = true;

  async detectInstalled(): Promise<boolean> {
    return commandExists("claude");
  }

  async detectLoggedIn(): Promise<boolean> {
    const bash = await findGitBash();
    if (!bash) {
      // Still try bare claude on non-Windows or PATH
      try {
        await execFileAsync("claude", ["--version"], {
          windowsHide: true,
          timeout: 10_000,
        });
        return true;
      } catch {
        return false;
      }
    }
    try {
      await execFileAsync(bash, ["-lc", "claude --version"], {
        windowsHide: true,
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getLaunchCommand(
    projectPath: string,
    options: GetLaunchCommandOptions = {},
  ): Promise<LaunchCommand> {
    const resume = options.resume ?? false;
    const model =
      (options.model ?? DEFAULT_AGENT_MODEL).trim() || DEFAULT_AGENT_MODEL;
    const systemPrompt = await resolveBootstrap(projectPath, options);
    const teams = agentTeamsEnv(options.agentTeams !== false);

    // Never pass --dangerously-skip-permissions.
    const parts = ["claude"];
    if (resume) {
      parts.push("--resume");
    }
    parts.push("--model", bashSingleQuote(model));
    // Keep teammates in-process so Electron's terminal can host the lead panel.
    parts.push("--teammate-mode", "in-process");
    parts.push("--append-system-prompt", bashSingleQuote(systemPrompt));
    const command = parts.join(" ");

    if (options.runInWsl && process.platform === "win32") {
      return wrapLaunchForWsl(projectPath, command, teams);
    }

    if (process.platform === "win32") {
      const bash = (await findGitBash()) ?? GIT_BASH_CANDIDATES[0] ?? "bash";
      return {
        file: bash,
        args: ["-lc", command],
        cwd: projectPath,
        env: cloneEnv(teams),
      };
    }

    return {
      file: "bash",
      args: ["-lc", command],
      cwd: projectPath,
      env: cloneEnv(teams),
    };
  }
}

/** OpenAI Codex CLI adapter (codex). */
export class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const;
  readonly displayName = "Codex";
  readonly instructionsFilename = "AGENTS.md";
  readonly supportsResume = true;

  async detectInstalled(): Promise<boolean> {
    return commandExists("codex");
  }

  async detectLoggedIn(): Promise<boolean> {
    try {
      await execFileAsync("codex", ["--version"], {
        windowsHide: true,
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getLaunchCommand(
    projectPath: string,
    options: GetLaunchCommandOptions = {},
  ): Promise<LaunchCommand> {
    const systemPrompt = await resolveBootstrap(projectPath, options);
    const parts = ["codex"];
    if (options.resume) {
      parts.push("resume");
    }
    // Pass Blockforge context as an initial prompt note when starting fresh
    if (!options.resume) {
      parts.push(bashSingleQuote(`Follow AGENTS.md. ${systemPrompt.slice(0, 4000)}`));
    }
    const command = parts.join(" ");

    if (options.runInWsl && process.platform === "win32") {
      return wrapLaunchForWsl(projectPath, command);
    }

    if (process.platform === "win32") {
      const bash = (await findGitBash()) ?? GIT_BASH_CANDIDATES[0] ?? "bash";
      return {
        file: bash,
        args: ["-lc", command],
        cwd: projectPath,
        env: cloneEnv(),
      };
    }

    return {
      file: "bash",
      args: ["-lc", command],
      cwd: projectPath,
      env: cloneEnv(),
    };
  }
}

/** OpenCode CLI adapter. */
export class OpenCodeAdapter implements AgentAdapter {
  readonly id = "opencode" as const;
  readonly displayName = "OpenCode";
  readonly instructionsFilename = "AGENTS.md";
  readonly supportsResume = true;

  async detectInstalled(): Promise<boolean> {
    return commandExists("opencode");
  }

  async detectLoggedIn(): Promise<boolean> {
    try {
      await execFileAsync("opencode", ["--version"], {
        windowsHide: true,
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getLaunchCommand(
    projectPath: string,
    options: GetLaunchCommandOptions = {},
  ): Promise<LaunchCommand> {
    const parts = ["opencode"];
    if (options.resume) {
      parts.push("--continue");
    }
    const command = parts.join(" ");

    if (options.runInWsl && process.platform === "win32") {
      return wrapLaunchForWsl(projectPath, command);
    }

    if (process.platform === "win32") {
      const bash = (await findGitBash()) ?? GIT_BASH_CANDIDATES[0] ?? "bash";
      return {
        file: bash,
        args: ["-lc", command],
        cwd: projectPath,
        env: cloneEnv(),
      };
    }

    return {
      file: "bash",
      args: ["-lc", command],
      cwd: projectPath,
      env: cloneEnv(),
    };
  }
}

/**
 * Antigravity CLI adapter — experimental.
 * Detects `antigravity` on PATH; launch uses a documented placeholder argv.
 */
export class AntigravityAdapter implements AgentAdapter {
  readonly id = "antigravity" as const;
  readonly displayName = "Antigravity";
  readonly instructionsFilename = "AGENTS.md";
  readonly supportsResume = false;

  async detectInstalled(): Promise<boolean> {
    return commandExists("antigravity");
  }

  async detectLoggedIn(): Promise<boolean> {
    return this.detectInstalled();
  }

  async getLaunchCommand(
    projectPath: string,
    options: GetLaunchCommandOptions = {},
  ): Promise<LaunchCommand> {
    const command = "antigravity";

    if (options.runInWsl && process.platform === "win32") {
      return wrapLaunchForWsl(projectPath, command);
    }

    if (process.platform === "win32") {
      const bash = (await findGitBash()) ?? GIT_BASH_CANDIDATES[0] ?? "bash";
      return {
        file: bash,
        args: ["-lc", command],
        cwd: projectPath,
        env: cloneEnv(),
      };
    }

    return {
      file: "bash",
      args: ["-lc", command],
      cwd: projectPath,
      env: cloneEnv(),
    };
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
export const codexAdapter = new CodexAdapter();
export const openCodeAdapter = new OpenCodeAdapter();
export const antigravityAdapter = new AntigravityAdapter();

export const agentAdapters: AgentAdapter[] = [
  claudeCodeAdapter,
  codexAdapter,
  openCodeAdapter,
  antigravityAdapter,
];

export function isAgentId(value: unknown): value is AgentId {
  return (
    value === "claude-code" ||
    value === "codex" ||
    value === "opencode" ||
    value === "antigravity"
  );
}

export function getAgentAdapter(id: AgentId | string): AgentAdapter {
  const found = agentAdapters.find((a) => a.id === id);
  return found ?? claudeCodeAdapter;
}

export function getDefaultAgentAdapter(): AgentAdapter {
  return claudeCodeAdapter;
}

export function listAgentAdapters(): ReadonlyArray<{
  id: AgentId;
  displayName: string;
  supportsResume: boolean;
  instructionsFilename: string;
}> {
  return agentAdapters.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    supportsResume: a.supportsResume,
    instructionsFilename: a.instructionsFilename,
  }));
}

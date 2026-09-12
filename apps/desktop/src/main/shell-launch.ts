export type ShellLaunch = {
  file: string;
  args: string[];
  cwd: string;
};

/**
 * Resolve the system shell executable for an integrated terminal.
 * Windows uses ComSpec (cmd.exe); other platforms use $SHELL or bash.
 */
export function resolveShellLaunch(
  projectPath: string,
  options?: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
  },
): ShellLaunch {
  const platform = options?.platform ?? process.platform;
  const env = options?.env ?? process.env;
  if (platform === "win32") {
    const comspec = env.ComSpec;
    return {
      file:
        typeof comspec === "string" && comspec.length > 0
          ? comspec
          : "cmd.exe",
      args: [],
      cwd: projectPath,
    };
  }
  const shell = env.SHELL;
  return {
    file: typeof shell === "string" && shell.length > 0 ? shell : "/bin/bash",
    args: [],
    cwd: projectPath,
  };
}

/** Host env plus TERM and project path — no agent MCP token. */
export function shellEnv(
  projectPath: string,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = { TERM: "xterm-256color" };
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && env[key] === undefined) {
      env[key] = value;
    }
  }
  env.BLOCKFORGE_PROJECT_PATH = projectPath;
  return env;
}

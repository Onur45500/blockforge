#!/usr/bin/env node
/**
 * Cross-platform stdio launcher used by the template .mcp.json.
 * Blockforge replaces the template entry with a platform-specific absolute
 * command when a project is created or upgraded.
 */
import { spawn } from "node:child_process";
import { join } from "node:path";

let command;
let args = [];

if (process.platform === "win32") {
  command = "cmd.exe";
  args = [
    "/c",
    join(process.env.LOCALAPPDATA ?? "", "Roblox", "mcp.bat"),
  ];
} else if (process.platform === "darwin") {
  command = "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP";
} else if (process.platform === "linux") {
  command =
    process.env.BLOCKFORGE_STUDIO_MCP_PATH ??
    join(
      process.env.HOME ?? "/usr/local",
      process.env.HOME ? ".local/bin/rbx-studio-mcp" : "bin/rbx-studio-mcp",
    );
  args = ["--stdio"];
} else {
  process.stderr.write(
    `Unsupported platform for Roblox Studio MCP: ${process.platform}\n`,
  );
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", (error) => {
  process.stderr.write(`Could not launch Roblox Studio MCP: ${error.message}\n`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

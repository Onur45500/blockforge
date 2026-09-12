import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildStudioMcpJsonConfig,
  ensureProjectStudioMcpConfig,
  resolveStudioMcpBinary,
  resolveStudioMcpLauncher,
} from "./studio-mcp-config.js";

describe("studio-mcp-config", () => {
  it("resolves Windows mcp.bat under LOCALAPPDATA", () => {
    const resolved = resolveStudioMcpLauncher("win32", {
      LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
    });
    assert.ok(resolved);
    assert.match(resolved.path, /mcp\.bat$/);
  });

  it("prefers StudioMCP.exe quoted in mcp.bat over the bat wrapper", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mcp-bin-"));
    const versions = join(dir, "Roblox", "Versions", "version-test");
    await mkdir(versions, { recursive: true });
    const exe = join(versions, "StudioMCP.exe");
    await writeFile(exe, "");
    await writeFile(
      join(dir, "Roblox", "mcp.bat"),
      `@echo off\r\nif exist "${exe}" ( "${exe}" %* )\r\nelse (echo missing)\r\n`,
      "utf8",
    );
    const resolved = resolveStudioMcpBinary("win32", { LOCALAPPDATA: dir });
    assert.equal(resolved, exe);
  });

  it("scans Versions for StudioMCP.exe when mcp.bat pin is stale", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mcp-scan-"));
    const versions = join(dir, "Roblox", "Versions", "version-live");
    await mkdir(versions, { recursive: true });
    const exe = join(versions, "StudioMCP.exe");
    await writeFile(exe, "");
    await writeFile(
      join(dir, "Roblox", "mcp.bat"),
      `@echo off\r\nif exist "C:\\missing\\StudioMCP.exe" ( "C:\\missing\\StudioMCP.exe" %* )\r\n`,
      "utf8",
    );
    const resolved = resolveStudioMcpBinary("win32", { LOCALAPPDATA: dir });
    assert.equal(resolved, exe);
  });

  it("builds Windows JSON with cmd.exe wrapper", () => {
    const cfg = buildStudioMcpJsonConfig("win32") as {
      mcpServers: { Roblox_Studio: { command: string; args: string[] } };
    };
    assert.equal(cfg.mcpServers.Roblox_Studio.command, "cmd.exe");
    assert.deepEqual(cfg.mcpServers.Roblox_Studio.args, [
      "/c",
      "%LOCALAPPDATA%\\Roblox\\mcp.bat",
    ]);
  });

  it("builds macOS JSON with the Studio app binary", () => {
    const cfg = buildStudioMcpJsonConfig("darwin") as {
      mcpServers: { Roblox_Studio: { command: string; args?: string[] } };
    };
    assert.equal(
      cfg.mcpServers.Roblox_Studio.command,
      "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP",
    );
    assert.equal(cfg.mcpServers.Roblox_Studio.args, undefined);
  });

  it("builds Linux JSON with an absolute stdio launcher path", () => {
    const cfg = buildStudioMcpJsonConfig("linux", {
      HOME: "/home/test",
    }) as {
      mcpServers: { Roblox_Studio: { command: string; args: string[] } };
    };
    assert.equal(
      cfg.mcpServers.Roblox_Studio.command,
      join("/home/test", ".local", "bin", "rbx-studio-mcp"),
    );
    assert.deepEqual(cfg.mcpServers.Roblox_Studio.args, ["--stdio"]);
  });

  it("writes blockforge-only .mcp.json by default (no Roblox_Studio)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mcp-"));
    await writeFile(
      join(dir, ".mcp.json"),
      JSON.stringify({
        mcpServers: { other: { command: "echo" } },
      }),
      "utf8",
    );
    const result = await ensureProjectStudioMcpConfig(dir, "win32", {
      LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
    });
    assert.equal(result.wrote, true);
    const parsed = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(parsed.mcpServers.other);
    assert.ok(parsed.mcpServers.blockforge);
    assert.equal(parsed.mcpServers.Roblox_Studio, undefined);
  });

  it("keeps Roblox_Studio when BLOCKFORGE_MCP_DIRECT_STUDIO=1", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-mcp-direct-"));
    const result = await ensureProjectStudioMcpConfig(dir, "win32", {
      LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      BLOCKFORGE_MCP_DIRECT_STUDIO: "1",
    });
    assert.equal(result.wrote, true);
    const parsed = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(parsed.mcpServers.blockforge);
    assert.ok(parsed.mcpServers.Roblox_Studio);
  });

  it("template .mcp.json is blockforge-only", async () => {
    const templateMcp = join(
      fileURLToPath(new URL(".", import.meta.url)),
      "../../../../packages/project-template/.mcp.json",
    );
    const parsed = JSON.parse(await readFile(templateMcp, "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(parsed.mcpServers.blockforge);
    assert.equal(parsed.mcpServers.Roblox_Studio, undefined);
  });
});

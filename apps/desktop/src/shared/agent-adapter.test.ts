import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ClaudeCodeAdapter,
  CodexAdapter,
  OpenCodeAdapter,
  AntigravityAdapter,
  getAgentAdapter,
  listAgentAdapters,
  windowsPathToWsl,
  wrapLaunchForWsl,
} from "./agent-adapter.js";
import {
  BLOCKFORGE_AGENT_BOOTSTRAP,
  buildDynamicBootstrap,
} from "./agent-bootstrap.js";

describe("ClaudeCodeAdapter", () => {
  it("never includes dangerously-skip-permissions in launch command", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
    });
    const joined = [cmd.file, ...cmd.args].join(" ");
    assert.equal(joined.includes("--dangerously-skip-permissions"), false);
  });

  it("supports resume without skip-permissions flag", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      resume: true,
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
    });
    const joined = cmd.args.join(" ");
    assert.match(joined, /--resume/);
    assert.equal(joined.includes("--dangerously-skip-permissions"), false);
  });

  it("appends Blockforge bootstrap system prompt on launch", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
    });
    const joined = cmd.args.join(" ");
    assert.match(joined, /--append-system-prompt/);
    assert.match(joined, /BLOCKFORGE SESSION/);
    assert.ok(BLOCKFORGE_AGENT_BOOTSTRAP.includes("roblox-ts"));
  });

  it("forces --model sonnet by default", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
    });
    const joined = cmd.args.join(" ");
    assert.match(joined, /--model\s+'sonnet'/);
  });

  it("enables Agent Teams env and in-process teammate mode by default", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
      agentTeams: true,
    });
    assert.equal(cmd.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, "1");
    assert.match(cmd.args.join(" "), /--teammate-mode\s+in-process/);
  });

  it("can disable Agent Teams via options", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
      agentTeams: false,
    });
    assert.equal(cmd.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, undefined);
  });

  it("bootstrap mentions swarm lead roles", async () => {
    assert.match(BLOCKFORGE_AGENT_BOOTSTRAP, /SWARM MODE/);
    assert.match(BLOCKFORGE_AGENT_BOOTSTRAP, /world-builder/);
    assert.match(BLOCKFORGE_AGENT_BOOTSTRAP, /qa-verifier/);
    const prompt = await buildDynamicBootstrap("C:\\projects\\demo");
    assert.match(prompt, /STUDIO MCP/);
    assert.match(prompt, /studio_id/);
  });

  it("uses bridge-only instructions when Studio MCP is disabled", async () => {
    const prompt = await buildDynamicBootstrap("C:\\projects\\demo", {
      preferStudioMcp: false,
    });
    assert.match(prompt, /Bridge-only mode/);
    assert.match(prompt, /Do not call Roblox Studio MCP tools/);
    assert.doesNotMatch(prompt, /STUDIO MCP: Prefer/);
  });

  it("respects an explicit model override", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
      model: "opus",
    });
    const joined = cmd.args.join(" ");
    assert.match(joined, /--model\s+'opus'/);
    assert.equal(/--model\s+'sonnet'/.test(joined), false);
  });

  it("includes dynamic project snapshot when building prompt from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-bootstrap-"));
    await mkdir(join(dir, "world"), { recursive: true });
    await writeFile(
      join(dir, "world", "SpawnPlatform.model.json"),
      JSON.stringify({
        ClassName: "Model",
        Children: [
          {
            Name: "GroundPlatform",
            ClassName: "Part",
            Properties: {
              Anchored: true,
              Size: [40, 2, 40],
              Position: [0, 10, 0],
            },
          },
          {
            Name: "DefaultSpawn",
            ClassName: "SpawnLocation",
            Properties: {
              Anchored: true,
              Size: [6, 1, 6],
              Position: [0, 11.5, 0],
              Enabled: true,
            },
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      join(dir, "assets.json"),
      JSON.stringify({ assets: { kenney_crate: { id: 1 } } }),
      "utf8",
    );

    const prompt = await buildDynamicBootstrap(dir);
    assert.match(prompt, /BLOCKFORGE SESSION/);
    assert.match(prompt, /SpawnPlatform\.model\.json/);
    assert.match(prompt, /DefaultSpawn/);
    assert.match(prompt, /GroundPlatform/);
    assert.match(prompt, /\[0, 11\.5, 0\]/);
    assert.match(prompt, /kenney_crate/);
    assert.match(prompt, /validate:world/);
    assert.match(prompt, /validate:refs/);
    assert.match(prompt, /studio-output\.jsonl/);

    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand(dir);
    assert.match(cmd.args.join(" "), /SpawnPlatform/);
  });

  it("wraps launch for WSL2 with converted cwd", async () => {
    const adapter = new ClaudeCodeAdapter();
    const cmd = await adapter.getLaunchCommand("C:\\projects\\demo", {
      systemPrompt: BLOCKFORGE_AGENT_BOOTSTRAP,
      runInWsl: true,
    });
    if (process.platform === "win32") {
      assert.equal(cmd.file, "wsl.exe");
      assert.ok(cmd.args.some((a) => a.includes("/mnt/c/projects/demo")));
    }
  });
});

describe("agent adapter registry", () => {
  it("lists Claude, Codex, OpenCode, Antigravity", () => {
    const ids = listAgentAdapters().map((a) => a.id);
    assert.deepEqual(ids, ["claude-code", "codex", "opencode", "antigravity"]);
  });

  it("resolves adapters by id", () => {
    assert.equal(getAgentAdapter("codex").displayName, "Codex");
    assert.equal(getAgentAdapter("opencode").id, "opencode");
    assert.equal(getAgentAdapter("antigravity").supportsResume, false);
  });

  it("converts Windows paths to WSL mount paths", () => {
    assert.equal(windowsPathToWsl("C:\\Users\\a\\proj"), "/mnt/c/Users/a/proj");
    assert.equal(windowsPathToWsl("D:/games/foo"), "/mnt/d/games/foo");
  });

  it("wrapLaunchForWsl uses wsl.exe", () => {
    const launch = wrapLaunchForWsl("C:\\proj", "claude --version");
    assert.equal(launch.file, "wsl.exe");
    assert.equal(launch.args[0], "-e");
    assert.match(launch.args.join(" "), /\/mnt\/c\/proj/);
  });

  it("Codex and OpenCode resume flags differ", async () => {
    const codex = await new CodexAdapter().getLaunchCommand("C:\\p", {
      resume: true,
      systemPrompt: "x",
    });
    const open = await new OpenCodeAdapter().getLaunchCommand("C:\\p", {
      resume: true,
      systemPrompt: "x",
    });
    assert.match(codex.args.join(" "), /codex resume|resume/);
    assert.match(open.args.join(" "), /--continue/);
    const ag = await new AntigravityAdapter().getLaunchCommand("C:\\p");
    assert.match(ag.args.join(" "), /antigravity/);
  });
});

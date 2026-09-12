import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { StudioLockManager } from "./studio-locks.js";
import { runPlaytestCheck } from "./mcp-playtest.js";
import { textResult, type McpToolDef, type McpToolResult } from "./mcp-tool-catalog.js";
import type { StudioMuxStatus, StudioToolClient } from "./studio-mcp-mux.js";

class FakeStudioClient implements StudioToolClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  constructor(
    private readonly tools: McpToolDef[],
    private readonly handlers: Record<
      string,
      (args: Record<string, unknown>) => McpToolResult
    > = {},
    private readonly phase: StudioMuxStatus["phase"] = "Connected",
  ) {}

  getStatus(): StudioMuxStatus {
    return {
      phase: this.phase,
      detail: "fake",
      degraded: false,
      catalogGeneration: 1,
      toolCount: this.tools.length,
    };
  }
  getCachedTools(): McpToolDef[] {
    return this.tools;
  }
  isDegraded(): boolean {
    return false;
  }
  getCatalogGeneration(): number {
    return 1;
  }
  async reconnect(): Promise<void> {
    return;
  }
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    this.calls.push({ name, args });
    const handler = this.handlers[name];
    if (handler) {
      return handler(args);
    }
    return textResult("ok");
  }
}

describe("runPlaytestCheck", () => {
  it("starts Play, reads console, stops, and returns a verdict", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "bf-playtest-"));
    try {
      const locks = new StudioLockManager();
      const client = new FakeStudioClient(
        [
          { name: "start_stop_play" },
          { name: "get_console_output" },
          { name: "screen_capture" },
        ],
        {
          get_console_output: () => textResult("Server started"),
          screen_capture: () => textResult("png-bytes"),
        },
      );
      const result = await runPlaytestCheck(
        {
          hypothesis: "player spawns on the pad",
          sessionId: "s1",
          projectPath,
          waitMs: 0,
          timeoutMs: 1000,
        },
        { client, locks, sleep: async () => undefined },
      );
      const names = client.calls.map((c) => c.name);
      assert.deepEqual(names, [
        "start_stop_play",
        "get_console_output",
        "screen_capture",
        "start_stop_play",
      ]);
      assert.equal(client.calls[0]?.args.enabled, true);
      assert.equal(client.calls[3]?.args.enabled, false);
      const body = JSON.parse(result.content[0]?.text ?? "{}") as {
        ok: boolean;
        verdict: string;
        evidence: { screenshotPath: string | null };
      };
      assert.equal(body.ok, true);
      assert.match(body.verdict, /Supported/);
      assert.match(body.evidence.screenshotPath ?? "", /\.blockforge\/playtest\//);
      const saved = await readFile(
        join(projectPath, body.evidence.screenshotPath!),
        "utf8",
      );
      assert.equal(saved, "png-bytes");
      assert.equal(locks.isPlaytestHeld(), false);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });

  it("fails honestly when Play ran but capture is missing", async () => {
    const locks = new StudioLockManager();
    const client = new FakeStudioClient([{ name: "start_stop_play" }]);
    const result = await runPlaytestCheck(
      {
        sessionId: "s1",
        projectPath: "/tmp/unused",
        waitMs: 0,
      },
      { client, locks, sleep: async () => undefined },
    );
    const body = JSON.parse(result.content[0]?.text ?? "{}") as {
      ok: boolean;
      verdict: string;
    };
    assert.equal(body.ok, false);
    assert.match(body.verdict, /Do not assume 0 errors/);
    assert.equal(
      client.calls.filter((c) => c.name === "start_stop_play").length,
      2,
    );
  });

  it("does not claim success when mux Play is unavailable", async () => {
    const locks = new StudioLockManager();
    const client = new FakeStudioClient([], {}, "Unavailable");
    const result = await runPlaytestCheck(
      {
        sessionId: "s1",
        projectPath: "/tmp/does-not-exist",
        waitMs: 0,
      },
      { client, locks, sleep: async () => undefined },
    );
    const body = JSON.parse(result.content[0]?.text ?? "{}") as {
      ok: boolean;
      muxPlay: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.muxPlay, false);
    assert.equal(client.calls.length, 0);
  });
});

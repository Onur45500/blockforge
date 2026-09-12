import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StudioLockManager } from "./studio-locks.js";
import {
  HOST_MCP_TOOLS,
  LEASE_REQUIRED_MESSAGE,
  mergeMcpToolCatalogs,
  requireDriveLease,
} from "./mcp-tool-catalog.js";

describe("mcp-tool-catalog merge", () => {
  it("drops empty Studio names and lets host tools win collisions", () => {
    const merged = mergeMcpToolCatalogs(
      [
        {
          name: "start_stop_play",
          description: "host wrapper",
        },
      ],
      [
        { name: "" },
        { name: "   " },
        { name: "start_stop_play", description: "studio raw" },
        { name: "execute_luau" },
      ],
    );
    assert.equal(merged.droppedEmpty, 2);
    const names = merged.tools.map((t) => t.name);
    assert.deepEqual(names, ["start_stop_play", "execute_luau"]);
    const play = merged.tools.find((t) => t.name === "start_stop_play");
    assert.equal(play?.description, "host wrapper");
  });

  it("hides monetization tools when Open Cloud key is missing", () => {
    const merged = mergeMcpToolCatalogs(HOST_MCP_TOOLS, [], {
      hasOpenCloudKey: false,
    });
    const names = new Set(merged.tools.map((t) => t.name));
    assert.equal(names.has("upload_gamepass"), false);
    assert.equal(names.has("upload_devproduct"), false);
    assert.equal(names.has("playtest_check"), true);
  });

  it("keeps monetization tools when Open Cloud key is present", () => {
    const merged = mergeMcpToolCatalogs(HOST_MCP_TOOLS, [], {
      hasOpenCloudKey: true,
    });
    const names = new Set(merged.tools.map((t) => t.name));
    assert.equal(names.has("upload_gamepass"), true);
    assert.equal(names.has("upload_devproduct"), true);
  });
});

describe("drive tool lease gate", () => {
  it("errors when the session does not hold the Studio lease", () => {
    const locks = new StudioLockManager();
    const message = requireDriveLease("execute_luau", "s1", locks);
    assert.equal(message, LEASE_REQUIRED_MESSAGE);
  });

  it("renews when the session holds the lease", async () => {
    const locks = new StudioLockManager();
    await locks.waitForStudioTurn({ sessionId: "s1", projectPath: "/p" });
    const message = requireDriveLease("execute_luau", "s1", locks);
    assert.equal(message, null);
    assert.equal(locks.holdsStudioTurn("s1"), true);
    assert.equal(locks.renewStudioTurn("s1"), true);
  });

  it("does not gate read-only Studio tools", () => {
    const locks = new StudioLockManager();
    assert.equal(requireDriveLease("get_console_output", "", locks), null);
  });
});

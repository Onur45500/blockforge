import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unixProcessGroupSpawnOptions } from "./process-tree.js";

type FakeSession = {
  id: string;
  adapterId: string;
  projectPath: string;
  kind?: "agent" | "shell";
};

/** Mirrors PtyManager.listSessions filtering (kept pure for unit tests). */
function listSessions(
  sessions: FakeSession[],
  projectPath?: string,
  adapterId?: string,
  kind?: "agent" | "shell",
): FakeSession[] {
  return sessions.filter((session) => {
    if (projectPath && session.projectPath !== projectPath) {
      return false;
    }
    if (adapterId && session.adapterId !== adapterId) {
      return false;
    }
    if (kind && (session.kind ?? "agent") !== kind) {
      return false;
    }
    return true;
  });
}

describe("PtyManager session retain", () => {
  it("listSessions filters by project and adapter without mutating the set", () => {
    const sessions: FakeSession[] = [
      { id: "a1", adapterId: "claude-code", projectPath: "/proj/a" },
      { id: "b1", adapterId: "claude-code", projectPath: "/proj/b" },
      { id: "a2", adapterId: "codex", projectPath: "/proj/a" },
    ];

    assert.equal(listSessions(sessions, "/proj/a").length, 2);
    assert.equal(listSessions(sessions, "/proj/a", "claude-code").length, 1);
    assert.equal(listSessions(sessions, "/proj/b", "claude-code")[0]?.id, "b1");
    assert.equal(listSessions(sessions, "/proj/a", "opencode").length, 0);
    assert.equal(sessions.length, 3);
  });

  it("allows multiple sessions for the same adapter on one project", () => {
    const sessions: FakeSession[] = [
      { id: "lead", adapterId: "claude-code", projectPath: "/proj/a" },
      { id: "worker", adapterId: "claude-code", projectPath: "/proj/a" },
    ];
    assert.equal(listSessions(sessions, "/proj/a", "claude-code").length, 2);
  });

  it("filters shell sessions by kind without mixing adapters", () => {
    const sessions: FakeSession[] = [
      { id: "a1", adapterId: "claude-code", projectPath: "/proj/a", kind: "agent" },
      { id: "cmd1", adapterId: "cmd", projectPath: "/proj/a", kind: "shell" },
      { id: "cmd2", adapterId: "cmd", projectPath: "/proj/b", kind: "shell" },
    ];
    assert.equal(listSessions(sessions, "/proj/a", undefined, "shell").length, 1);
    assert.equal(listSessions(sessions, "/proj/a", undefined, "agent")[0]?.id, "a1");
    assert.equal(listSessions(sessions, "/proj/a", "claude-code").length, 1);
  });
});

describe("process-tree spawn options", () => {
  it("returns detached group options on non-Windows", () => {
    if (process.platform === "win32") {
      assert.deepEqual(unixProcessGroupSpawnOptions(), {});
    } else {
      const opts = unixProcessGroupSpawnOptions();
      assert.equal(opts.detached, true);
    }
  });
});

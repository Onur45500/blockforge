import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAgentPtySession,
  isShellPtySession,
  type PtySessionInfo,
} from "./ipc-types.js";

function session(kind: "agent" | "shell"): PtySessionInfo {
  return {
    sessionId: "s1",
    kind,
    adapterId: kind === "shell" ? "cmd" : "claude-code",
    projectPath: "/proj",
    status: "running",
    source: "ui",
    pinned: false,
    pid: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("pty session kind guards", () => {
  it("treats agent sessions as agents", () => {
    const agent = session("agent");
    assert.equal(isAgentPtySession(agent), true);
    assert.equal(isShellPtySession(agent), false);
  });

  it("treats shell sessions as shells", () => {
    const shell = session("shell");
    assert.equal(isAgentPtySession(shell), false);
    assert.equal(isShellPtySession(shell), true);
  });
});

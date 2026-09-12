import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RojoSyncStatus } from "../../shared/ipc-types.js";
import { studioSyncLabel, syncPillState, compilerHeadline } from "./sync-label.js";

function baseStatus(overrides: Partial<RojoSyncStatus> = {}): RojoSyncStatus {
  return {
    running: true,
    port: 34872,
    rbxtscRunning: true,
    rojoServeRunning: true,
    studioConnected: true,
    oneWaySyncWarning: true,
    lastError: null,
    compilerStatus: "idle",
    compilerLog: null,
    studioBridgeRunning: true,
    studioBridgeConnected: true,
    lastRuntimeError: null,
    studioWorldPresent: true,
    studioSyncStatus: "in-sync",
    studioWorldNames: ["SpawnPlatform"],
    studioMcpLauncherFound: true,
    studioMcpConnected: false,
    studioMcpDetail: "ok",
    foreignRojoPort: false,
    foreignRojoDetail: null,
    ...overrides,
  };
}

describe("studioSyncLabel", () => {
  it("describes world-missing with Connect guidance", () => {
    const label = studioSyncLabel(baseStatus({ studioSyncStatus: "world-missing" }));
    assert.match(label.text, /Connect/);
    assert.equal(label.badge, "missing");
  });
});

describe("syncPillState", () => {
  it("returns Sync while status is loading", () => {
    assert.deepEqual(syncPillState(null), { tone: "warn", text: "Sync" });
  });

  it("danger when Rojo stopped", () => {
    assert.deepEqual(
      syncPillState(
        baseStatus({
          running: false,
          rbxtscRunning: false,
          rojoServeRunning: false,
        }),
      ),
      { tone: "danger", text: "Rojo stopped" },
    );
  });

  it("danger when foreign port", () => {
    const state = syncPillState(
      baseStatus({ foreignRojoPort: true, port: 34901 }),
    );
    assert.equal(state.tone, "danger");
    assert.match(state.text, /Port 34901 in use/);
  });

  it("danger when lastError set", () => {
    assert.deepEqual(syncPillState(baseStatus({ lastError: "boom" })), {
      tone: "danger",
      text: "Rojo error",
    });
  });

  it("danger when TypeScript watch reports errors", () => {
    assert.deepEqual(
      syncPillState(
        baseStatus({
          compilerStatus: "error",
          compilerLog: "[17:05:04] Found 2 errors. Watching for file changes.",
          lastError: "TypeScript: 2 errors",
        }),
      ),
      { tone: "danger", text: "TypeScript errors" },
    );
  });

  it("ok when in sync", () => {
    assert.deepEqual(syncPillState(baseStatus()), {
      tone: "ok",
      text: "Studio in sync",
    });
  });

  it("warn with Connect Rojo when world-missing", () => {
    assert.deepEqual(
      syncPillState(baseStatus({ studioSyncStatus: "world-missing" })),
      { tone: "warn", text: "Connect Rojo plugin · port 34872" },
    );
  });

  it("appends lock label", () => {
    assert.deepEqual(syncPillState(baseStatus(), "Playtest busy"), {
      tone: "ok",
      text: "Studio in sync · Playtest busy",
    });
  });
});

describe("compilerHeadline", () => {
  it("formats a clean 0-error watch line", () => {
    assert.equal(
      compilerHeadline("ok", "[17:05:04] Found 0 errors. Watching for file changes."),
      "0 errors · watching · 17:05:04",
    );
  });

  it("formats N errors without ANSI leftovers", () => {
    assert.equal(
      compilerHeadline("error", "[17:05:04] Found 2 errors. Watching for file changes."),
      "2 errors · watching · 17:05:04",
    );
  });
});

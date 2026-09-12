import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StudioLockManager } from "./studio-locks.js";

describe("StudioLockManager", () => {
  it("grants studio turn immediately when free", async () => {
    const locks = new StudioLockManager();
    const status = await locks.waitForStudioTurn({
      sessionId: "a",
      projectPath: "/p",
    });
    assert.equal(status.studioHolderSessionId, "a");
  });

  it("queues second studio waiter until release", async () => {
    const locks = new StudioLockManager();
    await locks.waitForStudioTurn({ sessionId: "a", projectPath: "/p" });
    let acquired = false;
    const pending = locks
      .waitForStudioTurn({ sessionId: "b", projectPath: "/p", timeoutMs: 2000 })
      .then(() => {
        acquired = true;
      });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(acquired, false);
    await locks.releaseStudio("a");
    await pending;
    assert.equal(acquired, true);
    assert.equal(locks.getStatus().studioHolderSessionId, "b");
  });

  it("playtest is global exclusive", async () => {
    const locks = new StudioLockManager();
    await locks.acquirePlaytest({ sessionId: "a", projectPath: "/p1" });
    assert.equal(locks.isPlaytestHeld(), true);
    await locks.releasePlaytest("a");
    assert.equal(locks.isPlaytestHeld(), false);
  });

  it("releaseAllForSession clears both locks", async () => {
    const locks = new StudioLockManager();
    await locks.waitForStudioTurn({ sessionId: "x", projectPath: "/p" });
    await locks.acquirePlaytest({ sessionId: "x", projectPath: "/p" });
    await locks.releaseAllForSession("x");
    assert.equal(locks.getStatus().studioHolderSessionId, null);
    assert.equal(locks.getStatus().playtestHolderSessionId, null);
  });

  it("renews the studio lease for the current holder only", async () => {
    const locks = new StudioLockManager();
    await locks.waitForStudioTurn({ sessionId: "a", projectPath: "/p" });
    assert.equal(locks.holdsStudioTurn("a"), true);
    assert.equal(locks.renewStudioTurn("a"), true);
    assert.equal(locks.renewStudioTurn("b"), false);
  });
});

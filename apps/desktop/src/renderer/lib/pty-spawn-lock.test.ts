import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ptyStartLockKey, withPtyStartLock } from "./pty-spawn-lock.js";

describe("withPtyStartLock", () => {
  it("reuses one in-flight start for the same key", async () => {
    let starts = 0;
    const start = (): Promise<string> => {
      starts += 1;
      return new Promise((resolve) => {
        setTimeout(() => resolve(`session-${starts}`), 20);
      });
    };
    const key = ptyStartLockKey({
      kind: "shell",
      projectPath: "/p",
      label: "cmd 2",
    });
    const [a, b] = await Promise.all([
      withPtyStartLock(key, start),
      withPtyStartLock(key, start),
    ]);
    assert.equal(a, b);
    assert.equal(starts, 1);
  });
});

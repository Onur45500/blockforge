import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveShellLaunch, shellEnv } from "./shell-launch.js";

describe("resolveShellLaunch", () => {
  it("uses ComSpec for Windows CMD in the project folder", () => {
    const launch = resolveShellLaunch("G:/projects/demo", {
      platform: "win32",
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    });
    assert.equal(launch.file, "C:\\Windows\\System32\\cmd.exe");
    assert.deepEqual(launch.args, []);
    assert.equal(launch.cwd, "G:/projects/demo");
  });

  it("falls back to cmd.exe when ComSpec is missing", () => {
    const launch = resolveShellLaunch("G:/projects/demo", {
      platform: "win32",
      env: {},
    });
    assert.equal(launch.file, "cmd.exe");
    assert.equal(launch.cwd, "G:/projects/demo");
  });

  it("uses SHELL on non-Windows", () => {
    const launch = resolveShellLaunch("/tmp/proj", {
      platform: "linux",
      env: { SHELL: "/bin/zsh" },
    });
    assert.equal(launch.file, "/bin/zsh");
    assert.equal(launch.cwd, "/tmp/proj");
  });
});

describe("shellEnv", () => {
  it("copies host env and sets TERM plus project path", () => {
    const env = shellEnv("G:/projects/demo", {
      PATH: "/usr/bin",
    });
    assert.equal(env.TERM, "xterm-256color");
    assert.equal(env.PATH, "/usr/bin");
    assert.equal(env.BLOCKFORGE_PROJECT_PATH, "G:/projects/demo");
  });
});

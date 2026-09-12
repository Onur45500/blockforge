import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOpenDocks, terminalTitle, nextUiTerminalLabel, nextShellLabel } from "./workspace-types.js";

describe("normalizeOpenDocks", () => {
  it("keeps agents plus at most one tool", () => {
    assert.deepEqual(normalizeOpenDocks(["sync", "git", "agents", "assets"]), [
      "agents",
      "assets",
    ]);
  });

  it("keeps agents, terminal, and at most one tool", () => {
    assert.deepEqual(normalizeOpenDocks(["sync", "terminal", "agents", "git"]), [
      "terminal",
      "agents",
      "git",
    ]);
  });

  it("preserves bottom dock selection order", () => {
    assert.deepEqual(normalizeOpenDocks(["agents", "terminal"]), [
      "agents",
      "terminal",
    ]);
    assert.deepEqual(normalizeOpenDocks(["terminal", "agents"]), [
      "terminal",
      "agents",
    ]);
  });

  it("allows agents alone", () => {
    assert.deepEqual(normalizeOpenDocks(["agents"]), ["agents"]);
  });

  it("allows a single tool", () => {
    assert.deepEqual(normalizeOpenDocks(["publish"]), ["publish"]);
  });

  it("returns empty for empty", () => {
    assert.deepEqual(normalizeOpenDocks([]), []);
  });
});

describe("terminalTitle", () => {
  it("calls the lead Main agent", () => {
    assert.equal(terminalTitle({ label: "Lead", isLead: true }), "Main agent");
  });

  it("calls a scratch window Extra agent", () => {
    assert.equal(terminalTitle({ label: "scratch", isLead: false }), "Extra agent");
    assert.equal(
      terminalTitle({ label: "scratch", isLead: false, extraNumber: 2 }),
      "Extra agent 2",
    );
  });

  it("does not use the CLI name as the window title", () => {
    assert.equal(terminalTitle({ label: "Claude Code", isLead: false }), "Extra agent");
  });

  it("humanizes agent-spawned roles", () => {
    assert.equal(
      terminalTitle({ label: "world-builder", isLead: false }),
      "World Builder",
    );
  });
});

describe("nextUiTerminalLabel", () => {
  it("uses Lead when none exists yet", () => {
    assert.equal(nextUiTerminalLabel({ hasLead: false, existingLabels: [] }), "Lead");
  });

  it("uses scratch then scratch-2 for extras", () => {
    assert.equal(nextUiTerminalLabel({ hasLead: true, existingLabels: [] }), "scratch");
    assert.equal(
      nextUiTerminalLabel({ hasLead: true, existingLabels: ["Lead", "scratch"] }),
      "scratch-2",
    );
  });
});

describe("nextShellLabel", () => {
  it("starts at cmd then numbers extras", () => {
    assert.equal(nextShellLabel([]), "cmd");
    assert.equal(nextShellLabel(["cmd"]), "cmd 2");
    assert.equal(nextShellLabel(["cmd", "cmd 2"]), "cmd 3");
  });
});

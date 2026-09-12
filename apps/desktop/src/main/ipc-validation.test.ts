import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseIpc,
  projectPathSchema,
  ptyStartSchema,
} from "./ipc-validation.js";

describe("ipc-validation", () => {
  it("accepts valid pty start payloads", () => {
    const parsed = parseIpc(
      ptyStartSchema,
      {
        projectPath: "G:/projects/demo",
        cols: 80,
        rows: 24,
        adapterId: "claude-code",
      },
      "pty:start",
    );
    assert.equal(parsed.cols, 80);
  });

  it("accepts labeled multi-session pty start payloads", () => {
    const parsed = parseIpc(
      ptyStartSchema,
      {
        projectPath: "G:/projects/demo",
        cols: 120,
        rows: 32,
        adapterId: "claude-code",
        label: "world-builder",
        role: "world-builder",
        source: "agent",
        focus: false,
      },
      "pty:start",
    );
    assert.equal(parsed.label, "world-builder");
    assert.equal(parsed.source, "agent");
    assert.equal(parsed.focus, false);
  });

  it("accepts shell pty start payloads", () => {
    const parsed = parseIpc(
      ptyStartSchema,
      {
        projectPath: "G:/projects/demo",
        cols: 80,
        rows: 24,
        kind: "shell",
        label: "cmd",
        source: "ui",
      },
      "pty:start",
    );
    assert.equal(parsed.kind, "shell");
    assert.equal(parsed.label, "cmd");
  });

  it("rejects unknown pty kinds", () => {
    assert.throws(() =>
      parseIpc(
        ptyStartSchema,
        {
          projectPath: "G:/projects/demo",
          cols: 80,
          rows: 24,
          kind: "powershell",
        },
        "pty:start",
      ),
    );
  });

  it("rejects empty project paths", () => {
    assert.throws(() => parseIpc(projectPathSchema, "", "projectPath"));
  });
});

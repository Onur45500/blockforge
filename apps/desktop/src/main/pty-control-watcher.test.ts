import assert from "node:assert/strict";
import { describe, it } from "node:test";

type AgentUiCommand = {
  op: "spawn-terminal" | "focus-terminal" | "close-terminal" | "pin-terminal";
  adapterId?: string;
  label?: string;
  role?: string;
  sessionId?: string;
  focus?: boolean;
  pinned?: boolean;
};

/** Mirrors PtyControlWatcher.parseCommand for unit testing. */
function parseCommand(line: string): AgentUiCommand | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(trimmed);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    const obj = raw as Record<string, unknown>;
    const op = obj.op;
    if (
      op !== "spawn-terminal" &&
      op !== "focus-terminal" &&
      op !== "close-terminal" &&
      op !== "pin-terminal"
    ) {
      return null;
    }
    return {
      op,
      adapterId: typeof obj.adapterId === "string" ? obj.adapterId : undefined,
      label: typeof obj.label === "string" ? obj.label : undefined,
      role: typeof obj.role === "string" ? obj.role : undefined,
      sessionId: typeof obj.sessionId === "string" ? obj.sessionId : undefined,
      focus: typeof obj.focus === "boolean" ? obj.focus : undefined,
      pinned: typeof obj.pinned === "boolean" ? obj.pinned : undefined,
    };
  } catch {
    return null;
  }
}

describe("agent-ui-commands parse", () => {
  it("parses spawn-terminal lines", () => {
    const cmd = parseCommand(
      '{"op":"spawn-terminal","adapterId":"claude-code","label":"world-builder","focus":false}',
    );
    assert.equal(cmd?.op, "spawn-terminal");
    assert.equal(cmd?.label, "world-builder");
    assert.equal(cmd?.focus, false);
  });

  it("rejects malformed lines", () => {
    assert.equal(parseCommand("not-json"), null);
    assert.equal(parseCommand('{"op":"nope"}'), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCompilerChunk,
  classifyCompilerOutput,
  compilerErrorSummary,
  stripAnsi,
} from "./compiler-output.js";

describe("stripAnsi", () => {
  it("removes rbxtsc gray timestamps", () => {
    const raw = "[\u001B[90m17:05:04\u001B[0m] Found 0 errors. Watching for file changes.";
    assert.equal(stripAnsi(raw), "[17:05:04] Found 0 errors. Watching for file changes.");
  });
});

describe("classifyCompilerOutput", () => {
  it("treats Found 0 errors as ok, not an error", () => {
    const raw = "[\u001B[90m17:05:04\u001B[0m] Found 0 errors. Watching for file changes.";
    const result = classifyCompilerOutput(raw);
    assert.equal(result.kind, "ok");
    assert.equal(result.text, "[17:05:04] Found 0 errors. Watching for file changes.");
  });

  it("treats Found N errors as error", () => {
    const result = classifyCompilerOutput("[17:05:04] Found 3 errors. Watching for file changes.");
    assert.equal(result.kind, "error");
  });

  it("treats TS diagnostics as error", () => {
    const result = classifyCompilerOutput(
      "src/server/main.server.ts:12:5 - error TS2322: Type 'string' is not assignable to type 'number'.",
    );
    assert.equal(result.kind, "error");
  });

  it("ignores start-up lines", () => {
    const result = classifyCompilerOutput("Starting compilation in watch mode...");
    assert.equal(result.kind, "ignore");
  });
});

describe("applyCompilerChunk", () => {
  it("clears a previous error on a clean watch pass", () => {
    const errored = applyCompilerChunk(
      { status: "idle", log: null },
      "src/foo.ts:1:1 - error TS2304: Cannot find name 'x'.",
    );
    assert.equal(errored.status, "error");
    const ok = applyCompilerChunk(
      errored,
      "[17:05:04] Found 0 errors. Watching for file changes.",
    );
    assert.equal(ok.status, "ok");
    assert.match(ok.log ?? "", /Found 0 errors/);
    assert.equal(compilerErrorSummary(ok.log), null);
  });

  it("summarizes Found N errors", () => {
    const state = applyCompilerChunk(
      { status: "idle", log: null },
      "[17:05:04] Found 2 errors. Watching for file changes.",
    );
    assert.equal(compilerErrorSummary(state.log), "TypeScript: 2 errors");
  });
});

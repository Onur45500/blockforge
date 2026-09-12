import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  listNotes,
  NotesSandboxError,
  readNotesFile,
  resolveSandboxedNotesPath,
  writeNotesFile,
} from "./mcp-notes-service.js";

describe("notes path sandbox", () => {
  it("rejects .. and absolute paths", () => {
    assert.throws(
      () => resolveSandboxedNotesPath("/proj", "../secrets.md"),
      NotesSandboxError,
    );
    assert.throws(
      () => resolveSandboxedNotesPath("/proj", "/etc/passwd"),
      NotesSandboxError,
    );
  });

  it("lists, writes, and reads under notes/", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-notes-"));
    await mkdir(join(dir, "notes"), { recursive: true });
    await writeNotesFile(dir, "design/gdd.md", "# Hello");
    const listed = await listNotes(dir);
    assert.ok(listed.some((e) => e.path === "design/gdd.md"));
    assert.equal(await readNotesFile(dir, "design/gdd.md"), "# Hello");
    assert.equal(await readFile(join(dir, "notes", "design", "gdd.md"), "utf8"), "# Hello");
  });
});

import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, describe, it } from "node:test";
import { findRobloxStudio } from "./doctor.js";

describe("findRobloxStudio", () => {
  let fakeLocalAppData: string;

  before(async () => {
    fakeLocalAppData = join(tmpdir(), `blockforge-localapp-${Date.now()}`);
    const versionDir = join(
      fakeLocalAppData,
      "Roblox",
      "Versions",
      "version-abcdef",
    );
    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, "RobloxStudioBeta.exe"), "stub");
  });

  after(async () => {
    await rm(fakeLocalAppData, { recursive: true, force: true });
  });

  it("finds RobloxStudioBeta.exe under LOCALAPPDATA\\Roblox\\Versions", async () => {
    const found = await findRobloxStudio(fakeLocalAppData);
    assert.ok(found);
    assert.match(found, /RobloxStudioBeta\.exe$/i);
  });

  it("returns null when Studio is not installed there", async () => {
    const empty = join(tmpdir(), `blockforge-empty-${Date.now()}`);
    await mkdir(empty, { recursive: true });
    try {
      const found = await findRobloxStudio(empty);
      assert.equal(found, null);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

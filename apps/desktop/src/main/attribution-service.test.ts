import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  listAttribution,
  recordAttribution,
} from "./attribution-service.js";

describe("attribution-service", () => {
  it("writes ATTRIBUTION.md and lists rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-attr-"));
    await mkdir(join(dir, ".blockforge"), { recursive: true });
    await recordAttribution(dir, {
      catalogId: "kenney_crate",
      name: "Wooden Crate",
      license: "CC0",
      attribution: "Kenney",
      source: "https://kenney.nl",
      key: "crate",
    });
    const file = await listAttribution(dir);
    assert.equal(file.entries.length, 1);
    assert.equal(file.entries[0].catalogId, "kenney_crate");
    const md = await import("node:fs/promises").then((fs) =>
      fs.readFile(join(dir, "ATTRIBUTION.md"), "utf8"),
    );
    assert.match(md, /Wooden Crate/);
    assert.match(md, /CC0/);
  });
});

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  lookupUploadedAsset,
  searchSimilarAssets,
} from "./mcp-asset-lookup.js";
import type { AssetCatalogEntry } from "../shared/ipc-types.js";

describe("lookupUploadedAsset", () => {
  it("resolves rbxassetid from assets.json and assets.ts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-lookup-"));
    await writeFile(
      join(dir, "assets.json"),
      JSON.stringify({
        assets: {
          coin: { assetId: "rbxassetid://123", sourceCatalogId: "kenney-coin" },
        },
      }),
      "utf8",
    );
    await mkdir(join(dir, "src", "shared"), { recursive: true });
    await writeFile(
      join(dir, "src", "shared", "assets.ts"),
      `export const assets = { gem: "rbxassetid://999" };\n`,
      "utf8",
    );
    const byId = await lookupUploadedAsset(dir, "rbxassetid://123");
    assert.equal(byId.hits.length, 1);
    assert.equal(byId.hits[0]?.key, "coin");
    const byTs = await lookupUploadedAsset(dir, "999");
    assert.equal(byTs.hits[0]?.key, "gem");
  });
});

describe("searchSimilarAssets", () => {
  it("ranks local tag/name overlap", () => {
    const entries: AssetCatalogEntry[] = [
      {
        id: "tree-1",
        name: "Pine Tree",
        type: "model",
        category: "environment",
        tags: ["tree", "forest"],
        uploadSupported: true,
      },
      {
        id: "ui-1",
        name: "Button",
        type: "image",
        category: "ui",
        tags: ["button"],
        uploadSupported: true,
      },
    ];
    const hits = searchSimilarAssets(entries, "forest tree", 10);
    assert.equal(hits[0]?.id, "tree-1");
  });
});

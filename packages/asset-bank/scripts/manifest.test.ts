import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateAssetsTs, type ProjectAssetsManifest } from "./types.js";

describe("generateAssetsTs", () => {
  it("emits typed constants for uploaded assets", () => {
    const manifest: ProjectAssetsManifest = {
      templateVersion: "0.1.0",
      createdWith: "blockforge",
      assets: {
        kenney_crate: {
          robloxAssetId: "123",
          assetType: "Model",
          uploadedAt: "2026-01-01T00:00:00.000Z",
          license: "CC0",
          bankId: "kenney_crate",
        },
      },
    };
    const out = generateAssetsTs(manifest);
    assert.match(out, /kenney_crate: "rbxassetid:\/\/123"/);
    assert.match(out, /export type AssetKey/);
  });
});

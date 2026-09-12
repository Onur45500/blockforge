import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateAssetsTs,
  inferAssetType,
  mapBankCatalogToEntries,
  mimeForPreviewPath,
} from "../shared/asset-helpers.js";

describe("inferAssetType", () => {
  it("maps fbx to Model", () => {
    assert.equal(inferAssetType("crate.fbx"), "Model");
  });

  it("maps png/jpg to Decal", () => {
    assert.equal(inferAssetType("icon.png"), "Decal");
    assert.equal(inferAssetType("photo.jpg"), "Decal");
  });

  it("maps audio extensions to Audio", () => {
    assert.equal(inferAssetType("jump.ogg"), "Audio");
    assert.equal(inferAssetType("hit.mp3"), "Audio");
  });

  it("returns null for unsupported types", () => {
    assert.equal(inferAssetType("mesh.obj"), null);
  });
});

describe("mapBankCatalogToEntries", () => {
  it("sets uploadSupported false for audio", () => {
    const entries = mapBankCatalogToEntries([
      {
        id: "sfx",
        name: "Jump",
        kind: "audio",
        tags: ["sfx"],
        uploadSupported: false,
      },
    ]);
    assert.equal(entries[0]?.type, "audio");
    assert.equal(entries[0]?.uploadSupported, false);
  });

  it("defaults audio without flag to preview-only", () => {
    const entries = mapBankCatalogToEntries([
      { id: "music", name: "Loop", kind: "audio", tags: [] },
    ]);
    assert.equal(entries[0]?.uploadSupported, false);
  });

  it("maps model files with upload support", () => {
    const entries = mapBankCatalogToEntries([
      {
        id: "crate",
        name: "Crate",
        kind: "model",
        file: "fixtures/sample.fbx",
        tags: ["prop"],
        uploadSupported: true,
      },
    ]);
    assert.equal(entries[0]?.type, "model");
    assert.equal(entries[0]?.filePath, "fixtures/sample.fbx");
    assert.equal(entries[0]?.uploadSupported, true);
  });
});

describe("generateAssetsTs", () => {
  it("emits rbxassetid constants", () => {
    const out = generateAssetsTs({
      kenney_crate: {
        key: "kenney_crate",
        assetId: "12345",
        displayName: "Crate",
        uploadedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    assert.match(out, /"kenney_crate": "rbxassetid:\/\/12345"/);
    assert.match(out, /export type AssetKey/);
  });
});

describe("mimeForPreviewPath", () => {
  it("maps image extensions", () => {
    assert.deepEqual(mimeForPreviewPath("a.png"), {
      kind: "image",
      mime: "image/png",
    });
    assert.deepEqual(mimeForPreviewPath("b.jpg"), {
      kind: "image",
      mime: "image/jpeg",
    });
  });

  it("maps audio extensions", () => {
    assert.deepEqual(mimeForPreviewPath("jump.ogg"), {
      kind: "audio",
      mime: "audio/ogg",
    });
    assert.deepEqual(mimeForPreviewPath("hit.mp3"), {
      kind: "audio",
      mime: "audio/mpeg",
    });
  });

  it("maps model extensions with mime", () => {
    assert.deepEqual(mimeForPreviewPath("crate.fbx"), {
      kind: "model",
      mime: "application/octet-stream",
    });
    assert.deepEqual(mimeForPreviewPath("prop.glb"), {
      kind: "model",
      mime: "model/gltf-binary",
    });
  });

  it("returns none for unknown types", () => {
    assert.deepEqual(mimeForPreviewPath("notes.txt"), {
      kind: "none",
      mime: null,
    });
  });
});

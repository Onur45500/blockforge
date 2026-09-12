import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCuratedCatalogAssets } from "./seed.js";

describe("buildCuratedCatalogAssets", () => {
  const assets = buildCuratedCatalogAssets();

  it("produces unique CC0 entries (no dummy _vN padding)", () => {
    assert.ok(assets.length >= 700, `expected >= 700, got ${assets.length}`);
    const ids = assets.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.equal(/_v\d+$/.test(id), false, id);
    }
  });

  it("covers Kenney pack gaps (food, castle, vehicles, UI icons)", () => {
    const ids = new Set(assets.map((a) => a.id));
    assert.ok(ids.has("kenney_food_burger"));
    assert.ok(ids.has("kenney_castle_keep"));
    assert.ok(ids.has("kenney_veh_sedan"));
    assert.ok(ids.has("kenney_ui_icon_quest"));
    assert.ok(ids.has("ph_asphalt_02"));
  });

  it("covers deep Kenney / Quaternius / Poly Haven packs", () => {
    const ids = new Set(assets.map((a) => a.id));
    assert.ok(ids.has("kenney_fact_conveyor"));
    assert.ok(ids.has("kenney_ftown_inn"));
    assert.ok(ids.has("kenney_train_loco"));
    assert.ok(ids.has("kenney_gicon_attack"));
    assert.ok(ids.has("quat_spaceship_fighter"));
    assert.ok(ids.has("ph_wood_table_worn"));
    assert.ok(ids.has("ph_model_jacaranda_tree"));
  });

  it("marks every audio asset as preview-only", () => {
    const audio = assets.filter((a) => a.kind === "audio");
    assert.ok(audio.length > 0);
    for (const entry of audio) {
      assert.equal(entry.uploadSupported, false, entry.id);
    }
  });

  it("includes upload-supported fixture assets", () => {
    const png = assets.find((a) => a.id === "fixture_sample_png");
    const fbx = assets.find((a) => a.id === "fixture_sample_fbx");
    assert.ok(png);
    assert.ok(fbx);
    assert.equal(png?.uploadSupported, true);
    assert.equal(fbx?.uploadSupported, true);
  });

  it("covers ambientCG CC0 materials", () => {
    const ids = new Set(assets.map((a) => a.id));
    assert.ok(ids.has("acg_grass001"));
    assert.ok(ids.has("acg_woodfloor051"));
    assert.ok(ids.has("acg_pavingstones070"));
    assert.ok(ids.has("acg_hdri_dayskyhdri015a"));
  });

  it("licenses every entry as CC0", () => {
    for (const entry of assets) {
      assert.equal(entry.license, "CC0", entry.id);
    }
  });
});

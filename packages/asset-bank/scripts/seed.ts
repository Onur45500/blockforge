/**
 * Curated CC0 seed list for Blockforge asset bank.
 * Sources: Kenney.nl, Quaternius, Poly Haven, ambientCG — all CC0 1.0.
 * Ingest attaches local fixtures; remote binaries stay opt-in.
 */
import type { CatalogAsset } from "./types.js";
import {
  KENNEY_PACK_ASSETS,
  POLY_HAVEN_PACK_ASSETS,
  QUATERNIUS_PACK_ASSETS,
} from "./seed-packs.js";
import {
  KENNEY_DEEP_ASSETS,
  POLY_HAVEN_DEEP_ASSETS,
  QUATERNIUS_DEEP_ASSETS,
} from "./seed-packs-deep.js";
import { AMBIENTCG_ASSETS, KENNEY_AUDIO_EXTRA } from "./seed-cc0-sources.js";

/** Helper to stamp Kenney CC0 metadata */
function kenney(
  partial: Omit<CatalogAsset, "license" | "attribution" | "source" | "uploadSupported"> & {
    uploadSupported?: boolean;
  },
): CatalogAsset {
  return {
    license: "CC0",
    attribution: "Kenney (https://kenney.nl) — CC0 1.0",
    source: "https://kenney.nl",
    uploadSupported: partial.uploadSupported ?? partial.kind !== "audio",
    ...partial,
  };
}

export const SEED_ASSETS: CatalogAsset[] = [
  // Local fixtures always present
  {
    id: "fixture_sample_png",
    name: "Sample Decal (fixture)",
    category: "ui",
    kind: "image",
    tags: ["fixture", "test"],
    license: "CC0",
    attribution: "Blockforge fixture",
    source: "local",
    file: "fixtures/sample.png",
    thumbnail: "fixtures/sample.png",
    uploadSupported: true,
  },
  {
    id: "fixture_sample_fbx",
    name: "Sample Model (fixture)",
    category: "prop",
    kind: "model",
    tags: ["fixture", "test"],
    license: "CC0",
    attribution: "Blockforge fixture",
    source: "local",
    file: "fixtures/sample.fbx",
    uploadSupported: true,
  },

  // Curated Kenney-style catalog entries (metadata). Ingest fills `file` when
  // a pack zip is present under .cache/packs. Tags support in-app search.
  ...[
    ["kenney_crate", "Wooden Crate", "prop", "crate", "box", "wood"],
    ["kenney_barrel", "Barrel", "prop", "barrel", "wood"],
    ["kenney_chest", "Treasure Chest", "prop", "chest", "loot"],
    ["kenney_coin", "Coin", "prop", "coin", "currency"],
    ["kenney_gem", "Gem", "prop", "gem", "currency"],
    ["kenney_potion", "Potion Bottle", "prop", "potion", "item"],
    ["kenney_sword", "Sword", "prop", "weapon", "sword"],
    ["kenney_shield", "Shield", "prop", "shield", "armor"],
    ["kenney_bow", "Bow", "prop", "weapon", "bow"],
    ["kenney_arrow", "Arrow", "prop", "ammo", "arrow"],
    ["kenney_tree", "Tree", "environment", "tree", "nature"],
    ["kenney_rock", "Rock", "environment", "rock", "nature"],
    ["kenney_bush", "Bush", "environment", "bush", "nature"],
    ["kenney_grass", "Grass Tuft", "environment", "grass", "nature"],
    ["kenney_fence", "Fence", "environment", "fence"],
    ["kenney_bridge", "Bridge", "environment", "bridge"],
    ["kenney_tower", "Tower", "environment", "tower", "building"],
    ["kenney_house", "House", "environment", "house", "building"],
    ["kenney_tent", "Tent", "environment", "tent", "camp"],
    ["kenney_campfire", "Campfire", "environment", "fire", "camp"],
    ["kenney_character_male", "Character Male", "character", "npc", "male"],
    ["kenney_character_female", "Character Female", "character", "npc", "female"],
    ["kenney_enemy_slime", "Slime Enemy", "character", "enemy", "slime"],
    ["kenney_enemy_skeleton", "Skeleton", "character", "enemy", "undead"],
    ["kenney_enemy_goblin", "Goblin", "character", "enemy", "goblin"],
    ["kenney_vehicle_car", "Car", "prop", "vehicle", "car"],
    ["kenney_vehicle_truck", "Truck", "prop", "vehicle", "truck"],
    ["kenney_spaceship", "Spaceship", "prop", "space", "vehicle"],
    ["kenney_platform", "Platform", "environment", "platform", "obby"],
    ["kenney_spike", "Spike Trap", "prop", "trap", "hazard"],
    ["kenney_door", "Door", "prop", "door"],
    ["kenney_key", "Key", "prop", "key", "item"],
    ["kenney_heart", "Heart Pickup", "ui", "health", "pickup"],
    ["kenney_star", "Star Pickup", "ui", "star", "pickup"],
    ["kenney_flag", "Flag", "prop", "flag", "checkpoint"],
    ["kenney_sign", "Sign", "prop", "sign"],
    ["kenney_ladder", "Ladder", "prop", "ladder"],
    ["kenney_torch", "Torch", "prop", "light", "torch"],
    ["kenney_lantern", "Lantern", "prop", "light", "lantern"],
    ["kenney_bench", "Bench", "prop", "furniture"],
    ["kenney_table", "Table", "prop", "furniture"],
    ["kenney_chair", "Chair", "prop", "furniture"],
    ["kenney_bed", "Bed", "prop", "furniture"],
    ["kenney_bookshelf", "Bookshelf", "prop", "furniture"],
    ["kenney_fountain", "Fountain", "environment", "water"],
    ["kenney_well", "Well", "environment", "water"],
    ["kenney_path_stone", "Stone Path", "environment", "path"],
    ["kenney_wall_stone", "Stone Wall", "environment", "wall"],
    ["kenney_gate", "Gate", "environment", "gate"],
    ["kenney_cloud", "Cloud", "environment", "sky"],
  ].map(([id, name, category, ...tags]) =>
    kenney({
      id: String(id),
      name: String(name),
      category: category as CatalogAsset["category"],
      kind: "model",
      tags: tags.map(String),
    }),
  ),

  // UI / image entries
  ...[
    ["kenney_ui_button", "UI Button", "button"],
    ["kenney_ui_panel", "UI Panel", "panel"],
    ["kenney_ui_icon_coin", "Icon Coin", "icon", "coin"],
    ["kenney_ui_icon_heart", "Icon Heart", "icon", "heart"],
    ["kenney_ui_icon_star", "Icon Star", "icon", "star"],
    ["kenney_ui_icon_settings", "Icon Settings", "icon", "settings"],
    ["kenney_ui_bar_health", "Health Bar", "bar", "health"],
    ["kenney_ui_bar_xp", "XP Bar", "bar", "xp"],
    ["kenney_texture_dirt", "Dirt Texture", "texture", "dirt"],
    ["kenney_texture_stone", "Stone Texture", "texture", "stone"],
    ["kenney_texture_wood", "Wood Texture", "texture", "wood"],
    ["kenney_texture_grass", "Grass Texture", "texture", "grass"],
    ["kenney_texture_water", "Water Texture", "texture", "water"],
    ["kenney_texture_metal", "Metal Texture", "texture", "metal"],
    ["kenney_texture_sand", "Sand Texture", "texture", "sand"],
  ].map(([id, name, ...tags]) =>
    kenney({
      id: String(id),
      name: String(name),
      category: "ui",
      kind: "image",
      tags: tags.map(String),
      uploadSupported: true,
    }),
  ),

  // Audio — preview only (uploadSupported: false)
  ...[
    ["kenney_sfx_jump", "Jump", "jump"],
    ["kenney_sfx_coin", "Coin Pickup", "coin"],
    ["kenney_sfx_hit", "Hit", "combat"],
    ["kenney_sfx_explosion", "Explosion", "explosion"],
    ["kenney_sfx_click", "UI Click", "ui"],
    ["kenney_sfx_powerup", "Power Up", "powerup"],
    ["kenney_music_loop_adventure", "Adventure Loop", "music"],
    ["kenney_music_loop_battle", "Battle Loop", "music"],
  ].map(([id, name, ...tags]) =>
    kenney({
      id: String(id),
      name: String(name),
      category: "audio",
      kind: "audio",
      tags: tags.map(String),
      uploadSupported: false,
    }),
  ),
];

/** Unique CC0 catalog (no numbered dummy variants). */
export function buildCuratedCatalogAssets(): CatalogAsset[] {
  const assets = [
    ...SEED_ASSETS,
    ...QUATERNIUS_ASSETS,
    ...POLY_HAVEN_ASSETS,
    ...KENNEY_PACK_ASSETS,
    ...QUATERNIUS_PACK_ASSETS,
    ...POLY_HAVEN_PACK_ASSETS,
    ...KENNEY_DEEP_ASSETS,
    ...QUATERNIUS_DEEP_ASSETS,
    ...POLY_HAVEN_DEEP_ASSETS,
    ...AMBIENTCG_ASSETS,
    ...KENNEY_AUDIO_EXTRA,
  ];
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.id)) {
      throw new Error(`Duplicate catalog id: ${asset.id}`);
    }
    seen.add(asset.id);
  }
  return assets;
}

function quaternius(
  partial: Omit<CatalogAsset, "license" | "attribution" | "source" | "uploadSupported"> & {
    uploadSupported?: boolean;
  },
): CatalogAsset {
  return {
    license: "CC0",
    attribution: "Quaternius (https://quaternius.com) — CC0 1.0",
    source: "https://quaternius.com",
    uploadSupported: partial.uploadSupported ?? partial.kind !== "audio",
    packId: "quaternius-cc0",
    ...partial,
  };
}

function polyHaven(
  partial: Omit<CatalogAsset, "license" | "attribution" | "source" | "uploadSupported"> & {
    uploadSupported?: boolean;
  },
): CatalogAsset {
  return {
    license: "CC0",
    attribution: "Poly Haven (https://polyhaven.com) — CC0 1.0",
    source: "https://polyhaven.com",
    uploadSupported: partial.uploadSupported ?? partial.kind === "texture",
    packId: "polyhaven-cc0",
    ...partial,
  };
}

export const QUATERNIUS_ASSETS: CatalogAsset[] = [
  ["quat_tree_pine", "Pine Tree", "environment", "tree", "pine"],
  ["quat_tree_oak", "Oak Tree", "environment", "tree", "oak"],
  ["quat_rock_large", "Large Rock", "environment", "rock"],
  ["quat_rock_small", "Small Rock", "environment", "rock"],
  ["quat_grass_clump", "Grass Clump", "environment", "grass"],
  ["quat_flower_red", "Red Flower", "environment", "flower"],
  ["quat_mushroom", "Mushroom", "environment", "mushroom"],
  ["quat_fence_wood", "Wood Fence", "environment", "fence"],
  ["quat_building_hut", "Hut", "environment", "building"],
  ["quat_character_rpg", "RPG Character", "character", "npc"],
  ["quat_enemy_orc", "Orc", "character", "enemy"],
  ["quat_prop_barrel", "Barrel", "prop", "barrel"],
  ["quat_prop_crate", "Crate", "prop", "crate"],
  ["quat_prop_cart", "Cart", "prop", "cart"],
  ["quat_weapon_axe", "Axe", "prop", "weapon"],
].map(([id, name, category, ...tags]) =>
  quaternius({
    id: String(id),
    name: String(name),
    category: category as CatalogAsset["category"],
    kind: "model",
    tags: tags.map(String),
  }),
);

export const POLY_HAVEN_ASSETS: CatalogAsset[] = [
  polyHaven({
    id: "ph_texture_brick_01",
    name: "Brick Wall 01",
    category: "texture",
    kind: "texture",
    tags: ["brick", "wall", "pbr"],
    downloadUrl: "https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/brick_wall_001/brick_wall_001_diff_1k.png",
    uploadSupported: true,
  }),
  polyHaven({
    id: "ph_texture_wood_floor",
    name: "Wood Floor",
    category: "texture",
    kind: "texture",
    tags: ["wood", "floor", "pbr"],
    uploadSupported: true,
  }),
  polyHaven({
    id: "ph_texture_metal_plate",
    name: "Metal Plate",
    category: "texture",
    kind: "texture",
    tags: ["metal", "pbr"],
    uploadSupported: true,
  }),
  polyHaven({
    id: "ph_texture_gravel",
    name: "Gravel",
    category: "texture",
    kind: "texture",
    tags: ["gravel", "ground", "pbr"],
    uploadSupported: true,
  }),
  polyHaven({
    id: "ph_hdri_studio",
    name: "Studio HDRI (preview)",
    category: "texture",
    kind: "hdri",
    tags: ["hdri", "studio", "lighting"],
    uploadSupported: false,
  }),
  polyHaven({
    id: "ph_hdri_sky_clear",
    name: "Clear Sky HDRI (preview)",
    category: "texture",
    kind: "hdri",
    tags: ["hdri", "sky"],
    uploadSupported: false,
  }),
];

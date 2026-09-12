#!/usr/bin/env node
/**
 * Lint every world/*.model.json for Blockforge agent / CI use.
 * Exit 0 on success; non-zero with actionable stderr messages on failure.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WORLD_DIR = join(ROOT, "world");

const KNOWN_CLASS_NAMES = new Set([
  "Model",
  "Folder",
  "Part",
  "SpawnLocation",
  "MeshPart",
  "WedgePart",
  "CornerWedgePart",
  "TrussPart",
  "UnionOperation",
  "PointLight",
  "SpotLight",
  "SurfaceLight",
  "Attachment",
  "Bone",
  "Decal",
  "Texture",
  "SpecialMesh",
  "BlockMesh",
  "CylinderMesh",
  "Fire",
  "Smoke",
  "Sparkles",
  "ParticleEmitter",
  "Beam",
  "Trail",
  "StringValue",
  "BoolValue",
  "NumberValue",
  "IntValue",
  "ObjectValue",
  "Vector3Value",
  "CFrameValue",
  "Color3Value",
]);

const BASE_PART_CLASSES = new Set([
  "Part",
  "SpawnLocation",
  "MeshPart",
  "WedgePart",
  "CornerWedgePart",
  "TrussPart",
  "UnionOperation",
]);

const KNOWN_MATERIALS = new Set([
  "Plastic",
  "SmoothPlastic",
  "Neon",
  "Wood",
  "WoodPlanks",
  "Marble",
  "Slate",
  "Concrete",
  "Granite",
  "Brick",
  "Pebble",
  "Cobblestone",
  "CorrodedMetal",
  "DiamondPlate",
  "Foil",
  "Metal",
  "Grass",
  "Sand",
  "Fabric",
  "Ice",
  "Glass",
  "ForceField",
  "Air",
  "Water",
  "Rock",
  "Glacier",
  "Snow",
  "Sandstone",
  "Mud",
  "Basalt",
  "Ground",
  "CrackedLava",
  "Asphalt",
  "LeafyGrass",
  "Salt",
  "Limestone",
  "Pavement",
]);

const VECTOR3_PROPS = new Set(["Size", "Position", "Orientation", "Rotation"]);
const COLOR_PROPS = new Set(["Color", "Color3"]);
const BOOL_PROPS = new Set([
  "Anchored",
  "CanCollide",
  "CanTouch",
  "CanQuery",
  "CastShadow",
  "Locked",
  "Massless",
  "Neutral",
  "Enabled",
  "AllowTeamChangeOnTouch",
]);

/** @typedef {{ file: string, path: string, message: string }} Issue */

/** @type {Issue[]} */
const issues = [];

/**
 * @param {string} file
 * @param {string} path
 * @param {string} message
 */
function addIssue(file, path, message) {
  issues.push({ file, path, message });
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is number[]}
 */
function isNumberTriple(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/**
 * @param {unknown} node
 * @param {string} file
 * @param {string} path
 * @param {{ enabledSpawns: { file: string, path: string, position: number[] | null }[] }} ctx
 */
function walkNode(node, file, path, ctx) {
  if (!isObject(node)) {
    addIssue(file, path, "Node must be a JSON object");
    return;
  }

  const className = node.ClassName;
  if (typeof className !== "string" || className.length === 0) {
    addIssue(file, path, 'Missing or invalid "ClassName" (string required)');
  } else if (!KNOWN_CLASS_NAMES.has(className)) {
    addIssue(
      file,
      path,
      `Unknown ClassName "${className}". Use a common Roblox class (Part, SpawnLocation, Model, …) or extend the validator if intentional.`,
    );
  }

  if (path !== "$" && (typeof node.Name !== "string" || node.Name.length === 0)) {
    addIssue(file, path, 'Missing or invalid "Name" (string required on child instances)');
  }

  const props = node.Properties;
  if (props !== undefined) {
    if (!isObject(props)) {
      addIssue(file, `${path}.Properties`, "Properties must be an object");
    } else {
      validateProperties(props, file, `${path}.Properties`, typeof className === "string" ? className : "");
    }
  }

  if (typeof className === "string" && BASE_PART_CLASSES.has(className)) {
    const anchored = isObject(props) ? props.Anchored : undefined;
    if (anchored !== true) {
      addIssue(
        file,
        path,
        `${className} must set Properties.Anchored = true (unanchored parts fall into the void on Play)`,
      );
    }

    if (isObject(props) && props.Size !== undefined) {
      if (!isNumberTriple(props.Size)) {
        addIssue(file, `${path}.Properties.Size`, "Size must be [x, y, z] numbers");
      } else {
        const [sx, sy, sz] = props.Size;
        if (sx <= 0 || sy <= 0 || sz <= 0) {
          addIssue(file, `${path}.Properties.Size`, "Size components must be > 0");
        }
        if (sx > 2048 || sy > 2048 || sz > 2048) {
          addIssue(file, `${path}.Properties.Size`, "Size component > 2048 is almost certainly a mistake");
        }
      }
    }

    if (isObject(props) && props.Position !== undefined && !isNumberTriple(props.Position)) {
      addIssue(file, `${path}.Properties.Position`, "Position must be [x, y, z] numbers");
    }
  }

  if (className === "SpawnLocation") {
    const enabled = !isObject(props) || props.Enabled !== false;
    const position =
      isObject(props) && isNumberTriple(props.Position) ? props.Position : null;
    if (enabled) {
      ctx.enabledSpawns.push({ file, path, position });
    }
  }

  const children = node.Children;
  if (children !== undefined) {
    if (!Array.isArray(children)) {
      addIssue(file, `${path}.Children`, "Children must be an array");
    } else {
      children.forEach((child, index) => {
        walkNode(child, file, `${path}.Children[${index}]`, ctx);
      });
    }
  }
}

/**
 * @param {Record<string, unknown>} props
 * @param {string} file
 * @param {string} path
 * @param {string} className
 */
function validateProperties(props, file, path, className) {
  for (const [key, value] of Object.entries(props)) {
    const propPath = `${path}.${key}`;
    if (VECTOR3_PROPS.has(key) && !isNumberTriple(value)) {
      addIssue(file, propPath, `${key} must be [x, y, z] numbers`);
    }
    if (COLOR_PROPS.has(key)) {
      if (!isNumberTriple(value)) {
        addIssue(file, propPath, `${key} must be [r, g, b] floats in 0–1`);
      } else if (value.some((n) => n < 0 || n > 1)) {
        addIssue(file, propPath, `${key} channels must be between 0 and 1 (not 0–255)`);
      }
    }
    if (BOOL_PROPS.has(key) && typeof value !== "boolean") {
      addIssue(file, propPath, `${key} must be a boolean`);
    }
    if (key === "Material" && typeof value === "string" && !KNOWN_MATERIALS.has(value)) {
      addIssue(file, propPath, `Unknown Material "${value}"`);
    }
    if (
      (key === "MeshId" || key === "TextureID" || key === "Texture" || key === "SoundId") &&
      typeof value === "string" &&
      /rbxassetid:\/\//i.test(value) === false &&
      value.length > 0
    ) {
      // Allow empty; warn-style issue for inventing non-asset strings that look like ids
    }
    if (
      (key === "MeshId" || key === "TextureID" || key === "Texture") &&
      typeof value === "string" &&
      /^rbxassetid:\/\/\d+$/i.test(value) === false &&
      value.length > 0
    ) {
      addIssue(
        file,
        propPath,
        `${key} must be a real rbxassetid:// from shared/assets (got "${value}")`,
      );
    }
    if (className === "SpawnLocation" && key === "Duration" && typeof value !== "number") {
      addIssue(file, propPath, "Duration must be a number");
    }
  }
}

/**
 * @param {{ file: string, path: string, position: number[] | null }[]} enabledSpawns
 * @param {{ file: string, positions: number[] }[]} partPositions
 */
function validateSpawnReachability(enabledSpawns, partPositions) {
  if (enabledSpawns.length === 0) {
    addIssue(
      "world/",
      "$",
      "No enabled SpawnLocation found. Players need exactly one enabled SpawnLocation on a walkable platform.",
    );
    return;
  }
  if (enabledSpawns.length > 1) {
    for (const spawn of enabledSpawns) {
      addIssue(
        spawn.file,
        spawn.path,
        `Multiple enabled SpawnLocations (${enabledSpawns.length}). Keep exactly one Enabled=true (set others to false or remove them).`,
      );
    }
  }

  const spawn = enabledSpawns[0];
  if (!spawn.position) {
    addIssue(spawn.file, spawn.path, "Enabled SpawnLocation should set Properties.Position [x,y,z]");
    return;
  }

  const [sx, sy, sz] = spawn.position;
  const MAX_HORIZONTAL = 250;
  const MAX_VERTICAL_GAP = 40;

  let nearSupport = false;
  for (const entry of partPositions) {
    for (const pos of entry.positions) {
      const [px, py, pz] = pos;
      const horiz = Math.hypot(px - sx, pz - sz);
      const vert = Math.abs(py - sy);
      if (horiz > MAX_HORIZONTAL) {
        addIssue(
          entry.file,
          "$",
          `Part at [${px}, ${py}, ${pz}] is >${MAX_HORIZONTAL} studs horizontally from spawn — place builds near spawn unless the user asked for a distant area.`,
        );
      }
      // Support roughly under/near spawn (platform below or at spawn feet)
      if (horiz <= 20 && sy - py >= -2 && sy - py <= MAX_VERTICAL_GAP) {
        nearSupport = true;
      }
    }
  }

  if (!nearSupport && partPositions.length > 0) {
    addIssue(
      spawn.file,
      spawn.path,
      `Spawn at [${sx}, ${sy}, ${sz}] has no nearby Part support within ~20 studs horizontally. Put an anchored platform under the spawn.`,
    );
  }
}

/**
 * Collect BasePart positions for reachability (skip the spawn itself).
 * @param {unknown} node
 * @param {string} file
 * @param {number[][]} out
 */
function collectPartPositions(node, file, out) {
  if (!isObject(node)) return;
  const className = node.ClassName;
  const props = node.Properties;
  if (
    typeof className === "string" &&
    BASE_PART_CLASSES.has(className) &&
    className !== "SpawnLocation" &&
    isObject(props) &&
    isNumberTriple(props.Position)
  ) {
    out.push(props.Position);
  }
  if (Array.isArray(node.Children)) {
    for (const child of node.Children) {
      collectPartPositions(child, file, out);
    }
  }
}

async function main() {
  let entries;
  try {
    entries = await readdir(WORLD_DIR, { withFileTypes: true });
  } catch {
    console.error(`validate-world: missing world/ directory at ${WORLD_DIR}`);
    process.exit(1);
  }

  const modelFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".model.json"))
    .map((e) => e.name)
    .sort();

  if (modelFiles.length === 0) {
    console.error("validate-world: no world/*.model.json files found");
    process.exit(1);
  }

  /** @type {{ file: string, path: string, position: number[] | null }[]} */
  const enabledSpawns = [];
  /** @type {{ file: string, positions: number[] }[]} */
  const partPositions = [];

  for (const name of modelFiles) {
    const abs = join(WORLD_DIR, name);
    const rel = relative(ROOT, abs).replaceAll("\\", "/");
    let raw;
    try {
      raw = await readFile(abs, "utf8");
    } catch (err) {
      addIssue(rel, "$", `Cannot read file: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      addIssue(rel, "$", `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const ctx = { enabledSpawns };
    walkNode(data, rel, "$", ctx);

    /** @type {number[][]} */
    const positions = [];
    collectPartPositions(data, rel, positions);
    if (positions.length > 0) {
      partPositions.push({ file: rel, positions });
    }
  }

  validateSpawnReachability(enabledSpawns, partPositions);

  if (issues.length > 0) {
    console.error(`validate-world: ${issues.length} issue(s)\n`);
    for (const issue of issues) {
      console.error(`- ${issue.file} @ ${issue.path}: ${issue.message}`);
    }
    console.error("\nFix these, then re-run: npm run validate:world");
    process.exit(1);
  }

  console.log(`validate-world: ok (${modelFiles.length} file(s), 1 enabled SpawnLocation)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

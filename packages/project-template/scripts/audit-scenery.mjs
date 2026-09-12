#!/usr/bin/env node
/**
 * Disk-side AABB overlap heuristic for world/*.model.json (not a live Studio audit).
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORLD = join(ROOT, "world");

const PART_CLASSES = new Set([
  "Part",
  "SpawnLocation",
  "MeshPart",
  "WedgePart",
  "CornerWedgePart",
  "TrussPart",
]);

function asVec3(v) {
  if (Array.isArray(v) && v.length >= 3) {
    return { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) };
  }
  return null;
}

function aabb(pos, size) {
  return {
    min: { x: pos.x - size.x / 2, y: pos.y - size.y / 2, z: pos.z - size.z / 2 },
    max: { x: pos.x + size.x / 2, y: pos.y + size.y / 2, z: pos.z + size.z / 2 },
  };
}

function overlap(a, b) {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  });
}

function walk(node, file, parts) {
  if (!node || typeof node !== "object") {
    return;
  }
  const className = node.ClassName;
  const props = node.Properties ?? {};
  if (
    typeof className === "string" &&
    PART_CLASSES.has(className) &&
    className !== "SpawnLocation"
  ) {
    const pos = asVec3(props.Position);
    const size = asVec3(props.Size);
    if (pos && size) {
      parts.push({
        file,
        name: typeof node.Name === "string" ? node.Name : className,
        box: aabb(pos, size),
      });
    }
  }
  const children = node.Children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walk(child, file, parts);
    }
  }
}

let files = [];
try {
  files = (await readdir(WORLD)).filter((f) => f.endsWith(".model.json"));
} catch {
  console.error("world/ missing");
  process.exit(1);
}

const parts = [];
for (const file of files) {
  const raw = await readFile(join(WORLD, file), "utf8");
  walk(JSON.parse(raw), file, parts);
}

const issues = [];
for (let i = 0; i < parts.length; i += 1) {
  for (let j = i + 1; j < parts.length; j += 1) {
    const a = parts[i];
    const b = parts[j];
    if (a.file === b.file && a.name === b.name) {
      continue;
    }
    if (overlap(a.box, b.box)) {
      const dy = Math.min(a.box.max.y, b.box.max.y) - Math.max(a.box.min.y, b.box.min.y);
      if (dy >= 0 && dy < 0.05) {
        issues.push(`coplanar-face: ${a.file}:${a.name} vs ${b.file}:${b.name}`);
      }
    }
  }
}

if (issues.length === 0) {
  console.log(`audit-scenery: ${parts.length} parts, no coplanar-face issues`);
  process.exit(0);
}

for (const line of issues) {
  console.error(line);
}
process.exit(1);

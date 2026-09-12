#!/usr/bin/env node
/**
 * Resolve an rbxassetid or catalog key against assets.json / src/shared/assets.ts
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const query = (process.argv[2] ?? "").trim();
if (!query) {
  console.error("Usage: npm run lookup-asset -- <rbxassetid://N | number | key>");
  process.exit(1);
}

const needle = query.replace(/^rbxassetid:\/\//i, "");

const hits = [];

try {
  const raw = await readFile(join(ROOT, "assets.json"), "utf8");
  const parsed = JSON.parse(raw);
  const assets = parsed.assets ?? parsed;
  if (assets && typeof assets === "object") {
    for (const [key, value] of Object.entries(assets)) {
      const blob = JSON.stringify(value);
      if (key === query || key === needle || blob.includes(needle)) {
        hits.push({ source: "assets.json", key, value });
      }
    }
  }
} catch {
  // missing manifest is ok
}

try {
  const ts = await readFile(join(ROOT, "src", "shared", "assets.ts"), "utf8");
  const re = /([A-Za-z0-9_]+)\s*:\s*"rbxassetid:\/\/(\d+)"/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    const key = m[1];
    const id = m[2];
    if (key === query || id === needle) {
      hits.push({ source: "src/shared/assets.ts", key, rbxassetid: `rbxassetid://${id}` });
    }
  }
} catch {
  // missing
}

if (hits.length === 0) {
  console.error(`No registry entry for ${query}. Import via Blockforge Assets — do not invent an id.`);
  process.exit(1);
}

console.log(JSON.stringify({ query, hits }, null, 2));

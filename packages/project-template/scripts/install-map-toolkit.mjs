#!/usr/bin/env node
/**
 * Verify the versioned MapToolkit is present. Agents must require() it in Studio, not paste it.
 */
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLKIT = join(ROOT, "studio-tools", "MapToolkit.luau");

try {
  await access(TOOLKIT, constants.F_OK);
} catch {
  console.error("Missing studio-tools/MapToolkit.luau — restore the Blockforge template.");
  process.exit(1);
}

console.log("MapToolkit ready at studio-tools/MapToolkit.luau");
console.log("Rojo path: ReplicatedStorage.Blockforge.MapToolkit");
console.log("In Studio MCP execute_luau, require it. Do not paste the source.");
console.log("");
console.log("Example:");
console.log(
  'local T = require(game.ReplicatedStorage.Blockforge.MapToolkit); return { version = T.version(), zfight = T.auditZFight(), overlaps = T.auditOverlaps(), rigs = T.auditRigs() }',
);

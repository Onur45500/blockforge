#!/usr/bin/env node
/**
 * Static cross-checks between src/ TypeScript and world/*.model.json.
 * Catches common Studio Play failures: WaitForChild on missing Names,
 * remote create/wait mismatches, client .Touched on world pads, DataStore off-server.
 *
 * Exit 0 on success; non-zero with actionable stderr on failure.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC_DIR = join(ROOT, "src");
const WORLD_DIR = join(ROOT, "world");

/** Names that exist in the DataModel without being in world JSON. */
const BUILTIN_NAMES = new Set([
  "Workspace",
  "World",
  "Players",
  "ReplicatedStorage",
  "ServerScriptService",
  "StarterPlayer",
  "StarterPlayerScripts",
  "StarterGui",
  "HttpService",
  "SoundService",
  "DataStoreService",
  "RunService",
  "UserInputService",
  "TweenService",
  "Debris",
  "Lighting",
  "Remotes",
  "Humanoid",
  "HumanoidRootPart",
  "Character",
  "Head",
  "Torso",
  "leaderstats",
  "Coins",
  "Cash",
  "Score",
  "TS",
  "rbxts_include",
  "Handle",
  "Tool",
]);

/** @typedef {{ file: string, message: string }} Issue */
/** @type {Issue[]} */
const issues = [];

/**
 * @param {string} file
 * @param {string} message
 */
function addIssue(file, message) {
  issues.push({ file, message });
}

/**
 * @param {unknown} node
 * @param {Set<string>} out
 */
function collectWorldNames(node, out) {
  if (typeof node !== "object" || node === null || Array.isArray(node)) return;
  /** @type {Record<string, unknown>} */
  const obj = /** @type {Record<string, unknown>} */ (node);
  if (typeof obj.Name === "string" && obj.Name.length > 0) {
    out.add(obj.Name);
  }
  if (Array.isArray(obj.Children)) {
    for (const child of obj.Children) {
      collectWorldNames(child, out);
    }
  }
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listTsFiles(abs)));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Extract string-literal Name lookups: WaitForChild("X") / FindFirstChild("X").
 * FindFirstChildOfClass / FindFirstChildWhichIsA take a ClassName — skip those.
 * @param {string} source
 * @returns {{ name: string, kind: string, index: number }[]}
 */
function extractChildLookups(source) {
  const re = /\.(WaitForChild|FindFirstChild)\(\s*["']([^"']+)["']/g;
  /** @type {{ name: string, kind: string, index: number }[]} */
  const matches = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    matches.push({ kind: m[1], name: m[2], index: m.index });
  }
  return matches;
}

/**
 * Heuristic: lookup is world-scoped if nearby context mentions World / Workspace.World
 * or the chain is like world.WaitForChild / Workspace.WaitForChild("World")...
 * @param {string} source
 * @param {number} index
 */
function looksLikeWorldLookup(source, index) {
  const windowStart = Math.max(0, index - 200);
  const before = source.slice(windowStart, index);
  if (/\bWorld\b/.test(before)) return true;
  if (/Workspace\s*\.\s*WaitForChild\s*\(\s*["']World["']/.test(before)) return true;
  // Common pattern: const world = ...; later world.WaitForChild
  if (/\bworld\s*\.\s*$/i.test(before) || /\bworld\s*$/i.test(before.trimEnd())) {
    return true;
  }
  return false;
}

/**
 * @param {string} source
 * @returns {Set<string>}
 */
function extractRemoteCreates(source) {
  const names = new Set();
  // new Instance("RemoteEvent"); name.Name = "BuyItem"
  // or buyItem.Name = "BuyItem" after Instance("RemoteEvent")
  const instanceRe =
    /new\s+Instance\s*\(\s*["'](RemoteEvent|RemoteFunction)["']\s*\)/g;
  let m;
  while ((m = instanceRe.exec(source)) !== null) {
    const after = source.slice(m.index, m.index + 400);
    const nameMatch = after.match(/\.Name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) {
      names.add(nameMatch[1]);
    }
  }
  // ensureRemoteEvent("BuyItem") / ensureRemoteFunction("GetBalance")
  const ensureRe =
    /ensureRemote(?:Event|Function)\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = ensureRe.exec(source)) !== null) {
    names.add(m[1]);
  }
  return names;
}

/**
 * Count Part / SpawnLocation constructions that look like scenery spam.
 * @param {string} source
 * @returns {number}
 */
function countPartConstructions(source) {
  const re =
    /new\s+Instance\s*\(\s*["'](Part|SpawnLocation|WedgePart|MeshPart)["']\s*\)/g;
  let count = 0;
  while (re.exec(source) !== null) {
    count += 1;
  }
  return count;
}

/**
 * Client waits: WaitForChild("BuyItem") as RemoteEvent / RemoteFunction
 * @param {string} source
 * @returns {Set<string>}
 */
function extractRemoteWaits(source) {
  const names = new Set();
  const re =
    /\.WaitForChild\s*\(\s*["']([^"']+)["']\s*\)\s*(?:as\s+Remote(?:Event|Function))?/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const after = source.slice(m.index, m.index + 80);
    if (/as\s+Remote(?:Event|Function)/.test(after) || /Remotes/.test(source.slice(Math.max(0, m.index - 120), m.index))) {
      names.add(m[1]);
    }
  }
  // Also catch: remotes.WaitForChild("BuyItem")
  const remotesRe =
    /[Rr]emotes?\s*\.\s*WaitForChild\s*\(\s*["']([^"']+)["']/g;
  while ((m = remotesRe.exec(source)) !== null) {
    names.add(m[1]);
  }
  return names;
}

async function main() {
  /** @type {Set<string>} */
  const worldNames = new Set();

  let worldEntries;
  try {
    worldEntries = await readdir(WORLD_DIR, { withFileTypes: true });
  } catch {
    console.error(`validate-refs: missing world/ at ${WORLD_DIR}`);
    process.exit(1);
  }

  for (const entry of worldEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".model.json")) continue;
    const abs = join(WORLD_DIR, entry.name);
    const rel = relative(ROOT, abs).replaceAll("\\", "/");
    let raw;
    try {
      raw = await readFile(abs, "utf8");
    } catch (err) {
      addIssue(rel, `Cannot read: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      addIssue(rel, `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    collectWorldNames(data, worldNames);
  }

  const tsFiles = await listTsFiles(SRC_DIR);
  /** @type {Set<string>} */
  const serverRemoteCreates = new Set();
  /** @type {Map<string, Set<string>>} */
  const clientRemoteWaits = new Map();

  for (const abs of tsFiles) {
    const rel = relative(ROOT, abs).replaceAll("\\", "/");
    const source = await readFile(abs, "utf8");
    const isServer = rel.startsWith("src/server/");
    const isClient = rel.startsWith("src/client/");

    // World name lookups
    for (const lookup of extractChildLookups(source)) {
      if (BUILTIN_NAMES.has(lookup.name)) continue;
      if (!looksLikeWorldLookup(source, lookup.index)) continue;
      if (!worldNames.has(lookup.name)) {
        addIssue(
          rel,
          `${lookup.kind}("${lookup.name}") looks like a Workspace.World lookup, but no instance named "${lookup.name}" exists in world/*.model.json. Use an exact Name from world JSON or add the part.`,
        );
      }
    }

    // Client .Touched on world pads — should be server
    if (isClient && /\.Touched\s*\.\s*Connect/.test(source)) {
      addIssue(
        rel,
        "Client script uses .Touched.Connect — for world pads/teleports/coins prefer server-side .Touched (see docs/REMOTE_EVENTS.md and docs/examples/teleport/).",
      );
    }

    // DataStore only on server
    if (!isServer && /DataStoreService/.test(source)) {
      addIssue(
        rel,
        "DataStoreService used outside src/server/ — DataStores must run on the server only.",
      );
    }

    // Prefer world JSON over Part-factory scenery when world/ already has models.
    // Allow a few dynamic Parts (e.g. tycoon drops) or an explicit opt-out.
    // Threshold ≥2 catches platform pairs; .CFrame = dodges the old .Position-only check.
    if (
      isServer &&
      worldNames.size > 0 &&
      !/\/\/\s*blockforge:dynamic-parts\b/.test(source) &&
      countPartConstructions(source) >= 2 &&
      (/\.Position\s*=/.test(source) || /\.CFrame\s*=/.test(source))
    ) {
      addIssue(
        rel,
        `Server script creates Instance("Part"|"SpawnLocation"|"WedgePart"|"MeshPart") with Position/CFrame while world/ models exist. Put platforms/maps/lobbies in world/*.model.json (CLAUDE.md rule 13) — do not rebuild scenery in scripts. For intentional dynamic Parts (drops, projectiles, crops), add // blockforge:dynamic-parts.`,
      );
    }

    if (isServer) {
      for (const name of extractRemoteCreates(source)) {
        serverRemoteCreates.add(name);
      }
    }
    if (isClient) {
      const waits = extractRemoteWaits(source);
      if (waits.size > 0) {
        clientRemoteWaits.set(rel, waits);
      }
    }
  }

  for (const [file, waits] of clientRemoteWaits) {
    for (const name of waits) {
      if (name === "Remotes") continue;
      if (worldNames.has(name)) continue;
      if (BUILTIN_NAMES.has(name)) continue;
      if (!serverRemoteCreates.has(name)) {
        addIssue(
          file,
          `Client WaitForChild("${name}") appears to expect a RemoteEvent/RemoteFunction, but no server file creates it via ensureRemoteEvent/Function("${name}") or Instance("RemoteEvent"|"RemoteFunction") with Name="${name}". Create it on the server first.`,
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error(`validate-refs: ${issues.length} issue(s)\n`);
    for (const issue of issues) {
      console.error(`- ${issue.file}: ${issue.message}`);
    }
    console.error("\nFix these, then re-run: npm run validate:refs");
    process.exit(1);
  }

  console.log(
    `validate-refs: ok (${tsFiles.length} ts file(s), ${worldNames.size} world Name(s))`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { createHash } from "node:crypto";
import { mkdir, writeFile, copyFile, access, readdir } from "node:fs/promises";
import { dirname, join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { buildCuratedCatalogAssets } from "./seed.js";
import type { AssetCatalog } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const catalogPath = join(packageRoot, "catalog/index.json");
const packDir = join(packageRoot, "pack");
const cacheDir = join(packageRoot, ".cache/packs");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command: string, args: string[], cwd?: string): Promise<number> {
  return new Promise((resolveCode, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolveCode(code ?? 1));
  });
}

/**
 * Convert OBJ → FBX using assimp (preferred in CI) or Blender headless.
 * Returns output path on success, null if tools are missing.
 */
export async function convertObjToFbx(
  objPath: string,
  outFbxPath: string,
): Promise<string | null> {
  const assimpCode = await run("assimp", ["export", objPath, outFbxPath]).catch(
    () => 127,
  );
  if (assimpCode === 0 && (await exists(outFbxPath))) {
    return outFbxPath;
  }

  const blenderScript = `
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.obj(filepath=r"${objPath.replace(/\\/g, "\\\\")}")
bpy.ops.export_scene.fbx(filepath=r"${outFbxPath.replace(/\\/g, "\\\\")}")
`;
  const scriptPath = join(cacheDir, "obj_to_fbx.py");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(scriptPath, blenderScript, "utf8");
  const blenderCode = await run("blender", [
    "--background",
    "--python",
    scriptPath,
  ]).catch(() => 127);
  if (blenderCode === 0 && (await exists(outFbxPath))) {
    return outFbxPath;
  }
  return null;
}

async function convertCachedObjs(): Promise<number> {
  if (!(await exists(cacheDir))) {
    return 0;
  }
  const convertedDir = join(packDir, "converted");
  await mkdir(convertedDir, { recursive: true });
  let count = 0;
  const entries = await readdir(cacheDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".obj") {
      continue;
    }
    const objPath = join(cacheDir, entry.name);
    const outFbx = join(convertedDir, `${basename(entry.name, ".obj")}.fbx`);
    const result = await convertObjToFbx(objPath, outFbx);
    if (result) {
      count += 1;
      console.log(`Converted ${entry.name} → ${basename(outFbx)}`);
    } else {
      console.warn(
        `Skipped ${entry.name}: install assimp or Blender CLI for OBJ→fbx`,
      );
    }
  }
  return count;
}

/**
 * Ingest builds the searchable catalog index.
 *
 * Full Kenney/Quaternius zip download + OBJ→fbx conversion is opt-in via:
 *   BLOCKFORGE_INGEST_DOWNLOAD=1 pnpm assets:ingest
 *
 * Place source zips/OBJ under packages/asset-bank/.cache/packs/
 * Default mode writes the CC0 catalog and attaches fixture binaries to a
 * curated importable set (~25 models + UI images) under pack/curated/.
 */

/** Catalog ids that ship with on-disk fixture binaries for COURSE Track B / import. */
const CURATED_MODEL_IDS = [
  "kenney_crate",
  "kenney_barrel",
  "kenney_chest",
  "kenney_tree",
  "kenney_rock",
  "kenney_bush",
  "kenney_platform",
  "kenney_campfire",
  "kenney_flag",
  "kenney_coin",
  "kenney_gem",
  "kenney_sword",
  "kenney_shield",
  "quat_tree_pine",
  "quat_tree_oak",
  "quat_rock_large",
  "quat_prop_crate",
  "quat_prop_barrel",
  "quat_grass_clump",
  "quat_mushroom",
] as const;

const CURATED_IMAGE_IDS = [
  "kenney_ui_icon_coin",
  "kenney_ui_icon_heart",
  "kenney_ui_icon_star",
  "kenney_texture_dirt",
  "kenney_texture_grass",
] as const;

async function attachCuratedBinaries(
  assets: Awaited<ReturnType<typeof buildCuratedCatalogAssets>>,
): Promise<string[]> {
  const curatedDir = join(packDir, "curated");
  await mkdir(curatedDir, { recursive: true });
  const fbxSrc = join(packageRoot, "fixtures", "sample.fbx");
  const pngSrc = join(packageRoot, "fixtures", "sample.png");
  const importable: string[] = [];

  if (!(await exists(fbxSrc)) || !(await exists(pngSrc))) {
    console.warn("Fixtures missing — curated binaries not attached");
    return importable;
  }

  const byId = new Map(assets.map((a) => [a.id, a]));
  for (const id of CURATED_MODEL_IDS) {
    const asset = byId.get(id);
    if (!asset) continue;
    const rel = `pack/curated/${id}.fbx`;
    await copyFile(fbxSrc, join(packageRoot, rel));
    asset.file = rel;
    asset.tags = [...new Set([...asset.tags, "importable", "curated-binary"])];
    importable.push(id);
  }
  for (const id of CURATED_IMAGE_IDS) {
    const asset = byId.get(id);
    if (!asset) continue;
    const rel = `pack/curated/${id}.png`;
    await copyFile(pngSrc, join(packageRoot, rel));
    asset.file = rel;
    asset.thumbnail = rel;
    asset.tags = [...new Set([...asset.tags, "importable", "curated-binary"])];
    importable.push(id);
  }
  return importable;
}

async function main(): Promise<void> {
  await mkdir(join(packageRoot, "catalog"), { recursive: true });
  await mkdir(packDir, { recursive: true });
  await mkdir(join(packDir, "fixtures"), { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const assets = buildCuratedCatalogAssets();

  for (const name of ["sample.png", "sample.fbx"]) {
    const src = join(packageRoot, "fixtures", name);
    if (await exists(src)) {
      await copyFile(src, join(packDir, "fixtures", name));
    }
  }

  let converted = 0;
  if (process.env.BLOCKFORGE_INGEST_DOWNLOAD === "1") {
    console.log(
      "Remote pack download enabled. Place Kenney/Quaternius CC0 zips or .obj under .cache/packs",
    );
    converted = await convertCachedObjs();
    console.log(`OBJ→fbx conversions: ${converted}`);
    // Map converted FBX onto matching catalog ids when filename matches id.obj
    const convertedDir = join(packDir, "converted");
    if (await exists(convertedDir)) {
      const files = await readdir(convertedDir);
      const byId = new Map(assets.map((a) => [a.id, a]));
      for (const name of files) {
        if (!name.endsWith(".fbx")) continue;
        const id = basename(name, ".fbx");
        const asset = byId.get(id);
        if (asset) {
          asset.file = `pack/converted/${name}`;
          asset.tags = [...new Set([...asset.tags, "importable"])];
        }
      }
    }
  }

  const importable = await attachCuratedBinaries(assets);

  const catalog: AssetCatalog = {
    version: "0.5.0",
    generatedAt: new Date().toISOString(),
    description:
      "Blockforge asset bank — unique CC0 catalog entries from Kenney, Quaternius, and Poly Haven packs. Curated subset includes on-disk fixtures for import; full remote meshes via BLOCKFORGE_INGEST_DOWNLOAD=1. CC0 only.",
    assets,
  };

  await writeFile(catalogPath, JSON.stringify(catalog, null, 2));
  await writeFile(
    join(packDir, "importable-ids.json"),
    JSON.stringify({ version: catalog.version, ids: importable }, null, 2),
    "utf8",
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(catalog))
    .digest("hex");
  await writeFile(
    join(packDir, "catalog.sha256"),
    `${hash}  index.json\n`,
    "utf8",
  );
  console.log(`Wrote ${assets.length} assets to ${catalogPath}`);
  console.log(`Importable with binaries: ${importable.length}`);
  console.log(`Catalog sha256: ${hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

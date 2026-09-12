import { mkdir, readFile, writeFile, access, cp } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

export type StylePackActivateResult =
  | { success: true; packId: string; path: string; detail: string }
  | { success: false; message: string };

async function findRepoRoot(start: string): Promise<string | null> {
  let dir = start;
  while (dir !== join(dir, "..")) {
    try {
      await readFile(join(dir, "pnpm-workspace.yaml"), "utf8");
      return dir;
    } catch {
      dir = join(dir, "..");
    }
  }
  return null;
}

async function resolveStylePackDir(packId: string): Promise<string | null> {
  const repoRoot = await findRepoRoot(app.getAppPath());
  if (repoRoot) {
    return join(repoRoot, "packages", "asset-bank", "style-packs", packId);
  }
  return join(process.resourcesPath, "asset-bank", "style-packs", packId);
}

/**
 * Copies style-pack metadata into the project as `.blockforge/style-pack.json`
 * so agent bootstrap injects the pack prompt.
 */
export async function activateStylePack(
  projectPath: string,
  packId = "lowpoly-nature",
): Promise<StylePackActivateResult> {
  const packDir = await resolveStylePackDir(packId);
  if (!packDir) {
    return { success: false, message: `Unknown style pack: ${packId}` };
  }
  const packJsonPath = join(packDir, "pack.json");
  try {
    await access(packJsonPath, constants.R_OK);
  } catch {
    return { success: false, message: `Style pack not found: ${packJsonPath}` };
  }

  const raw = await readFile(packJsonPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, message: "Invalid style pack JSON" };
  }

  const blockforgeDir = join(projectPath, ".blockforge");
  await mkdir(blockforgeDir, { recursive: true });
  const dest = join(blockforgeDir, "style-pack.json");
  await writeFile(dest, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

  // Copy README for humans when present
  try {
    await cp(join(packDir, "README.md"), join(blockforgeDir, `style-pack-${packId}.md`));
  } catch {
    // optional
  }

  return {
    success: true,
    packId,
    path: dest,
    detail: `Activated ${packId} → .blockforge/style-pack.json`,
  };
}

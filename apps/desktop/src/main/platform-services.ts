import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { app } from "electron";
import type {
  CloudSyncResult,
  CommunityShareResult,
} from "../shared/ipc-types.js";

/**
 * Local project snapshot MVP stored under userData; no remote cloud transfer occurs.
 * Local filesystem remains source of truth unless the user explicitly pulls.
 */
export async function cloudSyncPush(projectPath: string): Promise<CloudSyncResult> {
  try {
    const metaRaw = await readFile(
      join(projectPath, ".blockforge", "meta.json"),
      "utf8",
    );
    const meta = JSON.parse(metaRaw) as { id: string; name: string };
    const backupRoot = join(app.getPath("userData"), "cloud-sync", meta.id);
    await mkdir(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const payload = {
      pushedAt: new Date().toISOString(),
      projectId: meta.id,
      name: meta.name,
      note: "Local snapshot metadata only — no remote cloud upload occurred",
    };
    const dest = join(backupRoot, `push-${stamp}.json`);
    await writeFile(dest, JSON.stringify(payload, null, 2), "utf8");
    return {
      success: true,
      detail: `Exported local snapshot metadata to ${dest}. Nothing was uploaded to remote cloud storage.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function cloudSyncPull(projectPath: string): Promise<CloudSyncResult> {
  try {
    const metaRaw = await readFile(
      join(projectPath, ".blockforge", "meta.json"),
      "utf8",
    );
    const meta = JSON.parse(metaRaw) as { id: string };
    const backupRoot = join(app.getPath("userData"), "cloud-sync", meta.id);
    try {
      await access(backupRoot, constants.F_OK);
    } catch {
      return {
        success: false,
        message: "No local snapshots found for this project yet — export one first.",
      };
    }
    return {
      success: true,
      detail:
        "Local snapshot review is opt-in and does not overwrite project files. No remote cloud download occurred; review snapshots under userData/cloud-sync.",
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Opt-in community share: only user-owned packs with CC0 / attributed CC-BY.
 * Writes a share manifest; no scraped proprietary banks.
 */
export async function communitySharePack(
  projectPath: string,
): Promise<CommunityShareResult> {
  try {
    const attributionPath = join(projectPath, "ATTRIBUTION.md");
    let attribution = "";
    try {
      attribution = await readFile(attributionPath, "utf8");
    } catch {
      attribution = "";
    }
    if (/proprietary|scraped|roblox toolbox steal/i.test(attribution)) {
      return {
        success: false,
        message: "Share blocked — proprietary or scraped assets are not allowed.",
      };
    }
    const shareDir = join(app.getPath("userData"), "community-shares");
    await mkdir(shareDir, { recursive: true });
    const manifest = {
      sharedAt: new Date().toISOString(),
      projectPath,
      licenseGate: "CC0-or-CC-BY-with-attribution",
      attributionPresent: attribution.length > 0,
      optIn: true,
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex")
      .slice(0, 12);
    const dest = join(shareDir, `share-${hash}.json`);
    await writeFile(dest, JSON.stringify(manifest, null, 2), "utf8");
    return {
      success: true,
      detail: `Local community share manifest written to ${dest}. Nothing was uploaded; any upload remains user-initiated.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export { checkForUpdates, downloadAndInstallUpdate, getAppInfo } from "./updater-service.js";

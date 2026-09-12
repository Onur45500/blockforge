import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { app } from "electron";

export type PackDownloadProgress = {
  status: "idle" | "downloading" | "verifying" | "ready" | "error";
  percent: number;
  detail: string;
  localPath?: string;
};

export type PackManifest = {
  version: string;
  artifact: string;
  sha256: string;
  downloadUrlTemplate?: string;
  downloadUrl?: string;
};

function cacheRoot(): string {
  return join(app.getPath("userData"), "asset-packs");
}

async function findRepoPackManifest(): Promise<string | null> {
  let dir = app.getAppPath();
  while (dir !== join(dir, "..")) {
    const candidate = join(dir, "packages", "asset-bank", "pack", "manifest.json");
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      dir = join(dir, "..");
    }
  }
  return null;
}

export async function getPackStatus(): Promise<PackDownloadProgress> {
  try {
    const manifestPath = await findRepoPackManifest();
    if (!manifestPath) {
      return {
        status: "idle",
        percent: 0,
        detail: "No local pack manifest yet — run assets:build-pack",
      };
    }
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as PackManifest;
    const local = join(cacheRoot(), manifest.artifact);
    try {
      await access(local, constants.F_OK);
      return {
        status: "ready",
        percent: 100,
        detail: `Cached pack v${manifest.version}`,
        localPath: local,
      };
    } catch {
      return {
        status: "idle",
        percent: 0,
        detail: `Pack v${manifest.version} available to download/cache`,
      };
    }
  } catch (err) {
    return {
      status: "error",
      percent: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Download (or copy local release artifact) into userData cache and verify sha256.
 * When downloadUrl is absent, copies the local pack artifact built by build-pack.
 */
export async function downloadAssetPack(
  onProgress?: (p: PackDownloadProgress) => void,
): Promise<PackDownloadProgress> {
  const emit = (p: PackDownloadProgress): void => {
    onProgress?.(p);
  };

  const manifestPath = await findRepoPackManifest();
  if (!manifestPath) {
    const err: PackDownloadProgress = {
      status: "error",
      percent: 0,
      detail: "pack/manifest.json not found. Run pnpm --filter @blockforge/asset-bank build-pack",
    };
    emit(err);
    return err;
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PackManifest;
  await mkdir(cacheRoot(), { recursive: true });
  const dest = join(cacheRoot(), manifest.artifact);
  const packDir = join(manifestPath, "..");
  const localArtifact = join(packDir, manifest.artifact);

  emit({
    status: "downloading",
    percent: 10,
    detail: `Fetching pack v${manifest.version}…`,
  });

  const url = manifest.downloadUrl ?? process.env.BLOCKFORGE_ASSET_PACK_URL;
  try {
    if (url) {
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error(`Download failed (${response.status})`);
      }
      const nodeStream = Readable.fromWeb(
        response.body as Parameters<typeof Readable.fromWeb>[0],
      );
      await pipeline(nodeStream, createWriteStream(dest));
    } else {
      const bytes = await readFile(localArtifact);
      await writeFile(dest, bytes);
    }
  } catch (err) {
    const fail: PackDownloadProgress = {
      status: "error",
      percent: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
    emit(fail);
    return fail;
  }

  emit({ status: "verifying", percent: 80, detail: "Verifying sha256…" });
  const downloaded = await readFile(dest);
  const hash = createHash("sha256").update(downloaded).digest("hex");
  if (hash !== manifest.sha256) {
    const fail: PackDownloadProgress = {
      status: "error",
      percent: 0,
      detail: `Checksum mismatch (got ${hash}, expected ${manifest.sha256})`,
    };
    emit(fail);
    return fail;
  }

  const ready: PackDownloadProgress = {
    status: "ready",
    percent: 100,
    detail: `Pack v${manifest.version} cached`,
    localPath: dest,
  };
  emit(ready);
  return ready;
}

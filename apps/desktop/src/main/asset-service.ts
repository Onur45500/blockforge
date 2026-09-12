import { readFile, writeFile, mkdir, access, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { constants } from "node:fs";
import { app } from "electron";
import {
  OpenCloudClient,
  mapOpenCloudError,
} from "@blockforge/open-cloud";
import type {
  AssetCatalog,
  AssetCatalogEntry,
  AssetImportRequest,
  AssetImportResult,
  AssetPreviewRequest,
  AssetPreviewResult,
  ProjectAssetsFile,
} from "../shared/ipc-types.js";
import {
  generateAssetsTs,
  inferAssetType,
  isAudioExtension,
  mapBankCatalogToEntries,
  mimeForPreviewPath,
  modelFormatFromPath,
} from "../shared/asset-helpers.js";
import { getDecryptedAssetUploadApiKey, getPublishConfig } from "./open-cloud-store.js";
import { recordAttribution } from "./attribution-service.js";

export {
  generateAssetsTs,
  inferAssetType,
  mapBankCatalogToEntries,
  mimeForPreviewPath,
} from "../shared/asset-helpers.js";

const PREVIEW_MAX_BYTES = 5 * 1024 * 1024;

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

export async function resolveCatalogPath(): Promise<string> {
  const repoRoot = await findRepoRoot(app.getAppPath());
  if (repoRoot) {
    return join(repoRoot, "packages", "asset-bank", "catalog", "index.json");
  }
  return join(process.resourcesPath, "asset-bank", "catalog", "index.json");
}

async function resolveAssetBankRoot(): Promise<string> {
  const repoRoot = await findRepoRoot(app.getAppPath());
  if (repoRoot) {
    return join(repoRoot, "packages", "asset-bank");
  }
  return join(process.resourcesPath, "asset-bank");
}

function resolveAssetFilePath(bankRoot: string, relativeOrAbsolute: string): string {
  if (
    relativeOrAbsolute.includes(":") ||
    relativeOrAbsolute.startsWith("/") ||
    relativeOrAbsolute.startsWith("\\\\")
  ) {
    return relativeOrAbsolute;
  }
  return join(bankRoot, relativeOrAbsolute);
}

export async function resolveBankAssetPath(
  relativeOrAbsolute: string,
): Promise<string> {
  const bankRoot = await resolveAssetBankRoot();
  return resolveAssetFilePath(bankRoot, relativeOrAbsolute);
}

async function ensureCatalogFile(): Promise<string> {
  const catalogPath = await resolveCatalogPath();
  try {
    await access(catalogPath, constants.F_OK);
  } catch {
    await mkdir(join(catalogPath, ".."), { recursive: true });
    const empty: AssetCatalog = { version: "0.1.0", assets: [] };
    await writeFile(catalogPath, JSON.stringify(empty, null, 2), "utf8");
  }
  return catalogPath;
}

export async function getAssetCatalog(): Promise<AssetCatalog> {
  const catalogPath = await ensureCatalogFile();
  const raw = await readFile(catalogPath, "utf8");
  const parsed = JSON.parse(raw) as {
    version?: string;
    generatedAt?: string;
    description?: string;
    assets?: Array<Record<string, unknown>>;
  };

  return {
    version: parsed.version ?? "0.1.0",
    generatedAt: parsed.generatedAt,
    description: parsed.description,
    assets: mapBankCatalogToEntries(parsed.assets ?? []),
  };
}

export async function listProjectAssets(projectPath: string): Promise<ProjectAssetsFile> {
  const assetsPath = join(projectPath, "assets.json");
  try {
    const raw = await readFile(assetsPath, "utf8");
    return JSON.parse(raw) as ProjectAssetsFile;
  } catch {
    return {
      templateVersion: "0.1.0",
      createdWith: "blockforge",
      assets: {},
    };
  }
}

async function writeProjectAssets(
  projectPath: string,
  file: ProjectAssetsFile,
): Promise<void> {
  const assetsPath = join(projectPath, "assets.json");
  await writeFile(assetsPath, JSON.stringify(file, null, 2), "utf8");
  const tsPath = join(projectPath, "src", "shared", "assets.ts");
  await writeFile(tsPath, generateAssetsTs(file.assets), "utf8");
}

function resolveCatalogEntry(
  catalog: AssetCatalog,
  catalogAssetId: string,
): AssetCatalogEntry | null {
  return catalog.assets.find((a) => a.id === catalogAssetId) ?? null;
}

export async function getAssetPreview(
  request: AssetPreviewRequest,
): Promise<AssetPreviewResult> {
  const catalog = await getAssetCatalog();
  const entry = resolveCatalogEntry(catalog, request.catalogAssetId);
  if (!entry) {
    return { kind: "none", reason: "Asset not found in catalog." };
  }

  const relative = entry.previewPath ?? entry.filePath;
  if (!relative) {
    return {
      kind: "none",
      reason:
        "No local file for this entry yet — catalog metadata only. Download/ingest the pack to preview.",
    };
  }

  const bankRoot = await resolveAssetBankRoot();
  const filePath = resolveAssetFilePath(bankRoot, relative);

  try {
    await access(filePath, constants.R_OK);
  } catch {
    return {
      kind: "none",
      reason: `Local file missing: ${relative}`,
    };
  }

  const { kind, mime } = mimeForPreviewPath(filePath);

  if (kind === "none" || !mime) {
    return {
      kind: "none",
      reason: `Preview not supported for this file type (${extname(filePath) || "unknown"}).`,
    };
  }

  const info = await stat(filePath);
  if (info.size > PREVIEW_MAX_BYTES) {
    return {
      kind: "none",
      reason: `File is too large to preview in-app (${Math.round(info.size / (1024 * 1024))} MB; max 5 MB).`,
    };
  }

  const bytes = await readFile(filePath);
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

  if (kind === "image") {
    return { kind: "image", dataUrl, mime, filePath };
  }
  if (kind === "audio") {
    return { kind: "audio", dataUrl, mime, filePath };
  }

  const format = modelFormatFromPath(filePath);
  if (!format) {
    return {
      kind: "none",
      reason: `Preview not supported for this file type (${extname(filePath) || "unknown"}).`,
    };
  }
  return { kind: "model", dataUrl, mime, format, filePath };
}

export async function importAsset(
  request: AssetImportRequest,
): Promise<AssetImportResult> {
  const catalog = await getAssetCatalog();
  const entry = resolveCatalogEntry(catalog, request.catalogAssetId);
  const bankRoot = await resolveAssetBankRoot();
  const rawPath = request.filePath ?? entry?.filePath;
  const filePath = rawPath ? resolveAssetFilePath(bankRoot, rawPath) : undefined;

  if (!filePath) {
    return {
      success: false,
      message:
        "Asset binary not in the local pack yet. Fixtures and downloaded pack files can be uploaded; catalog metadata-only entries need ingest/download first.",
    };
  }

  if (entry && entry.uploadSupported === false) {
    return {
      success: false,
      message:
        "This asset is preview-only (audio). Roblox Open Cloud audio quotas are too low for one-click upload in MVP.",
    };
  }

  if (isAudioExtension(filePath)) {
    return {
      success: false,
      message:
        "Audio upload is preview-only in Blockforge MVP due to Open Cloud quota limits. Use Roblox Studio or Open Cloud directly for audio assets.",
    };
  }

  const assetType = inferAssetType(filePath);
  if (!assetType || (assetType !== "Model" && assetType !== "Decal")) {
    return {
      success: false,
      message: "Only .fbx and .png/.jpg uploads are supported in this MVP.",
    };
  }

  const config = await getPublishConfig();
  const assetKey = await getDecryptedAssetUploadApiKey();
  if (!config?.userId || !assetKey) {
    return {
      success: false,
      message:
        "Configure user ID and an asset upload API key (or Open Cloud key) in Settings before uploading.",
    };
  }

  try {
    await access(filePath, constants.R_OK);
  } catch {
    return { success: false, message: `Cannot read file: ${filePath}` };
  }

  const client = new OpenCloudClient({ apiKey: assetKey });
  const displayName = entry?.name ?? basename(filePath, extname(filePath));

  try {
    const { assetId } = await client.uploadAssetAndWait({
      assetType,
      displayName,
      description: `Imported via Blockforge (${request.key})`,
      filePath,
      creator: { userId: Number(config.userId) },
    });

    const projectAssets = await listProjectAssets(request.projectPath);
    projectAssets.assets[request.key] = {
      key: request.key,
      assetId,
      displayName,
      sourceCatalogId: request.catalogAssetId,
      uploadedAt: new Date().toISOString(),
    };
    await writeProjectAssets(request.projectPath, projectAssets);

    if (entry) {
      await recordAttribution(request.projectPath, {
        catalogId: entry.id,
        name: entry.name,
        license: entry.license ?? "CC0",
        attribution: entry.attribution ?? "Unknown",
        source: entry.id,
        key: request.key,
      });
    }

    return { success: true, assetId, key: request.key };
  } catch (error) {
    const mapped = mapOpenCloudError(error);
    return { success: false, message: mapped.message };
  }
}

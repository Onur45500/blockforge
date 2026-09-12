import { extname } from "node:path";
import type { AssetType } from "@blockforge/open-cloud";
import type {
  AssetCatalogEntry,
  ProjectAssetsFile,
} from "./ipc-types.js";

const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".flac"]);

export function inferAssetType(filePath: string): AssetType | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".fbx") {
    return "Model";
  }
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
    return "Decal";
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return "Audio";
  }
  return null;
}

export function isAudioExtension(filePath: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export type PreviewMediaKind = "image" | "audio" | "model" | "none";

/** MIME + kind for local preview (data-URL bridge). */
export function mimeForPreviewPath(filePath: string): {
  kind: PreviewMediaKind;
  mime: string | null;
} {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") {
    return { kind: "image", mime: "image/png" };
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return { kind: "image", mime: "image/jpeg" };
  }
  if (ext === ".gif") {
    return { kind: "image", mime: "image/gif" };
  }
  if (ext === ".webp") {
    return { kind: "image", mime: "image/webp" };
  }
  if (ext === ".mp3") {
    return { kind: "audio", mime: "audio/mpeg" };
  }
  if (ext === ".ogg") {
    return { kind: "audio", mime: "audio/ogg" };
  }
  if (ext === ".wav") {
    return { kind: "audio", mime: "audio/wav" };
  }
  if (ext === ".fbx") {
    return { kind: "model", mime: "application/octet-stream" };
  }
  if (ext === ".glb") {
    return { kind: "model", mime: "model/gltf-binary" };
  }
  if (ext === ".gltf") {
    return { kind: "model", mime: "model/gltf+json" };
  }
  if (ext === ".obj") {
    return { kind: "model", mime: "model/obj" };
  }
  return { kind: "none", mime: null };
}

export type ModelPreviewFormat = "fbx" | "glb" | "gltf" | "obj";

export function modelFormatFromPath(filePath: string): ModelPreviewFormat | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".fbx") return "fbx";
  if (ext === ".glb") return "glb";
  if (ext === ".gltf") return "gltf";
  if (ext === ".obj") return "obj";
  return null;
}

export function generateAssetsTs(assets: ProjectAssetsFile["assets"]): string {
  const lines = Object.entries(assets).map(([key, entry]) => {
    return `  ${JSON.stringify(key)}: ${JSON.stringify(`rbxassetid://${entry.assetId}`)},`;
  });

  return `/**
 * Asset ids uploaded via Blockforge. Regenerated when assets are added.
 * Agents MUST import from this file — never invent rbxassetid values.
 */
export const ASSETS = {
${lines.length > 0 ? `${lines.join("\n")}\n` : "  // No assets yet\n"}
} as const;

export type AssetKey = keyof typeof ASSETS;
`;
}

export function mapBankCatalogToEntries(
  rawAssets: Array<Record<string, unknown>>,
): AssetCatalogEntry[] {
  return rawAssets.map((a) => {
    const kind = String(a.kind ?? a.type ?? "model");
    const type: AssetCatalogEntry["type"] =
      kind === "audio"
        ? "audio"
        : kind === "image" || kind === "texture" || kind === "hdri" || kind === "decal"
          ? kind === "decal"
            ? "decal"
            : "image"
          : "model";
    const uploadSupported =
      typeof a.uploadSupported === "boolean"
        ? a.uploadSupported
        : type !== "audio" && kind !== "hdri";
    const file =
      typeof a.file === "string"
        ? a.file
        : typeof a.filePath === "string"
          ? a.filePath
          : undefined;
    return {
      id: String(a.id ?? ""),
      name: String(a.name ?? a.id ?? "Asset"),
      type,
      category: typeof a.category === "string" ? a.category : undefined,
      tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
      license: typeof a.license === "string" ? a.license : undefined,
      attribution: typeof a.attribution === "string" ? a.attribution : undefined,
      previewPath:
        typeof a.thumbnail === "string"
          ? a.thumbnail
          : typeof a.previewPath === "string"
            ? a.previewPath
            : undefined,
      filePath: file,
      uploadSupported,
    };
  });
}

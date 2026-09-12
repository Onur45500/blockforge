import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetCatalogEntry } from "../shared/ipc-types.js";

export type AssetLookupHit = {
  source: string;
  key: string;
  value?: unknown;
  rbxassetid?: string;
};

export async function lookupUploadedAsset(
  projectPath: string,
  query: string,
): Promise<{ query: string; hits: AssetLookupHit[] }> {
  const needle = query.trim().replace(/^rbxassetid:\/\//i, "");
  const hits: AssetLookupHit[] = [];
  if (!needle) {
    return { query, hits };
  }

  try {
    const raw = await readFile(join(projectPath, "assets.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const assets =
      typeof parsed === "object" &&
      parsed !== null &&
      "assets" in parsed &&
      typeof (parsed as { assets: unknown }).assets === "object"
        ? (parsed as { assets: Record<string, unknown> }).assets
        : parsed;
    if (assets && typeof assets === "object" && !Array.isArray(assets)) {
      for (const [key, value] of Object.entries(assets as Record<string, unknown>)) {
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
    const ts = await readFile(join(projectPath, "src", "shared", "assets.ts"), "utf8");
    const re = /([A-Za-z0-9_]+)\s*:\s*"rbxassetid:\/\/(\d+)"/g;
    let match: RegExpExecArray | null = re.exec(ts);
    while (match) {
      const key = match[1] ?? "";
      const id = match[2] ?? "";
      if (key === query || id === needle) {
        hits.push({
          source: "src/shared/assets.ts",
          key,
          rbxassetid: `rbxassetid://${id}`,
        });
      }
      match = re.exec(ts);
    }
  } catch {
    // missing
  }

  return { query, hits };
}

export function scoreAssetSimilarity(
  entry: AssetCatalogEntry,
  query: string,
): number {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return 0;
  }
  const hay = `${entry.name} ${entry.id} ${entry.category ?? ""} ${(entry.tags ?? []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      score += 1;
    }
  }
  if (entry.category && query.toLowerCase().includes(entry.category.toLowerCase())) {
    score += 2;
  }
  return score;
}

export function searchSimilarAssets(
  entries: AssetCatalogEntry[],
  query: string,
  limit: number,
): AssetCatalogEntry[] {
  const ranked = entries
    .map((entry) => ({ entry, score: scoreAssetSimilarity(entry, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((row) => row.entry);
}

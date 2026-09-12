/**
 * HTML parsers for official CC0 catalogs (Kenney / Quaternius).
 * Used by fetch-reference-bank.ts.
 */

const KENNEY_PACK_HREF =
  /href=["'](?:https?:\/\/kenney\.nl)?\/assets\/([a-z0-9][a-z0-9-]*)\/?["']/gi;

const SKIP_SLUGS = new Set([
  "page",
  "tags",
  "tag",
  "search",
  "donate",
  "license",
  "contact",
]);

export function parseKenneyPackSlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const match of html.matchAll(KENNEY_PACK_HREF)) {
    const slug = match[1];
    if (slug === undefined || SKIP_SLUGS.has(slug) || slug.startsWith("page")) {
      continue;
    }
    slugs.add(slug);
  }
  return [...slugs];
}

export function parseZipHrefs(html: string, baseUrl: string): string[] {
  const hrefs = new Set<string>();
  const pattern = /href=["']([^"']+\.zip)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (raw === undefined) {
      continue;
    }
    try {
      hrefs.add(new URL(raw, baseUrl).href);
    } catch {
      // skip malformed
    }
  }
  return [...hrefs];
}

export function parseKenneyPackTitle(html: string): string | undefined {
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1?.[1]) {
    return decodeHtml(h1[1].trim());
  }
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title?.[1]) {
    return decodeHtml(title[1].replace(/\s*[·|].*$/, "").trim());
  }
  return undefined;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export type PolyHavenAsset = {
  name?: string;
    type?: string | number;
  categories?: string[];
  tags?: string[];
  download_count?: number;
};

export type PolyHavenIndex = Record<string, PolyHavenAsset>;

const POLY_HAVEN_TYPE: Record<string, string> = {
  "0": "hdris",
  "1": "textures",
  "2": "models",
  hdris: "hdris",
  textures: "textures",
  models: "models",
};

export function summarizePolyHaven(index: PolyHavenIndex): {
  total: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let total = 0;
  for (const entry of Object.values(index)) {
    total += 1;
    const raw = entry.type === undefined ? "unknown" : String(entry.type);
    const kind = POLY_HAVEN_TYPE[raw] ?? raw;
    byType[kind] = (byType[kind] ?? 0) + 1;
  }
  return { total, byType };
}

export function guessBlockforgeKind(
  filePath: string,
): "model" | "image" | "audio" | "texture" | "other" {
  const ext = filePath.toLowerCase().replace(/^.*\./, "");
  if (["fbx", "obj", "gltf", "glb", "blend", "dae", "3ds"].includes(ext)) {
    return "model";
  }
  if (["wav", "mp3", "ogg", "flac"].includes(ext)) {
    return "audio";
  }
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) {
    const lower = filePath.toLowerCase();
    if (lower.includes("texture") || lower.includes("pbr") || lower.includes("diff")) {
      return "texture";
    }
    return "image";
  }
  if (["hdr", "exr", "hdri"].includes(ext)) {
    return "texture";
  }
  return "other";
}

/**
 * Download official CC0 catalogs into a local inspection folder.
 *
 * Do not scrape proprietary commercial toolboxes. Use this dump only as a
 * reference for which categories Blockforge should add later — never copy
 * files into the shipped catalog or Rojo tree.
 *
 *   pnpm --filter @blockforge/asset-bank fetch-reference-bank
 *   pnpm --filter @blockforge/asset-bank fetch-reference-bank -- --download --out D:/ref-bank
 *
 * Default: metadata only (Kenney pack list + Poly Haven JSON). Add --download
 * to fetch Kenney zips (several GB).
 */
import { spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
} from "node:fs";
import {
  mkdir,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import {
  guessBlockforgeKind,
  parseKenneyPackSlugs,
  parseKenneyPackTitle,
  parseZipHrefs,
  summarizePolyHaven,
  type PolyHavenIndex,
} from "./reference-bank-parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const USER_AGENT =
  "BlockforgeReferenceBank/0.1 (+https://github.com; CC0 Kenney/Poly Haven inspection only)";

type Args = {
  out: string;
  download: boolean;
  metadataOnly: boolean;
  limitPacks: number;
  skipPolyhaven: boolean;
  skipKenney: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    out: join(PACKAGE_ROOT, ".reference-bank"),
    download: false,
    metadataOnly: false,
    limitPacks: 0,
    skipPolyhaven: false,
    skipKenney: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--out" && next) {
      args.out = resolve(next);
      i += 1;
    } else if (token === "--download") {
      args.download = true;
    } else if (token === "--metadata-only") {
      args.metadataOnly = true;
    } else if (token === "--limit-packs" && next) {
      args.limitPacks = Number(next);
      i += 1;
    } else if (token === "--skip-polyhaven") {
      args.skipPolyhaven = true;
    } else if (token === "--skip-kenney") {
      args.skipKenney = true;
    } else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  if (args.metadataOnly) {
    args.download = false;
  }
  return args;
}

function printHelp(): void {
  console.log(`fetch-reference-bank — official CC0 catalogs for inspection

This fetches Kenney.nl packs and Poly Haven metadata so you can design
original Blockforge catalog entries. Do not scrape proprietary toolboxes.

Options:
  --out <dir>          Output folder (default: packages/asset-bank/.reference-bank)
  --download           Also download + unzip Kenney CC0 zips (large)
  --metadata-only      Pack lists / JSON only (default behavior)
  --limit-packs <n>    Stop after n Kenney packs (useful for a smoke test)
  --skip-kenney
  --skip-polyhaven
`);
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/json" },
    redirect: "follow",
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  if (existsSync(dest) && (await stat(dest)).size > 0) {
    return;
  }
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
  });
  if (!response.ok || response.body === null) {
    throw new Error(`GET ${url} → ${response.status}`);
  }
  const tmp = `${dest}.part`;
  await pipeline(
    Readable.fromWeb(response.body as import("stream/web").ReadableStream),
    createWriteStream(tmp),
  );
  await rename(tmp, dest);
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolveExtract, reject) => {
    const child = spawn("tar", ["-xf", zipPath, "-C", destDir], {
      windowsHide: true,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveExtract();
      } else {
        reject(new Error(`tar -xf exited ${String(code)} for ${zipPath}`));
      }
    });
  });
}

async function collectKenneyPacks(limit: number): Promise<
  { slug: string; pageUrl: string; title: string; zipUrls: string[] }[]
> {
  const slugs = new Set<string>();
  for (let page = 1; page <= 30; page++) {
    const url = page === 1 ? "https://kenney.nl/assets" : `https://kenney.nl/assets/page:${page}`;
    const { status, body } = await fetchText(url);
    if (status !== 200) {
      break;
    }
    const found = parseKenneyPackSlugs(body);
    const before = slugs.size;
    for (const slug of found) {
      slugs.add(slug);
    }
    if (found.length === 0 || slugs.size === before) {
      break;
    }
    console.log(`Kenney index page ${page}: ${found.length} pack hrefs (${slugs.size} unique)`);
    if (limit > 0 && slugs.size >= limit) {
      break;
    }
  }

  let list = [...slugs].sort();
  if (limit > 0) {
    list = list.slice(0, limit);
  }

  const packs: { slug: string; pageUrl: string; title: string; zipUrls: string[] }[] = [];
  for (const slug of list) {
    const pageUrl = `https://kenney.nl/assets/${slug}`;
    try {
      const { status, body } = await fetchText(pageUrl);
      if (status !== 200) {
        console.warn(`Skip ${pageUrl} (${status})`);
        continue;
      }
      packs.push({
        slug,
        pageUrl,
        title: parseKenneyPackTitle(body) ?? slug,
        zipUrls: parseZipHrefs(body, pageUrl),
      });
    } catch (error) {
      console.warn(`Skip ${pageUrl}:`, error);
    }
  }
  return packs;
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

async function writeInventory(
  outDir: string,
  kenneyPacks: { slug: string; pageUrl: string; title: string; zipUrls: string[] }[],
  polyhaven: PolyHavenIndex | undefined,
): Promise<void> {
  const filesRoot = join(outDir, "kenney");
  const files = existsSync(filesRoot) ? await walkFiles(filesRoot) : [];
  const byKind: Record<string, number> = {};
  const byExt: Record<string, number> = {};
  for (const file of files) {
    const ext = extname(file).toLowerCase() || "(none)";
    byExt[ext] = (byExt[ext] ?? 0) + 1;
    const kind = guessBlockforgeKind(file);
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }

  const poly = polyhaven ? summarizePolyHaven(polyhaven) : undefined;
  const inventory = {
    generatedAt: new Date().toISOString(),
    purpose:
      "Inspection-only CC0 reference. Do not copy into packages/asset-bank/catalog or the game template.",
    kenney: {
      packCount: kenneyPacks.length,
      packsWithZip: kenneyPacks.filter((p) => p.zipUrls.length > 0).length,
      extractedFileCount: files.length,
      byKind,
      byExt,
      packs: kenneyPacks.map((p) => ({
        slug: p.slug,
        title: p.title,
        pageUrl: p.pageUrl,
        zipCount: p.zipUrls.length,
      })),
    },
    polyhaven: poly,
  };

  await writeFile(join(outDir, "inventory.json"), JSON.stringify(inventory, null, 2));

  const md: string[] = [
    "# CC0 reference bank inventory",
    "",
    "Inspection only. Official CC0 catalogs — do not scrape proprietary toolboxes.",
    "Use pack titles and file-type mix to plan original Blockforge catalog slots.",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    "## Kenney.nl",
    "",
    `- Packs listed: ${kenneyPacks.length}`,
    `- Packs with a zip link: ${inventory.kenney.packsWithZip}`,
    `- Extracted files: ${files.length}`,
    "",
    "### By guessed kind",
    "",
  ];
  for (const [kind, count] of Object.entries(byKind).sort()) {
    md.push(`- ${kind}: ${count}`);
  }
  md.push("", "### Packs", "");
  for (const pack of kenneyPacks) {
    md.push(`- [${pack.title}](${pack.pageUrl}) (\`${pack.slug}\`) — ${pack.zipUrls.length} zip(s)`);
  }
  if (poly) {
    md.push("", "## Poly Haven API", "", `- Assets: ${poly.total}`, "");
    for (const [type, count] of Object.entries(poly.byType).sort()) {
      md.push(`- ${type}: ${count}`);
    }
  }
  md.push(
    "",
    "## Next for Blockforge",
    "",
    "Pick gaps vs `scripts/seed.ts` (crate, tree, UI icon, …) and add **original**",
    "catalog ids + CC0 download URLs. Do not vendor this folder into the app.",
    "",
  );
  await writeFile(join(outDir, "inventory.md"), md.join("\n"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });
  await writeFile(
    join(args.out, "README.md"),
    [
      "# Reference bank (local, gitignored)",
      "",
      "Official **CC0** Kenney / Poly Haven dumps for designing Blockforge catalog",
      "entries. Official CC0 dumps only — do not scrape proprietary toolboxes.",
      "",
      "Do not copy these files into `catalog/`, `pack/curated/`, or a game `world/`.",
      "",
    ].join("\n"),
  );

  let kenneyPacks: {
    slug: string;
    pageUrl: string;
    title: string;
    zipUrls: string[];
  }[] = [];

  if (!args.skipKenney) {
    console.log("Crawling kenney.nl/assets …");
    kenneyPacks = await collectKenneyPacks(args.limitPacks);
    await writeFile(
      join(args.out, "kenney-packs.json"),
      JSON.stringify(kenneyPacks, null, 2),
    );
    console.log(`Kenney packs: ${kenneyPacks.length}`);
  }

  let polyhaven: PolyHavenIndex | undefined;
  if (!args.skipPolyhaven) {
    console.log("Fetching Poly Haven asset index …");
    const { status, body } = await fetchText("https://api.polyhaven.com/assets");
    if (status !== 200) {
      console.warn(`Poly Haven API ${status}`);
    } else {
      polyhaven = JSON.parse(body) as PolyHavenIndex;
      await writeFile(join(args.out, "polyhaven-assets.json"), body);
      const summary = summarizePolyHaven(polyhaven);
      console.log(`Poly Haven assets: ${summary.total}`);
    }
  }

  if (args.download && !args.skipKenney) {
    const zipDir = join(args.out, "kenney", "zips");
    const extractRoot = join(args.out, "kenney", "extracted");
    await mkdir(zipDir, { recursive: true });
    await mkdir(extractRoot, { recursive: true });
    for (const pack of kenneyPacks) {
      for (const zipUrl of pack.zipUrls) {
        const name = zipUrl.split("/").pop() ?? `${pack.slug}.zip`;
        const dest = join(zipDir, `${pack.slug}__${name}`);
        console.log(`Download ${pack.slug} ← ${zipUrl}`);
        try {
          await downloadFile(zipUrl, dest);
          const extractDir = join(extractRoot, pack.slug);
          await mkdir(extractDir, { recursive: true });
          await extractZip(dest, extractDir);
        } catch (error) {
          console.warn(`Failed ${pack.slug}:`, error);
        }
      }
    }
  } else if (!args.download) {
    console.log("Skipping zip download (pass --download to fetch Kenney binaries).");
  }

  await writeInventory(args.out, kenneyPacks, polyhaven);
  console.log(`Wrote inventory → ${relative(PACKAGE_ROOT, args.out) || args.out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

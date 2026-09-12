import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  access,
  readdir,
} from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const PACK_VERSION = "0.5.0";
const GITHUB_OWNER = process.env.BLOCKFORGE_GITHUB_OWNER ?? "blockforge";
const GITHUB_REPO = process.env.BLOCKFORGE_GITHUB_REPO ?? "blockforge";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dir: string, base: string): Promise<string[]> {
  if (!(await exists(dir))) {
    return [];
  }
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, base)));
    } else if (entry.isFile()) {
      out.push(relative(base, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

/**
 * Packages catalog + fixtures + curated binaries for GitHub Releases CDN.
 * Writes pack/manifest.json with version + sha256 for desktop download/cache.
 */
async function main(): Promise<void> {
  const outDir = join(packageRoot, "pack");
  await mkdir(outDir, { recursive: true });
  const catalog = await readFile(join(packageRoot, "catalog/index.json"), "utf8");
  await writeFile(join(outDir, "index.json"), catalog);

  for (const name of ["sample.png", "sample.fbx"]) {
    const src = join(packageRoot, "fixtures", name);
    if (await exists(src)) {
      await mkdir(join(outDir, "fixtures"), { recursive: true });
      await copyFile(src, join(outDir, "fixtures", name));
    }
  }

  // Include curated + converted binaries already under pack/
  const binaryRels = [
    ...(await collectFiles(join(outDir, "curated"), outDir)),
    ...(await collectFiles(join(outDir, "converted"), outDir)),
    ...(await collectFiles(join(outDir, "fixtures"), outDir)),
  ];

  const fileList = ["index.json", ...binaryRels.filter((r) => r !== "index.json")];
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from(`# blockforge-assets v${PACK_VERSION}\n`));
  for (const rel of fileList) {
    const abs = join(outDir, rel);
    if (!(await exists(abs))) continue;
    const data = await readFile(abs);
    chunks.push(Buffer.from(`FILE ${rel} ${data.length}\n`));
    chunks.push(data);
    chunks.push(Buffer.from("\n"));
  }

  const tarGz = join(outDir, `blockforge-assets-v${PACK_VERSION}.tar.gz`);
  const gzip = createGzip();
  const out = createWriteStream(tarGz);
  await pipeline(Readable.from(Buffer.concat(chunks)), gzip, out);

  const bytes = await readFile(tarGz);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/assets-v${PACK_VERSION}/blockforge-assets-v${PACK_VERSION}.tar.gz`;

  const manifest = {
    version: PACK_VERSION,
    generatedAt: new Date().toISOString(),
    artifact: `blockforge-assets-v${PACK_VERSION}.tar.gz`,
    sha256,
    downloadUrl,
    downloadUrlTemplate: downloadUrl,
    binaryCount: binaryRels.length,
    license: "CC0-1.0",
  };
  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  await writeFile(
    join(outDir, "LICENSES.md"),
    await readFile(join(packageRoot, "pack", "LICENSES.md"), "utf8").catch(
      async () =>
        `# Asset licenses\n\nAll catalog entries are **CC0 1.0**.\n`,
    ),
  );
  console.log(`Pack ready at ${outDir}`);
  console.log(`Binaries listed: ${binaryRels.length}`);
  console.log(`sha256: ${sha256}`);
  console.log(`downloadUrl: ${downloadUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

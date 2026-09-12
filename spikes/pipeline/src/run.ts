import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  writeFile,
  access,
  readdir,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { OpenCloudClient, mapOpenCloudError } from "@blockforge/open-cloud";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const templateDir = join(repoRoot, "packages/project-template");
const cacheDir = join(__dirname, "../.cache");
const outputDir = join(__dirname, "../output");
const fixturesDir = join(repoRoot, "packages/asset-bank/fixtures");

const ROJO_VERSION = "7.7.0";

type StepResult = { name: string; ok: boolean; detail: string };

function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      windowsHide: true,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      process.stderr.write(d);
    });
    child.on("error", (error) => {
      resolvePromise({ code: 1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function findFileRecursive(
  root: string,
  targetName: string,
): Promise<string | null> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFileRecursive(full, targetName);
      if (nested) return nested;
    } else if (entry.name.toLowerCase() === targetName.toLowerCase()) {
      return full;
    }
  }
  return null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureRojo(): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const exeName = process.platform === "win32" ? "rojo.exe" : "rojo";
  const rojoPath = join(cacheDir, exeName);
  if (await pathExists(rojoPath)) {
    return rojoPath;
  }

  const platform =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "macos"
        : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  const assetName = `rojo-${ROJO_VERSION}-${arch}-${platform}.zip`;
  // Rojo releases use different naming — try GitHub API for latest asset
  const releaseUrl = `https://api.github.com/repos/rojo-rbx/rojo/releases/tags/v${ROJO_VERSION}`;
  console.log(`Fetching Rojo ${ROJO_VERSION} release metadata...`);
  const releaseRes = await fetch(releaseUrl, {
    headers: { "User-Agent": "blockforge-spike" },
  });
  if (!releaseRes.ok) {
    throw new Error(`Failed to fetch Rojo release: ${releaseRes.status}`);
  }
  const release = (await releaseRes.json()) as {
    assets: Array<{ name: string; browser_download_url: string }>;
  };

  const preferred = release.assets.find((a) =>
    a.name.toLowerCase().includes(platform === "windows" ? "win" : platform),
  );
  const asset = preferred ?? release.assets.find((a) => a.name.endsWith(".zip"));
  if (!asset) {
    throw new Error(`No Rojo binary asset found for ${platform}`);
  }

  console.log(`Downloading ${asset.name}...`);
  const zipPath = join(cacheDir, asset.name);
  const binRes = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": "blockforge-spike" },
    redirect: "follow",
  });
  if (!binRes.ok || !binRes.body) {
    throw new Error(`Download failed: ${binRes.status}`);
  }
  await pipeline(binRes.body as unknown as NodeJS.ReadableStream, createWriteStream(zipPath));

  // Extract with PowerShell on Windows, unzip elsewhere
  if (process.platform === "win32") {
    const expand = await run(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Force -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${cacheDir.replace(/'/g, "''")}'`,
      ],
      cacheDir,
    );
    if (expand.code !== 0) {
      throw new Error(`Expand-Archive failed: ${expand.stderr || expand.stdout}`);
    }
  } else {
    const unzip = await run("unzip", ["-o", zipPath, "-d", cacheDir], cacheDir);
    if (unzip.code !== 0) {
      throw new Error(`unzip failed: ${unzip.stderr || unzip.stdout}`);
    }
  }

  const found = await findFileRecursive(
    cacheDir,
    process.platform === "win32" ? "rojo.exe" : "rojo",
  );
  if (!found) {
    throw new Error("rojo binary not found after extract");
  }
  if (found !== rojoPath) {
    await copyFile(found, rojoPath);
  }
  return rojoPath;
}

async function compileTemplate(): Promise<StepResult> {
  console.log("\n==> Compiling project-template with rbxtsc");
  const result = await run("npx", ["rbxtsc"], templateDir);
  if (result.code !== 0) {
    return { name: "compile", ok: false, detail: result.stderr || result.stdout };
  }
  const copyInclude = await run(
    "node",
    ["./scripts/copy-include.mjs"],
    templateDir,
  );
  if (copyInclude.code !== 0) {
    return {
      name: "compile",
      ok: false,
      detail: copyInclude.stderr || copyInclude.stdout,
    };
  }
  return { name: "compile", ok: true, detail: "rbxtsc succeeded" };
}

async function buildPlace(rojoPath: string): Promise<StepResult> {
  console.log("\n==> Building place with rojo build");
  await mkdir(outputDir, { recursive: true });
  const outFile = join(outputDir, "spike.rbxl");
  const result = await run(rojoPath, ["build", "-o", outFile], templateDir);
  if (result.code !== 0) {
    return { name: "rojo-build", ok: false, detail: result.stderr || result.stdout };
  }
  if (!(await pathExists(outFile))) {
    return { name: "rojo-build", ok: false, detail: "output file missing" };
  }
  return { name: "rojo-build", ok: true, detail: outFile };
}

async function publishPlace(placePath: string): Promise<StepResult> {
  const apiKey = process.env.ROBLOX_API_KEY;
  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const placeId = process.env.ROBLOX_PLACE_ID;
  if (!apiKey || !universeId || !placeId) {
    return {
      name: "publish",
      ok: true,
      detail:
        "SKIPPED (set ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, ROBLOX_PLACE_ID to exercise live publish)",
    };
  }

  console.log("\n==> Publishing place via Open Cloud");
  try {
    const client = new OpenCloudClient({ apiKey });
    const result = await client.publishPlace({
      universeId,
      placeId,
      placeFilePath: placePath,
    });
    return {
      name: "publish",
      ok: true,
      detail: `Published version ${result.versionNumber}`,
    };
  } catch (error) {
    const mapped = mapOpenCloudError(error);
    return { name: "publish", ok: false, detail: JSON.stringify(mapped) };
  }
}

async function uploadFixtures(): Promise<StepResult> {
  const apiKey = process.env.ROBLOX_API_KEY;
  const userId = process.env.ROBLOX_USER_ID;
  if (!apiKey || !userId) {
    return {
      name: "asset-upload",
      ok: true,
      detail:
        "SKIPPED (set ROBLOX_API_KEY and ROBLOX_USER_ID to exercise live asset upload)",
    };
  }

  console.log("\n==> Uploading fixture fbx + png via Assets API");
  const fbx = join(fixturesDir, "sample.fbx");
  const png = join(fixturesDir, "sample.png");
  if (!(await pathExists(fbx)) || !(await pathExists(png))) {
    return {
      name: "asset-upload",
      ok: false,
      detail: "Missing fixtures in packages/asset-bank/fixtures (sample.fbx, sample.png)",
    };
  }

  try {
    const client = new OpenCloudClient({ apiKey });
    const model = await client.uploadAssetAndWait({
      assetType: "Model",
      displayName: "Blockforge Spike Model",
      description: "Milestone 0 pipeline spike fixture",
      filePath: fbx,
      creator: { userId: Number(userId) },
    });
    const decal = await client.uploadAssetAndWait({
      assetType: "Decal",
      displayName: "Blockforge Spike Decal",
      description: "Milestone 0 pipeline spike fixture",
      filePath: png,
      creator: { userId: Number(userId) },
    });
    return {
      name: "asset-upload",
      ok: true,
      detail: `model=${model.assetId} decal=${decal.assetId}`,
    };
  } catch (error) {
    const mapped = mapOpenCloudError(error);
    return { name: "asset-upload", ok: false, detail: JSON.stringify(mapped) };
  }
}

async function writeReport(results: StepResult[]): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    results,
  };
  await writeFile(join(outputDir, "spike-report.json"), JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  const compileOnly = process.argv.includes("--compile-only");
  const results: StepResult[] = [];

  // Ensure template deps
  console.log("==> Installing template dependencies");
  const install = await run("npm", ["install"], templateDir);
  if (install.code !== 0) {
    results.push({ name: "install", ok: false, detail: install.stderr });
    await writeReport(results);
    process.exit(1);
  }
  results.push({ name: "install", ok: true, detail: "ok" });

  const compile = await compileTemplate();
  results.push(compile);
  if (!compile.ok) {
    await writeReport(results);
    process.exit(1);
  }

  if (compileOnly) {
    await writeReport(results);
    console.log("\nCompile-only spike OK");
    return;
  }

  let rojoPath: string;
  try {
    rojoPath = await ensureRojo();
    results.push({ name: "rojo-download", ok: true, detail: rojoPath });
  } catch (error) {
    results.push({
      name: "rojo-download",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
    await writeReport(results);
    process.exit(1);
  }

  const build = await buildPlace(rojoPath);
  results.push(build);
  if (!build.ok) {
    await writeReport(results);
    process.exit(1);
  }

  results.push(await publishPlace(build.detail));
  results.push(await uploadFixtures());

  await writeReport(results);
  const failed = results.filter((r) => !r.ok);
  console.log("\n==> Spike report");
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FAIL"}  ${r.name}: ${r.detail}`);
  }
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

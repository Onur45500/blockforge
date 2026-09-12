/**
 * Compute the next Blockforge app version and write it to package.json files.
 *
 * Usage (repo root):
 *   node scripts/ci-prepare-release.mjs
 *
 * If apps/desktop/package.json is already newer than the latest git tag v*,
 * that version is kept (manual minor/major bump). Otherwise the patch number
 * increments from the greater of package.json and the latest tag.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseSemver(raw) {
  const m = String(raw)
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function formatSemver(parts) {
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function compareSemver(a, b) {
  const aa = parseSemver(a);
  const bb = parseSemver(b);
  if (!aa && !bb) {
    return 0;
  }
  if (!aa) {
    return -1;
  }
  if (!bb) {
    return 1;
  }
  for (let i = 0; i < 3; i += 1) {
    const left = aa[i] ?? 0;
    const right = bb[i] ?? 0;
    if (left !== right) {
      return left - right;
    }
  }
  return 0;
}

export function bumpPatch(version) {
  const parsed = parseSemver(version) ?? [0, 1, 0];
  return formatSemver([parsed[0], parsed[1], parsed[2] + 1]);
}

export function nextReleaseVersion(packageVersion, tags) {
  const tagVersions = tags
    .map((tag) => String(tag).trim())
    .filter((tag) => /^v?\d+\.\d+\.\d+/.test(tag))
    .map((tag) => tag.replace(/^v/i, ""));

  let latestTag = "0.0.0";
  for (const version of tagVersions) {
    if (compareSemver(version, latestTag) > 0) {
      latestTag = version;
    }
  }

  const pkg = parseSemver(packageVersion)
    ? String(packageVersion).trim().replace(/^v/i, "")
    : "0.1.0";

  if (compareSemver(pkg, latestTag) > 0) {
    return pkg;
  }

  const base = compareSemver(pkg, latestTag) >= 0 ? pkg : latestTag;
  return bumpPatch(base);
}

export function listGitTags(cwd) {
  try {
    const out = execFileSync("git", ["tag", "-l", "v*"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

export function writePackageVersion(filePath, version) {
  const json = JSON.parse(readFileSync(filePath, "utf8"));
  json.version = version;
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

export function prepareRelease(repoRoot = root) {
  const desktopPkg = join(repoRoot, "apps/desktop/package.json");
  const rootPkg = join(repoRoot, "package.json");
  const current = JSON.parse(readFileSync(desktopPkg, "utf8")).version;
  const version = nextReleaseVersion(current, listGitTags(repoRoot));
  writePackageVersion(desktopPkg, version);
  writePackageVersion(rootPkg, version);
  return version;
}

function main() {
  const version = prepareRelease(root);
  const ghOut = process.env.GITHUB_OUTPUT;
  if (ghOut) {
    writeFileSync(ghOut, `version=${version}\n`, { flag: "a" });
  }
  console.log(version);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  main();
}

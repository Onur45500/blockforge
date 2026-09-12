/**
 * Upgrade an existing Blockforge project to the current project-template version.
 * Overwrites managed docs/hooks/scripts; never touches src/, world/, assets.json, or existing notes/.
 */
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";
import type { TemplateUpgradeResult } from "../shared/ipc-types.js";

const MANAGED_ROOT_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".gitignore",
  ".mcp.json",
] as const;

const MANAGED_DIRS = ["docs", "scripts", ".claude", ".agents", "studio-tools"] as const;

const PACKAGE_SCRIPTS_TO_MERGE = [
  "build",
  "watch",
  "typecheck",
  "lint",
  "validate:world",
  "validate:refs",
  "copy-include",
  "map-toolkit",
  "lookup-asset",
  "notes",
  "clean-restart",
  "audit-scenery",
  "skills",
] as const;

function parseSemver(v: string): [number, number, number] {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) {
    return [0, 0, 0];
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: string, b: string): number {
  const aa = parseSemver(a);
  const bb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const left = aa[i] ?? 0;
    const right = bb[i] ?? 0;
    if (left !== right) {
      return left - right;
    }
  }
  return 0;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileSha256(path: string): Promise<string | null> {
  try {
    const buf = await readFile(path);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function copyFileOverwrite(src: string, dest: string): Promise<void> {
  await mkdir(join(dest, ".."), { recursive: true });
  const buf = await readFile(src);
  await writeFile(dest, buf);
}

async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await cp(srcDir, destDir, { recursive: true, force: true });
}

async function listFilesRecursive(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await listFilesRecursive(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

type PackageJsonShape = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  blockforge?: { templateVersion?: string };
};

async function runNpmInstall(cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install"], {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install failed with exit code ${String(code)}`));
      }
    });
  });
}

export async function readTemplateVersion(templateDir: string): Promise<string> {
  const pkg = await readJsonFile<PackageJsonShape>(join(templateDir, "package.json"));
  return pkg?.blockforge?.templateVersion ?? "0.0.0";
}

export async function readProjectTemplateVersion(projectDir: string): Promise<string> {
  const bf = await readJsonFile<{ templateVersion?: string }>(
    join(projectDir, "blockforge.json"),
  );
  if (bf?.templateVersion) {
    return bf.templateVersion;
  }
  const meta = await readJsonFile<{ templateVersion?: string }>(
    join(projectDir, ".blockforge", "meta.json"),
  );
  return meta?.templateVersion ?? "0.0.0";
}

/**
 * Upgrade projectDir to match templateDir when project version is older.
 */
export async function upgradeProjectTemplate(
  projectDir: string,
  templateDir: string,
): Promise<TemplateUpgradeResult> {
  const from = await readProjectTemplateVersion(projectDir);
  const to = await readTemplateVersion(templateDir);
  const skipped: string[] = [];

  if (compareSemver(from, to) >= 0) {
    return { upgraded: false, from, to, skipped };
  }

  // Overwrite managed root files
  for (const name of MANAGED_ROOT_FILES) {
    const src = join(templateDir, name);
    if (!(await pathExists(src))) {
      skipped.push(name);
      continue;
    }
    await copyFileOverwrite(src, join(projectDir, name));
  }

  // Overwrite managed directories
  for (const dirName of MANAGED_DIRS) {
    const src = join(templateDir, dirName);
    if (!(await pathExists(src))) {
      skipped.push(dirName);
      continue;
    }
    await copyDirRecursive(src, join(projectDir, dirName));
  }

  // Seed notes/ only when the project has none — never overwrite user GDD.
  const notesDest = join(projectDir, "notes");
  const notesSrc = join(templateDir, "notes");
  if (!(await pathExists(notesDest)) && (await pathExists(notesSrc))) {
    await copyDirRecursive(notesSrc, notesDest);
  }

  // default.project.json: only overwrite if missing or still matches an older
  // template-like tree (has Workspace.World path). If user heavily customized, skip.
  const projectJsonSrc = join(templateDir, "default.project.json");
  const projectJsonDest = join(projectDir, "default.project.json");
  if (await pathExists(projectJsonSrc)) {
    const destExists = await pathExists(projectJsonDest);
    if (!destExists) {
      await copyFileOverwrite(projectJsonSrc, projectJsonDest);
    } else {
      const destRaw = await readFile(projectJsonDest, "utf8");
      const looksStandard =
        destRaw.trim() === "" ||
        (destRaw.includes('"World"') && destRaw.includes('"out/server"'));
      if (looksStandard) {
        await copyFileOverwrite(projectJsonSrc, projectJsonDest);
      } else {
        skipped.push("default.project.json (customized)");
      }
    }
  }

  // Merge package.json scripts + missing deps; never touch name
  const templatePkg =
    (await readJsonFile<PackageJsonShape>(join(templateDir, "package.json"))) ??
    {};
  const projectPkgPath = join(projectDir, "package.json");
  const projectPkg =
    (await readJsonFile<PackageJsonShape>(projectPkgPath)) ?? { scripts: {} };

  projectPkg.scripts = projectPkg.scripts ?? {};
  for (const key of PACKAGE_SCRIPTS_TO_MERGE) {
    const value = templatePkg.scripts?.[key];
    if (typeof value === "string") {
      projectPkg.scripts[key] = value;
    }
  }

  let depsChanged = false;
  projectPkg.devDependencies = projectPkg.devDependencies ?? {};
  for (const [key, value] of Object.entries(templatePkg.devDependencies ?? {})) {
    if (!projectPkg.devDependencies[key]) {
      projectPkg.devDependencies[key] = value;
      depsChanged = true;
    }
  }
  projectPkg.dependencies = projectPkg.dependencies ?? {};
  for (const [key, value] of Object.entries(templatePkg.dependencies ?? {})) {
    if (!projectPkg.dependencies[key]) {
      projectPkg.dependencies[key] = value;
      depsChanged = true;
    }
  }
  projectPkg.blockforge = { ...(projectPkg.blockforge ?? {}), templateVersion: to };

  await writeFile(projectPkgPath, `${JSON.stringify(projectPkg, null, 2)}\n`, "utf8");

  await writeFile(
    join(projectDir, "blockforge.json"),
    `${JSON.stringify({ templateVersion: to }, null, 2)}\n`,
    "utf8",
  );

  const metaPath = join(projectDir, ".blockforge", "meta.json");
  await mkdir(join(projectDir, ".blockforge"), { recursive: true });
  const meta =
    (await readJsonFile<Record<string, unknown>>(metaPath)) ?? {};
  meta.templateVersion = to;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  if (depsChanged) {
    try {
      await runNpmInstall(projectDir);
    } catch (err) {
      skipped.push(
        `npm install (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  // Touch so callers can see we copied scripts
  void relative;
  void fileSha256;
  void listFilesRecursive;

  return { upgraded: true, from, to, skipped };
}

/** Current template version shipped with the app (for UI badges). */
export async function getCurrentTemplateVersion(
  templateDir: string,
): Promise<string> {
  return readTemplateVersion(templateDir);
}

#!/usr/bin/env node
/**
 * List or init the notes/ GDD tree (persistent agent memory).
 */
import { mkdir, readdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOTES = join(ROOT, "notes");
const cmd = (process.argv[2] ?? "list").trim();

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(abs, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(relative(NOTES, abs).replaceAll("\\", "/"));
    }
  }
  return out;
}

if (cmd === "init") {
  await mkdir(join(NOTES, "general"), { recursive: true });
  await mkdir(join(NOTES, "design"), { recursive: true });
  const readme = join(NOTES, "README.md");
  if (!(await exists(readme))) {
    await writeFile(
      readme,
      "# Notes\n\nPersistent GDD. Agents: read before inventing lore; add slices under `design/`.\n",
      "utf8",
    );
  }
  console.log("notes/ ready (general, design)");
  process.exit(0);
}

if (!(await exists(NOTES))) {
  console.log("notes/ missing — run: npm run notes -- init");
  process.exit(0);
}

const files = (await walk(NOTES)).sort();
if (files.length === 0) {
  console.log("notes/ is empty");
} else {
  for (const f of files) {
    console.log(f);
  }
}

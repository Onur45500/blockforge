#!/usr/bin/env node
/**
 * Print Blockforge topic skills (Claude Code SKILL.md frontmatter).
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, ".claude", "skills");

let entries;
try {
  entries = await readdir(SKILLS, { withFileTypes: true });
} catch {
  console.error("Missing .claude/skills — restore the Blockforge template.");
  process.exit(1);
}

const rows = [];
for (const e of entries) {
  if (!e.isDirectory()) {
    continue;
  }
  const skillPath = join(SKILLS, e.name, "SKILL.md");
  try {
    const raw = await readFile(skillPath, "utf8");
    const name = raw.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? e.name;
    const description = raw.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    rows.push({ id: e.name, name, description });
  } catch {
    // skip folders without SKILL.md
  }
}

rows.sort((a, b) => a.id.localeCompare(b.id));
if (rows.length === 0) {
  console.error("No SKILL.md files found");
  process.exit(1);
}

console.log(`Blockforge skills (${String(rows.length)}) — read .claude/skills/<id>/SKILL.md before domain work:\n`);
for (const row of rows) {
  console.log(`${row.id}\t${row.description}`);
}

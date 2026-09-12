import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AttributionRow = {
  catalogId: string;
  name: string;
  license: string;
  attribution: string;
  source: string;
  insertedAt: string;
  key?: string;
};

export type AttributionFile = {
  version: number;
  entries: AttributionRow[];
};

function attributionJsonPath(projectPath: string): string {
  return join(projectPath, ".blockforge", "attribution.json");
}

function attributionMdPath(projectPath: string): string {
  return join(projectPath, "ATTRIBUTION.md");
}

async function readAttribution(projectPath: string): Promise<AttributionFile> {
  try {
    const raw = await readFile(attributionJsonPath(projectPath), "utf8");
    return JSON.parse(raw) as AttributionFile;
  } catch {
    return { version: 1, entries: [] };
  }
}

function renderMarkdown(file: AttributionFile): string {
  const lines = [
    "# Attribution",
    "",
    "Third-party assets used in this Blockforge project.",
    "Roblox has no reliable in-game attribution surface — keep this file with the project.",
    "",
  ];
  if (file.entries.length === 0) {
    lines.push("_No attributed assets yet._", "");
    return lines.join("\n");
  }
  for (const row of file.entries) {
    lines.push(`## ${row.name}`);
    lines.push("");
    lines.push(`- License: ${row.license}`);
    lines.push(`- Attribution: ${row.attribution}`);
    lines.push(`- Source: ${row.source}`);
    lines.push(`- Catalog id: \`${row.catalogId}\``);
    if (row.key) {
      lines.push(`- Project key: \`${row.key}\``);
    }
    lines.push(`- Inserted: ${row.insertedAt}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function listAttribution(
  projectPath: string,
): Promise<AttributionFile> {
  return readAttribution(projectPath);
}

export async function recordAttribution(
  projectPath: string,
  row: Omit<AttributionRow, "insertedAt"> & { insertedAt?: string },
): Promise<AttributionFile> {
  const file = await readAttribution(projectPath);
  const next: AttributionRow = {
    ...row,
    insertedAt: row.insertedAt ?? new Date().toISOString(),
  };
  const existingIdx = file.entries.findIndex(
    (e) => e.catalogId === next.catalogId && e.key === next.key,
  );
  if (existingIdx >= 0) {
    file.entries[existingIdx] = next;
  } else {
    file.entries.push(next);
  }
  await mkdir(join(projectPath, ".blockforge"), { recursive: true });
  await writeFile(
    attributionJsonPath(projectPath),
    JSON.stringify(file, null, 2),
    "utf8",
  );
  await writeFile(attributionMdPath(projectPath), renderMarkdown(file), "utf8");
  return file;
}

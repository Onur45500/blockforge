import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import type {
  SyncbackResolveRequest,
  SyncbackStatus,
} from "../shared/ipc-types.js";
import { getOpenCloudSettings } from "./open-cloud-store.js";

type ConflictStore = {
  conflicts: Array<{ id: string; path: string; detail: string; studioHash: string; diskHash: string }>;
  keptDiskHashes: Record<string, string>;
  lastScanAt: string | null;
};

function storePath(projectPath: string): string {
  return join(projectPath, ".blockforge", "syncback-conflicts.json");
}

async function readStore(projectPath: string): Promise<ConflictStore> {
  try {
    const raw = await readFile(storePath(projectPath), "utf8");
    const parsed = JSON.parse(raw) as Partial<ConflictStore>;
    return {
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      keptDiskHashes:
        parsed.keptDiskHashes && typeof parsed.keptDiskHashes === "object"
          ? parsed.keptDiskHashes
          : {},
      lastScanAt: typeof parsed.lastScanAt === "string" ? parsed.lastScanAt : null,
    };
  } catch {
    return { conflicts: [], keptDiskHashes: {}, lastScanAt: null };
  }
}

async function writeStore(projectPath: string, store: ConflictStore): Promise<void> {
  await mkdir(join(projectPath, ".blockforge"), { recursive: true });
  await writeFile(storePath(projectPath), JSON.stringify(store, null, 2), "utf8");
}

async function hashFile(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path);
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    return null;
  }
}

export function syncbackConflictId(path: string): string {
  return createHash("sha256")
    .update(path.replaceAll("\\", "/").toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

/**
 * Experimental syncback conflict scanner.
 * Compares Studio export snapshots under .blockforge/studio-exports/ to disk world/.
 * Never overwrites — only records conflicts for explicit Keep disk / Take Studio / Open diff.
 */
export async function getSyncbackStatus(projectPath: string): Promise<SyncbackStatus> {
  const settings = await getOpenCloudSettings();
  const enabled = settings.experimentalSyncback === true;
  if (!enabled) {
    return { enabled: false, conflicts: [], lastScanAt: null };
  }

  const store = await readStore(projectPath);
  const exportRoot = join(projectPath, ".blockforge", "studio-exports");
  const worldRoot = join(projectPath, "world");
  const conflicts: ConflictStore["conflicts"] = [];

  let exportEntries: string[] = [];
  try {
    exportEntries = await readdir(exportRoot);
  } catch {
    // no exports yet
  }

  for (const name of exportEntries) {
    const studioPath = join(exportRoot, name);
    const diskPath = join(worldRoot, name);
    try {
      const info = await stat(studioPath);
      if (!info.isFile()) continue;
    } catch {
      continue;
    }
    const studioHash = await hashFile(studioPath);
    const diskHash = await hashFile(diskPath);
    if (!studioHash) continue;
    if (diskHash && diskHash === studioHash) continue;
    const conflictPath = `world/${name}`;
    if (store.keptDiskHashes[conflictPath] === studioHash) {
      continue;
    }
    delete store.keptDiskHashes[conflictPath];
    conflicts.push({
      id: syncbackConflictId(conflictPath),
      path: conflictPath,
      detail: diskHash
        ? "Studio export differs from disk — choose Keep disk, Take Studio, or Open diff"
        : "Studio export has no matching disk file",
      studioHash,
      diskHash: diskHash ?? "",
    });
  }

  store.conflicts = conflicts;
  store.lastScanAt = new Date().toISOString();
  await writeStore(projectPath, store);

  return {
    enabled: true,
    conflicts: conflicts.map(({ id, path, detail }) => ({ id, path, detail })),
    lastScanAt: store.lastScanAt,
  };
}

export async function resolveSyncbackConflict(
  projectPath: string,
  request: SyncbackResolveRequest,
): Promise<SyncbackStatus> {
  const store = await readStore(projectPath);
  const conflict = store.conflicts.find((c) => c.id === request.conflictId);
  if (!conflict) {
    return getSyncbackStatus(projectPath);
  }

  const exportPath = join(
    projectPath,
    ".blockforge",
    "studio-exports",
    conflict.path.replace(/^world\//, ""),
  );
  const diskPath = join(projectPath, conflict.path);

  if (request.resolution === "keep-disk") {
    // Keep the disk bytes authoritative and suppress this exact Studio revision.
    // A later Studio change has a new hash and will surface a fresh conflict.
    store.keptDiskHashes[conflict.path] = conflict.studioHash;
    await writeFile(
      join(projectPath, ".blockforge", "syncback-log.txt"),
      `${new Date().toISOString()} keep-disk ${conflict.path} studio=${conflict.studioHash}\n`,
      { flag: "a" },
    );
  } else if (request.resolution === "take-studio") {
    const bytes = await readFile(exportPath);
    await mkdir(dirname(diskPath), { recursive: true });
    await writeFile(diskPath, bytes);
    delete store.keptDiskHashes[conflict.path];
  } else {
    // open-diff: write a side-by-side note for the user/agent
    await writeFile(
      join(projectPath, ".blockforge", `diff-${conflict.id}.md`),
      `# Syncback diff\n\n- Disk: \`${diskPath}\`\n- Studio export: \`${exportPath}\`\n\nOpen both files in your editor to compare. Resolve with Keep disk or Take Studio.\n`,
      "utf8",
    );
  }

  store.conflicts = store.conflicts.filter((c) => c.id !== request.conflictId);
  await writeStore(projectPath, store);
  return getSyncbackStatus(projectPath);
}

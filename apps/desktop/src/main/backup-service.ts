import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { app } from "electron";
import extractZip from "extract-zip";

function backupsRoot(): string {
  return join(app.getPath("userData"), "backups");
}

function projectBackupDir(projectId: string): string {
  return join(backupsRoot(), projectId);
}

export type BackupInfo = {
  projectId: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
};

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  if (process.platform === "win32") {
    await new Promise<void>((resolve, reject) => {
      const ps = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Compress-Archive -Path (Join-Path '${sourceDir.replace(/'/g, "''")}' '*') -DestinationPath '${outPath.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: "ignore" },
      );
      ps.on("error", reject);
      ps.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Compress-Archive exited ${code}`));
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "zip",
      ["-r", outPath, ".", "-x", "node_modules/*", "out/*", "dist/*", ".git/*"],
      { cwd: sourceDir, stdio: "ignore" },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`zip exited ${code}`));
    });
  });
}

export async function createProjectBackup(args: {
  projectId: string;
  projectPath: string;
  projectName: string;
}): Promise<BackupInfo> {
  const dir = projectBackupDir(args.projectId);
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = (args.projectName || args.projectId).replace(
    /[^\w.-]+/g,
    "_",
  );
  const fileName = `${safeName}-${stamp}.zip`;
  const outPath = join(dir, fileName);

  await zipDirectory(args.projectPath, outPath);

  const info = await stat(outPath);
  return {
    projectId: args.projectId,
    fileName,
    path: outPath,
    sizeBytes: info.size,
    createdAt: info.mtime.toISOString(),
  };
}

export async function listProjectBackups(
  projectId: string,
): Promise<BackupInfo[]> {
  const dir = projectBackupDir(projectId);
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: BackupInfo[] = [];
  for (const fileName of names) {
    if (!fileName.endsWith(".zip")) continue;
    const path = join(dir, fileName);
    const info = await stat(path);
    out.push({
      projectId,
      fileName,
      path,
      sizeBytes: info.size,
      createdAt: info.mtime.toISOString(),
    });
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export async function restoreProjectBackup(args: {
  zipPath: string;
  destPath: string;
}): Promise<{ destPath: string }> {
  await mkdir(args.destPath, { recursive: true });
  await extractZip(args.zipPath, { dir: args.destPath });
  return { destPath: args.destPath };
}

// keep stream import available for future streaming zip writers
void createWriteStream;

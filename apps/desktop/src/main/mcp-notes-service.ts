import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export class NotesSandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotesSandboxError";
  }
}

export function notesRoot(projectPath: string): string {
  return resolve(projectPath, "notes");
}

/**
 * Resolve a path that must stay under project/notes/. Rejects absolute paths and `..`.
 */
export function resolveSandboxedNotesPath(
  projectPath: string,
  requested: string,
): string {
  const trimmed = requested.trim();
  if (trimmed.length === 0) {
    return notesRoot(projectPath);
  }
  if (isAbsolute(trimmed)) {
    throw new NotesSandboxError("Notes path must be relative to notes/");
  }
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.split("/").some((part) => part === "..")) {
    throw new NotesSandboxError("Notes path must not contain ..");
  }
  const root = notesRoot(projectPath);
  const target = resolve(root, normalized);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new NotesSandboxError("Notes path escaped notes/");
  }
  if (rel.split(sep).includes("..")) {
    throw new NotesSandboxError("Notes path escaped notes/");
  }
  return target;
}

export type NotesListEntry = {
  path: string;
  kind: "file" | "directory";
};

async function walkNotes(
  dir: string,
  root: string,
  out: NotesListEntry[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      out.push({ path: rel, kind: "directory" });
      await walkNotes(abs, root, out);
    } else if (entry.isFile()) {
      out.push({ path: rel, kind: "file" });
    }
  }
}

export async function listNotes(
  projectPath: string,
  relativePath = "",
): Promise<NotesListEntry[]> {
  const dir = resolveSandboxedNotesPath(projectPath, relativePath);
  const root = notesRoot(projectPath);
  const out: NotesListEntry[] = [];
  await walkNotes(dir, root, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

export async function readNotesFile(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  const target = resolveSandboxedNotesPath(projectPath, relativePath);
  if (target === notesRoot(projectPath)) {
    throw new NotesSandboxError("notes_read requires a file path");
  }
  return readFile(target, "utf8");
}

export async function writeNotesFile(
  projectPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = resolveSandboxedNotesPath(projectPath, relativePath);
  if (target === notesRoot(projectPath)) {
    throw new NotesSandboxError("notes_write requires a file path");
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

export async function renameNotesFile(
  projectPath: string,
  fromRelative: string,
  toRelative: string,
): Promise<void> {
  const from = resolveSandboxedNotesPath(projectPath, fromRelative);
  const to = resolveSandboxedNotesPath(projectPath, toRelative);
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
}

export async function deleteNotesFile(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const target = resolveSandboxedNotesPath(projectPath, relativePath);
  if (target === notesRoot(projectPath)) {
    throw new NotesSandboxError("Refusing to delete the notes/ root");
  }
  await rm(target, { recursive: false, force: false });
}

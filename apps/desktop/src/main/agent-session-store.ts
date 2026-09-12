import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import type { AgentId } from "../shared/agent-adapter.js";

type SessionPrefs = {
  /** `${projectPath}::${adapterId}` → prefer resume on next start */
  resumeByKey: Record<string, boolean>;
};

function storePath(): string {
  return join(app.getPath("userData"), "agent-sessions.json");
}

function key(projectPath: string, adapterId: AgentId): string {
  return `${projectPath}::${adapterId}`;
}

async function readPrefs(): Promise<SessionPrefs> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionPrefs>;
    return { resumeByKey: parsed.resumeByKey ?? {} };
  } catch {
    return { resumeByKey: {} };
  }
}

async function writePrefs(prefs: SessionPrefs): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(storePath(), JSON.stringify(prefs, null, 2), "utf8");
}

export async function getPreferredResume(
  projectPath: string,
  adapterId: AgentId,
): Promise<boolean> {
  const prefs = await readPrefs();
  return prefs.resumeByKey[key(projectPath, adapterId)] === true;
}

export async function setPreferredResume(
  projectPath: string,
  adapterId: AgentId,
  resume: boolean,
): Promise<void> {
  const prefs = await readPrefs();
  prefs.resumeByKey[key(projectPath, adapterId)] = resume;
  await writePrefs(prefs);
}

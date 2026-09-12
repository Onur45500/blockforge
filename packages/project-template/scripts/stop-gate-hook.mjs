#!/usr/bin/env node
/**
 * Claude Code Stop hook: block finishing unless build + world + refs are clean
 * and there are no fresh Studio runtime errors / World-missing sync issues.
 *
 * Exit 0 = allow stop. Exit 2 = block with stderr fed back to the model.
 * Honors stop_hook_active to avoid infinite loops.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOG_PATH = join(ROOT, ".blockforge", "studio-output.jsonl");
const STATE_PATH = join(ROOT, ".blockforge", "studio-state.json");
const SESSION_MARK = join(ROOT, ".blockforge", "session-start.json");
const WORLD_DIR = join(ROOT, "world");
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function ensureSessionMark() {
  try {
    mkdirSync(join(ROOT, ".blockforge"), { recursive: true });
    if (!existsSync(SESSION_MARK)) {
      writeFileSync(
        SESSION_MARK,
        JSON.stringify({ startedAt: new Date().toISOString() }, null, 2),
        "utf8",
      );
    }
  } catch {
    // ignore
  }
}

function sessionStartedAt() {
  try {
    const data = JSON.parse(readFileSync(SESSION_MARK, "utf8"));
    return typeof data.startedAt === "string" ? Date.parse(data.startedAt) : 0;
  } catch {
    return 0;
  }
}

function hasDiskWorldFiles() {
  try {
    return readdirSync(WORLD_DIR).some((n) => n.endsWith(".model.json"));
  } catch {
    return false;
  }
}

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

const raw = readStdin();
let payload = null;
if (raw.trim()) {
  try {
    payload = JSON.parse(raw);
  } catch {
    // ignore
  }
}

if (payload && payload.stop_hook_active === true) {
  // Already blocked once this turn — allow stop to avoid infinite loops.
  process.exit(0);
}

ensureSessionMark();

const failures = [];

/**
 * @param {Record<string, unknown>} entry
 * @param {number} started
 */
function isActionableStudioError(entry, started) {
  const level = String(entry.level ?? "").toLowerCase();
  if (level !== "error" && level !== "messageerror") {
    return false;
  }
  if (entry.backfill === true) {
    return false;
  }
  const ts = typeof entry.ts === "string" ? Date.parse(entry.ts) : NaN;
  if (!Number.isFinite(ts) || (started > 0 && ts < started)) {
    return false;
  }
  const message = String(entry.message ?? "");
  if (/Can't convert to JSON/i.test(message)) {
    return false;
  }
  const source = String(entry.source ?? "");
  if (/BlockforgeBridge/i.test(source) && /JSON/i.test(message)) {
    return false;
  }
  return true;
}

for (const script of ["build", "validate:world", "validate:refs"]) {
  const result = runNpm(script);
  if (!result.ok) {
    const snippet = result.out.split(/\r?\n/).slice(0, 40).join("\n");
    failures.push(`npm run ${script} failed:\n${snippet}`);
  }
}

const started = sessionStartedAt();
if (existsSync(LOG_PATH)) {
  try {
    const lines = readFileSync(LOG_PATH, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    const freshErrors = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (isActionableStudioError(entry, started)) {
          freshErrors.push(entry);
        }
      } catch {
        // skip
      }
    }
    if (freshErrors.length > 0) {
      const recent = freshErrors.slice(-15);
      failures.push(
        [
          `${freshErrors.length} Studio runtime error(s) since session start:`,
          ...recent.map(
            (e) =>
              `- ${e.message ?? ""}${e.source ? ` (${e.source})` : ""}`,
          ),
          "Fix these, ask the user to Play again, then re-check .blockforge/studio-output.jsonl",
        ].join("\n"),
      );
    }
  } catch {
    // ignore log read errors
  }
}

if (existsSync(STATE_PATH) && hasDiskWorldFiles()) {
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    const receivedAt = Date.parse(state.receivedAt ?? state.ts ?? "");
    const ageOk =
      Number.isFinite(receivedAt) && Date.now() - receivedAt <= STATE_MAX_AGE_MS;
    if (ageOk && state.worldPresent !== true) {
      failures.push(
        [
          "Studio Workspace.World is MISSING while world/*.model.json files exist on disk.",
          "This is a Rojo sync problem — tell the user to press Connect in the Rojo plugin",
          "(see Blockforge Sync status for the port). Do NOT recreate scenery with Part scripts.",
          "Read .blockforge/studio-state.json for the latest snapshot.",
        ].join("\n"),
      );
    }
  } catch {
    // ignore
  }
}

if (failures.length === 0) {
  process.exit(0);
}

process.stderr.write(
  [
    "STOP GATE: task is not done yet. Fix the following before finishing:",
    "",
    ...failures,
    "",
    "Then re-run: npm run build && npm run validate:world && npm run validate:refs",
  ].join("\n") + "\n",
);
process.exit(2);

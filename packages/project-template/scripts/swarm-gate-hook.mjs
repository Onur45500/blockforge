#!/usr/bin/env node
/**
 * TaskCompleted / TeammateIdle gate for Claude Code Agent Teams.
 * Exit 2 → feedback to teammate / block completion (Claude Code hook contract).
 *
 * Ensures workers cannot mark work done while build / world / refs fail.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const blockforgeDir = join(projectDir, ".blockforge");
const logPath = join(blockforgeDir, "studio-output.jsonl");
const statePath = join(blockforgeDir, "studio-state.json");
const sessionMark = join(blockforgeDir, "session-start.json");
const worldDir = join(projectDir, "world");
const stateMaxAgeMs = 10 * 60 * 1000;

function ensureSessionMark() {
  try {
    mkdirSync(blockforgeDir, { recursive: true });
    if (!existsSync(sessionMark)) {
      writeFileSync(
        sessionMark,
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
    const data = JSON.parse(readFileSync(sessionMark, "utf8"));
    return typeof data.startedAt === "string" ? Date.parse(data.startedAt) : 0;
  } catch {
    return 0;
  }
}

function run(script, label) {
  const result = spawnSync("npm", ["run", script], {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
    timeout: 180_000,
  });
  if ((result.status ?? 1) !== 0) {
    const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    console.error(
      `[blockforge swarm gate] ${label} failed. Fix before completing this task.\n${out.slice(-4000)}`,
    );
    process.exit(2);
  }
}

run("build", "npm run build");
run("validate:world", "npm run validate:world");
run("validate:refs", "npm run validate:refs");

ensureSessionMark();
const studioFailures = [];
const started = sessionStartedAt();

/**
 * @param {Record<string, unknown>} entry
 * @param {number} sessionStart
 */
function isActionableStudioError(entry, sessionStart) {
  const level = String(entry.level ?? "").toLowerCase();
  if (level !== "error" && level !== "messageerror") {
    return false;
  }
  if (entry.backfill === true) {
    return false;
  }
  const ts = typeof entry.ts === "string" ? Date.parse(entry.ts) : NaN;
  if (!Number.isFinite(ts) || (sessionStart > 0 && ts < sessionStart)) {
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

if (existsSync(logPath)) {
  try {
    const freshErrors = readFileSync(logPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          const entry = JSON.parse(line);
          return isActionableStudioError(entry, started) ? [entry] : [];
        } catch {
          return [];
        }
      });
    if (freshErrors.length > 0) {
      studioFailures.push(
        [
          `${freshErrors.length} Studio runtime error(s) since session start:`,
          ...freshErrors
            .slice(-15)
            .map(
              (entry) =>
                `- ${entry.message ?? ""}${entry.source ? ` (${entry.source})` : ""}`,
            ),
          "Fix these, ask the user to Play again, then re-check .blockforge/studio-output.jsonl",
        ].join("\n"),
      );
    }
  } catch {
    // ignore log read errors
  }
}

try {
  const files = existsSync(worldDir)
    ? readdirSync(worldDir).filter((f) => f.endsWith(".model.json"))
    : [];
  if (files.length > 0 && existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    const receivedAt = Date.parse(state.receivedAt ?? state.ts ?? "");
    const ageOk =
      Number.isFinite(receivedAt) &&
      Date.now() - receivedAt <= stateMaxAgeMs;
    if (ageOk && state.worldPresent !== true) {
      studioFailures.push(
        [
          "Studio Workspace.World is MISSING while world/*.model.json files exist on disk.",
          "This is a Rojo sync problem — tell the user to press Connect in the Rojo plugin",
          "(see Blockforge Sync status for the port). Do NOT recreate scenery with Part scripts.",
          "Read .blockforge/studio-state.json for the latest snapshot.",
        ].join("\n"),
      );
    }
  }
} catch {
  // ignore state read errors
}

if (studioFailures.length > 0) {
  process.stderr.write(
    [
      "SWARM GATE: task is not done yet. Fix the following before completing:",
      "",
      ...studioFailures,
    ].join("\n") + "\n",
  );
  process.exit(2);
}

process.exit(0);

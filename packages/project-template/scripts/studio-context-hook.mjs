#!/usr/bin/env node
/**
 * Claude Code UserPromptSubmit hook: inject Studio state + recent runtime errors
 * as additional context (stdout).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOG_PATH = join(ROOT, ".blockforge", "studio-output.jsonl");
const STATE_PATH = join(ROOT, ".blockforge", "studio-state.json");
const CURSOR_PATH = join(ROOT, ".blockforge", "studio-context-cursor.json");
const MAX_LINES = 25;

function readCursor() {
  try {
    const raw = readFileSync(CURSOR_PATH, "utf8");
    const data = JSON.parse(raw);
    return typeof data.offset === "number" ? data.offset : 0;
  } catch {
    return 0;
  }
}

function writeCursor(offset) {
  try {
    mkdirSync(join(ROOT, ".blockforge"), { recursive: true });
    writeFileSync(CURSOR_PATH, JSON.stringify({ offset }, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function hasDiskWorldFiles() {
  try {
    return readdirSync(join(ROOT, "world")).some((n) => n.endsWith(".model.json"));
  } catch {
    return false;
  }
}

const blocks = [];

// Studio state snapshot
if (existsSync(STATE_PATH)) {
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    const ageMs = Date.now() - Date.parse(state.receivedAt ?? state.ts ?? "");
    const ageSec = Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : "?";
    const names = Array.isArray(state.worldChildren)
      ? state.worldChildren.map((c) => c.name).filter(Boolean).slice(0, 24)
      : [];
    const spawns = Array.isArray(state.spawnLocations)
      ? state.spawnLocations
          .filter((s) => s.enabled !== false)
          .map((s) =>
            s.position
              ? `${s.name}@[${s.position.join(", ")}]`
              : String(s.name),
          )
      : [];

    const lines = [
      "STUDIO STATE (from Blockforge bridge):",
      `- Snapshot age: ${ageSec}s`,
      `- Workspace.World present: ${state.worldPresent === true ? "YES" : "NO"}`,
      names.length > 0
        ? `- World children (sample): ${names.join(", ")}`
        : "- World children: (none)",
      spawns.length > 0
        ? `- Enabled SpawnLocation(s): ${spawns.join(", ")}`
        : "- Enabled SpawnLocation(s): (none reported)",
    ];

    if (state.worldPresent !== true && hasDiskWorldFiles()) {
      lines.push(
        "ACTION: Rojo is not connected/synced. Tell the user to press Connect in the Rojo plugin (check Blockforge Sync status for the port).",
        "Do NOT recreate scenery with new Instance(\"Part\") scripts — fix sync instead.",
      );
    }

    blocks.push(lines.join("\n"));
  } catch {
    // ignore malformed state
  }
}

// Runtime log errors since last prompt
if (existsSync(LOG_PATH)) {
  try {
    const raw = readFileSync(LOG_PATH, "utf8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const offset = readCursor();
    const fresh = lines.slice(offset);
    writeCursor(lines.length);

    const errors = [];
    for (const line of fresh) {
      try {
        const entry = JSON.parse(line);
        const level = String(entry.level ?? "").toLowerCase();
        if (level === "error" || level === "warning" || level === "messageerror") {
          errors.push(entry);
        }
      } catch {
        // skip
      }
    }

    if (errors.length > 0) {
      const recent = errors.slice(-MAX_LINES);
      blocks.push(
        [
          "STUDIO RUNTIME OUTPUT (fix these if the user says Play failed):",
          ...recent.map((e) => {
            const src = e.source ? ` [${e.source}]` : "";
            const stack = e.stack
              ? `\n  ${String(e.stack).split("\n").slice(0, 3).join("\n  ")}`
              : "";
            return `- (${e.level ?? "error"})${src} ${e.message ?? ""}${stack}`;
          }),
          "Log file: .blockforge/studio-output.jsonl",
        ].join("\n"),
      );
    }
  } catch {
    // ignore
  }
}

if (blocks.length > 0) {
  process.stdout.write(blocks.join("\n\n") + "\n");
}

process.exit(0);

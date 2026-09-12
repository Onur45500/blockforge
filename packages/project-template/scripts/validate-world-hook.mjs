#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: when a world/*.model.json is written/edited,
 * run validate-world and feed failures back to the agent (exit 2).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function extractFilePath(payload) {
  if (!payload || typeof payload !== "object") return null;
  const input = payload.tool_input ?? payload.toolInput ?? payload.input;
  if (input && typeof input === "object") {
    const p = input.file_path ?? input.filePath ?? input.path;
    if (typeof p === "string") return p;
  }
  if (typeof payload.file_path === "string") return payload.file_path;
  return null;
}

function isWorldModelJson(filePath) {
  const norm = filePath.replaceAll("/", sep).replaceAll("\\", sep);
  const rel = relative(ROOT, norm);
  if (rel.startsWith("..")) {
    // Absolute path outside project — still check suffix pattern
    const lower = filePath.replaceAll("\\", "/").toLowerCase();
    return lower.includes("/world/") && lower.endsWith(".model.json");
  }
  const lowerRel = rel.replaceAll("\\", "/").toLowerCase();
  return lowerRel.startsWith("world/") && lowerRel.endsWith(".model.json");
}

const raw = readStdin();
let payload = null;
if (raw.trim()) {
  try {
    payload = JSON.parse(raw);
  } catch {
    // Non-JSON stdin — run full validation as a safe fallback when invoked manually
  }
}

const filePath = extractFilePath(payload);
if (filePath && !isWorldModelJson(filePath)) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [join(ROOT, "scripts", "validate-world.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
});

if (result.status === 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  process.exit(0);
}

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
process.stderr.write(
  out
    ? `${out}\n`
    : "validate-world failed with no output. Run: npm run validate:world\n",
);
// Exit 2: Claude Code feeds stderr back to the model as a blocking hook error.
process.exit(2);

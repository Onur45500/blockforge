#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: when src or world source changes, run the
 * cross-reference validator and feed failures back to the agent (exit 2).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
    const path = input.file_path ?? input.filePath ?? input.path;
    if (typeof path === "string") return path;
  }
  return typeof payload.file_path === "string" ? payload.file_path : null;
}

function affectsReferences(filePath) {
  const normalized = filePath.replaceAll("/", sep).replaceAll("\\", sep);
  const rel = relative(ROOT, normalized);
  const lower =
    rel.startsWith("..")
      ? filePath.replaceAll("\\", "/").toLowerCase()
      : rel.replaceAll("\\", "/").toLowerCase();
  return (
    ((lower.startsWith("src/") || lower.includes("/src/")) &&
      (lower.endsWith(".ts") || lower.endsWith(".tsx"))) ||
    ((lower.startsWith("world/") || lower.includes("/world/")) &&
      lower.endsWith(".model.json"))
  );
}

const raw = readStdin();
let payload = null;
if (raw.trim()) {
  try {
    payload = JSON.parse(raw);
  } catch {
    // Non-JSON stdin: run as a safe fallback when invoked manually.
  }
}

const filePath = extractFilePath(payload);
if (filePath && !affectsReferences(filePath)) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [join(ROOT, "scripts", "validate-refs.mjs")],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
);

if (result.status === 0) {
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(0);
}

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
process.stderr.write(
  out
    ? `${out}\n`
    : "validate-refs failed with no output. Run: npm run validate:refs\n",
);
process.exit(2);

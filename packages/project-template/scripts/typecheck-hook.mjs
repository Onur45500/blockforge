#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: when a src/**/*.ts file is written/edited,
 * run rbxtsc (typecheck) and feed failures back to the agent (exit 2).
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
    const p = input.file_path ?? input.filePath ?? input.path;
    if (typeof p === "string") return p;
  }
  if (typeof payload.file_path === "string") return payload.file_path;
  return null;
}

function isSrcTs(filePath) {
  const norm = filePath.replaceAll("/", sep).replaceAll("\\", sep);
  const rel = relative(ROOT, norm);
  const lower =
    rel.startsWith("..")
      ? filePath.replaceAll("\\", "/").toLowerCase()
      : rel.replaceAll("\\", "/").toLowerCase();
  return (
    (lower.startsWith("src/") || lower.includes("/src/")) &&
    (lower.endsWith(".ts") || lower.endsWith(".tsx"))
  );
}

const raw = readStdin();
let payload = null;
if (raw.trim()) {
  try {
    payload = JSON.parse(raw);
  } catch {
    // Non-JSON stdin — run typecheck as a safe fallback when invoked manually
  }
}

const filePath = extractFilePath(payload);
if (filePath && !isSrcTs(filePath)) {
  process.exit(0);
}

const result = spawnSync("npm", ["run", "typecheck"], {
  cwd: ROOT,
  encoding: "utf8",
  shell: true,
});

if (result.status === 0) {
  process.exit(0);
}

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
process.stderr.write(
  out
    ? `typecheck failed:\n${out}\n`
    : "typecheck failed with no output. Run: npm run typecheck\n",
);
process.exit(2);

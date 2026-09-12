#!/usr/bin/env node
/**
 * Append a UI terminal command for Blockforge desktop to watch.
 * Usage:
 *   node scripts/blockforge-ui-terminal.mjs spawn --adapter claude-code --label world-builder
 *   node scripts/blockforge-ui-terminal.mjs focus --session <id>
 *   node scripts/blockforge-ui-terminal.mjs close --session <id>
 *   node scripts/blockforge-ui-terminal.mjs pin --session <id> [--unpin]
 *   node scripts/blockforge-ui-terminal.mjs status
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const blockforgeDir = join(root, ".blockforge");
const commandsPath = join(blockforgeDir, "agent-ui-commands.jsonl");
const terminalsPath = join(blockforgeDir, "terminals.json");

function usage() {
  console.error(`Usage:
  node scripts/blockforge-ui-terminal.mjs spawn [--adapter <id>] [--label <name>] [--role <name>] [--focus]
  node scripts/blockforge-ui-terminal.mjs focus --session <id>
  node scripts/blockforge-ui-terminal.mjs close --session <id>
  node scripts/blockforge-ui-terminal.mjs pin --session <id> [--unpin]
  node scripts/blockforge-ui-terminal.mjs status`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--adapter" || a === "--label" || a === "--role" || a === "--session") {
      out[a.slice(2)] = argv[++i];
    } else if (a === "--focus") {
      out.focus = true;
    } else if (a === "--unpin") {
      out.unpin = true;
    } else if (a.startsWith("-")) {
      usage();
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function appendCommand(cmd) {
  await mkdir(blockforgeDir, { recursive: true });
  await appendFile(commandsPath, `${JSON.stringify(cmd)}\n`, "utf8");
  console.log(JSON.stringify(cmd));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const op = args._[0];
  if (!op) {
    usage();
  }

  if (op === "status") {
    try {
      const raw = await readFile(terminalsPath, "utf8");
      console.log(raw.trimEnd());
    } catch {
      console.log(JSON.stringify({ updatedAt: null, sessions: [] }, null, 2));
    }
    return;
  }

  if (op === "spawn") {
    await appendCommand({
      op: "spawn-terminal",
      adapterId: args.adapter ?? "claude-code",
      label: args.label,
      role: args.role ?? args.label,
      focus: args.focus === true,
    });
    return;
  }

  if (op === "focus") {
    if (!args.session) usage();
    await appendCommand({ op: "focus-terminal", sessionId: args.session });
    return;
  }

  if (op === "close") {
    if (!args.session) usage();
    await appendCommand({ op: "close-terminal", sessionId: args.session });
    return;
  }

  if (op === "pin") {
    if (!args.session) usage();
    await appendCommand({
      op: "pin-terminal",
      sessionId: args.session,
      pinned: args.unpin !== true,
    });
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

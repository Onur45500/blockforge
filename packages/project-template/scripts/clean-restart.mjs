#!/usr/bin/env node
/**
 * Print recovery checks when Rojo / Studio / Play looks wedged. Does not kill Studio.
 */
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BF = join(ROOT, ".blockforge");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

const lines = [];
lines.push("Blockforge clean-restart checks");
lines.push(`rojo :34872 listening: ${await portOpen(34872) ? "yes" : "no"}`);

const worldJson = join(ROOT, "world");
lines.push(`world/ present: ${await exists(worldJson) ? "yes" : "no"}`);

const statePath = join(BF, "studio-state.json");
if (await exists(statePath)) {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    lines.push(`studio-state.json: ${JSON.stringify(parsed).slice(0, 240)}`);
  } catch {
    lines.push("studio-state.json: unreadable");
  }
} else {
  lines.push("studio-state.json: missing (Play with the Blockforge bridge, or use Studio MCP)");
}

lines.push("Next: Stop Play in Studio → Sync Restart Rojo if World missing → studio_release if you hold the lock.");
lines.push("Do not rebuild world/ as Part scripts. Do not skip Claude permissions.");
console.log(lines.join("\n"));

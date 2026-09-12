import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveIncludeSource() {
  try {
    const pkg = require.resolve("roblox-ts/package.json");
    return join(dirname(pkg), "include");
  } catch {
    return join(root, "node_modules", "roblox-ts", "include");
  }
}

const source = resolveIncludeSource();
const dest = join(root, "include");

if (!existsSync(source)) {
  console.error(`roblox-ts include not found at ${source}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(source, dest, { recursive: true });
console.log(`Copied roblox-ts include → ${dest}`);

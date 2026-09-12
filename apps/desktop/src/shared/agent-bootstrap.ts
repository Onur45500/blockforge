/**
 * Concise bootstrap appended to Claude Code's system prompt on every new PTY session.
 * Keep the static core short; project-specific context is added by buildDynamicBootstrap.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const BLOCKFORGE_AGENT_BOOTSTRAP = [
  "BLOCKFORGE SESSION:",
  "You ARE expected to implement Roblox gameplay in this roblox-ts project.",
  "SWARM MODE: You are the Lead. For multi-layer game asks, spawn Claude Code Agent Teams teammates using types world-builder, gameplay-coder, qa-verifier.",
  "Lead plans, assigns dependent tasks, monitors, and verifies — workers implement in scoped folders. qa-verifier must confirm gates before you declare done.",
  "UI MULTI-TERMINAL (optional): `node scripts/blockforge-ui-terminal.mjs spawn --adapter claude-code --label world-builder`; status in `.blockforge/terminals.json`. Prefer Agent Teams for Claude↔Claude; UI terminals for other adapters. Do not steal lead focus unless `--focus`.",
  "HOST MCP: Project `.mcp.json` has a single `blockforge` server (Studio MCP is proxied). Call studio_wait_for_turn before drive tools. Prefer playtest_check. Use notes_*, lookup_uploaded_asset, search_asset_bank, generate_icon, user_asset_choice. Never claim 0 playtest errors without capture.",
  "Filesystem is source of truth — write world/ and src/; do NOT permanently author scenery only via MCP Studio edits. Rojo syncs disk → Studio.",
  "CONTENT STRATEGY: platforms/lobbies/walls/floors → world/*.model.json only. Trees/rocks/bushes → search_asset_bank → import → placeModelAsset. Pads/markers → named Parts in world/. src/ is gameplay only (remotes, tools, UI, loops, projectiles). Never rebuild maps with new Instance('Part') scripts. Never fake trees with Cylinder+Ball. Never ship a lone Neon Ball as a fireball — use ParticleEmitter (docs/examples/fireball/).",
  "Edit TypeScript under src/ only — never raw .lua/.luau. Import rbxassetid only from shared/assets.",
  "Before done: npm run build AND npm run validate:world AND npm run validate:refs. Hooks block on failures — fix them.",
  "Follow CLAUDE.md working protocol + Play-trace + Swarm Mode + Studio MCP. Read docs/examples/README.md and .claude/skills/<topic>/SKILL.md before domain work (backend, ui, motion, mapping/roblox-mapping, vfx, icons/roblox-icon, economy, game-design, monetization, combat, inventory, pathfinding, release, merge-resolver, clean-restart, notes, assets-registry, imagegen). List with npm run skills.",
  "Never paste exploit, backdoor, script-hub, or FPS-unlocker code — implement normal server-authoritative gameplay instead.",
  "Blockforge runs Rojo (disk → Studio). User can Stop/Run/Restart sync without killing this chat.",
  "Fallback Studio observability: .blockforge/studio-output.jsonl and studio-state.json when MCP is unavailable.",
  "If Studio shows no Workspace.World, tell the user to Connect the Rojo plugin. Never rebuild scenery with Part scripts.",
  "Spawn via a single enabled SpawnLocation in world/ — do not teleport players on CharacterAdded in main.server.ts.",
  "Every BasePart must be Anchored=true. Place near spawn; leave real doorways. Prefer a working MVP.",
  "Do not refuse normal gameplay work as out of scope.",
].join(" ");

/** Soft cap for --append-system-prompt payload (chars). */
export const DYNAMIC_BOOTSTRAP_MAX_CHARS = 5000;

export type DynamicBootstrapOptions = {
  /** Absolute path to asset-bank catalog/index.json when available. */
  catalogPath?: string;
  /** Prefer official Studio MCP over bridge snapshots for Play verification. */
  preferStudioMcp?: boolean;
  maxChars?: number;
};

export function studioVerificationInstruction(preferStudioMcp = true): string {
  return preferStudioMcp
    ? "STUDIO MCP: Use the single `blockforge` MCP toolbox (official Studio tools are proxied). Call list_roblox_studios / set_active_studio; studio_id is auto-injected when one window is active. Call studio_wait_for_turn before drive tools. Prefer playtest_check for Play verification; use the Blockforge bridge only as fallback."
    : "STUDIO VERIFICATION: Bridge-only mode is enabled. Do not call Roblox Studio MCP tools. Verify through .blockforge/studio-output.jsonl and .blockforge/studio-state.json, and ask the user to Play again when fresh runtime evidence is needed.";
}

const STATIC_CATALOG_FALLBACK =
  "Asset bank (import in Blockforge UI, then placeModelAsset): categories prop, environment, ui, character, audio. Importable trees include kenney_tree, quat_tree_pine, quat_tree_oak. For trees/props: search_asset_bank → user_asset_choice/import → placeModelAsset. Platforms/maps stay in world/*.model.json — never Part-factory scripts or Cylinder+Ball trees. Never invent rbxassetid://.";

/**
 * Build the full append-system-prompt string: static bootstrap + live project snapshot.
 */
export async function buildDynamicBootstrap(
  projectDir: string,
  options: DynamicBootstrapOptions = {},
): Promise<string> {
  const maxChars = options.maxChars ?? DYNAMIC_BOOTSTRAP_MAX_CHARS;
  const parts: string[] = [
    BLOCKFORGE_AGENT_BOOTSTRAP,
    studioVerificationInstruction(options.preferStudioMcp !== false),
  ];

  const worldSummary = await summarizeWorldFiles(projectDir);
  if (worldSummary) {
    parts.push(`PROJECT world/: ${worldSummary}`);
  }

  const stylePack = await readStylePackPrompt(projectDir);
  if (stylePack) {
    parts.push(`STYLE PACK: ${stylePack}`);
  }

  const assetsSummary = await summarizeProjectAssets(projectDir);
  if (assetsSummary) {
    parts.push(`PROJECT assets.json: ${assetsSummary}`);
  } else {
    parts.push(
      "PROJECT assets.json: no imported assets yet — platforms/pads go in world/*.model.json; for trees/props call search_asset_bank then import via the Asset bank UI / user_asset_choice before placeModelAsset. Do not invent Part trees or Part-factory maps.",
    );
  }

  const catalogSummary = await summarizeCatalog(options.catalogPath);
  parts.push(catalogSummary ?? STATIC_CATALOG_FALLBACK);

  const bridgeHint = await summarizeBridge(projectDir);
  parts.push(
    bridgeHint ??
      "Studio state: .blockforge/studio-state.json (World present?). Studio log: .blockforge/studio-output.jsonl. If World is missing, fix Rojo Connect — never Part-rebuild scenery.",
  );

  let result = parts.join(" ");
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 1)}…`;
  }
  return result;
}

type WorldNode = {
  Name?: string;
  ClassName?: string;
  Properties?: Record<string, unknown>;
  Children?: WorldNode[];
};

function isWorldNode(value: unknown): value is WorldNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectWorldMeta(
  node: unknown,
  names: string[],
  spawns: { name: string; position: number[] | null }[],
): void {
  if (!isWorldNode(node)) return;
  if (typeof node.Name === "string" && node.Name.length > 0) {
    names.push(node.Name);
  }
  if (node.ClassName === "SpawnLocation") {
    const enabled = node.Properties?.Enabled !== false;
    if (enabled) {
      const pos = node.Properties?.Position;
      const position =
        Array.isArray(pos) &&
        pos.length === 3 &&
        pos.every((n) => typeof n === "number")
          ? (pos as number[])
          : null;
      spawns.push({ name: typeof node.Name === "string" ? node.Name : "Spawn", position });
    }
  }
  if (Array.isArray(node.Children)) {
    for (const child of node.Children) {
      collectWorldMeta(child, names, spawns);
    }
  }
}

async function summarizeWorldFiles(projectDir: string): Promise<string | null> {
  const worldDir = join(projectDir, "world");
  try {
    const entries = await readdir(worldDir, { withFileTypes: true });
    const models = entries
      .filter((e) => e.isFile() && e.name.endsWith(".model.json"))
      .map((e) => e.name)
      .sort();
    if (models.length === 0) {
      return "empty (create SpawnPlatform.model.json or similar)";
    }

    const allNames: string[] = [];
    const spawns: { name: string; position: number[] | null }[] = [];

    for (const name of models) {
      try {
        const raw = await readFile(join(worldDir, name), "utf8");
        const data: unknown = JSON.parse(raw);
        collectWorldMeta(data, allNames, spawns);
      } catch {
        // skip unreadable / invalid
      }
    }

    const uniqueNames = [...new Set(allNames)].slice(0, 40);
    const namePreview =
      uniqueNames.length > 0 ? ` Names: ${uniqueNames.join(", ")}.` : "";

    let spawnPreview = "";
    if (spawns.length > 0) {
      const s = spawns[0];
      if (s) {
        spawnPreview = s.position
          ? ` Spawn ${s.name} at [${s.position.join(", ")}].`
          : ` Spawn ${s.name} (no Position).`;
      }
    }

    return `${models.join(", ")}.${spawnPreview}${namePreview}`;
  } catch {
    return null;
  }
}

async function summarizeBridge(projectDir: string): Promise<string | null> {
  try {
    const raw = await readFile(join(projectDir, ".blockforge", "bridge.json"), "utf8");
    const data = JSON.parse(raw) as { port?: number };
    const port = typeof data.port === "number" ? data.port : 34873;
    return `Rojo/bridge: Studio Connect uses the Rojo serve port from Blockforge Sync status; log bridge is :${port}. Read .blockforge/studio-state.json — if World missing, fix Rojo Connect, never Part-rebuild scenery.`;
  } catch {
    return null;
  }
}

async function summarizeProjectAssets(projectDir: string): Promise<string | null> {
  try {
    const raw = await readFile(join(projectDir, "assets.json"), "utf8");
    const data = JSON.parse(raw) as { assets?: Record<string, unknown> };
    const assets = data.assets ?? {};
    const keys = Object.keys(assets);
    if (keys.length === 0) {
      return null;
    }
    const preview = keys.slice(0, 24);
    const more = keys.length > preview.length ? ` (+${keys.length - preview.length} more)` : "";
    return `${keys.length} imported: ${preview.join(", ")}${more}`;
  } catch {
    return null;
  }
}

async function summarizeCatalog(catalogPath: string | undefined): Promise<string | null> {
  if (!catalogPath) {
    return null;
  }
  try {
    const raw = await readFile(catalogPath, "utf8");
    const data = JSON.parse(raw) as {
      assets?: Array<{
        category?: string;
        kind?: string;
        name?: string;
        id?: string;
        file?: string;
        tags?: string[];
      }>;
    };
    const assets = data.assets ?? [];
    if (assets.length === 0) {
      return null;
    }

    const byCategory = new Map<string, number>();
    const modelSamples: string[] = [];
    const importableIds: string[] = [];
    for (const asset of assets) {
      const cat = asset.category ?? "other";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
      if (typeof asset.file === "string" && asset.file.length > 0 && asset.id) {
        if (importableIds.length < 24) {
          importableIds.push(asset.id);
        }
      }
      if (
        asset.kind === "model" &&
        typeof asset.name === "string" &&
        modelSamples.length < 8
      ) {
        modelSamples.push(asset.name);
      }
    }

    const cats = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}(${count})`)
      .join(", ");

    const samples =
      modelSamples.length > 0 ? ` Sample models: ${modelSamples.join(", ")}.` : "";
    const importable =
      importableIds.length > 0
        ? ` Importable ids with on-disk files: ${importableIds.join(", ")}.`
        : " No pack binaries in this catalog snapshot — platforms still go in world/*.model.json; do not Part-factory maps or Cylinder+Ball trees.";

    return `Asset bank catalog: ${assets.length} entries — ${cats}.${samples}${importable} Trees/props: import → shared/assets.ts → placeModelAsset. Platforms/maps: world/*.model.json only.`;
  } catch {
    return null;
  }
}

async function readStylePackPrompt(projectDir: string): Promise<string | null> {
  try {
    const raw = await readFile(
      join(projectDir, ".blockforge", "style-pack.json"),
      "utf8",
    );
    const active = JSON.parse(raw) as { id?: string; version?: string };
    if (!active.id) {
      return null;
    }
    const candidates = [
      join(projectDir, "..", "..", "asset-bank", "style-packs", active.id, "pack.json"),
      join(process.cwd(), "packages", "asset-bank", "style-packs", active.id, "pack.json"),
    ];
    for (const candidate of candidates) {
      try {
        const packRaw = await readFile(candidate, "utf8");
        const pack = JSON.parse(packRaw) as { agentPrompt?: string; name?: string };
        if (pack.agentPrompt) {
          return `${pack.name ?? active.id}: ${pack.agentPrompt}`;
        }
      } catch {
        // try next
      }
    }
    return `Active style pack id=${active.id} (pack.json not found locally)`;
  } catch {
    return null;
  }
}

import { copyFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join } from "node:path";
import { Notification, type BrowserWindow } from "electron";
import { IPC } from "../shared/ipc-types.js";
import { getAssetCatalog, resolveBankAssetPath } from "./asset-service.js";
import { generateAsset } from "./ai-generate-service.js";
import { requestAssetChoice } from "./asset-choice-service.js";
import { isOutlinedIconPath, postProcessIconFile } from "./icon-postprocess.js";
import { createMonetizationProduct } from "./monetization-service.js";
import type { StudioLockManager } from "./studio-locks.js";
import type { StudioToolClient } from "./studio-mcp-mux.js";
import {
  HOST_TOOL_NAMES,
  jsonResult,
  requireDriveLease,
  textResult,
  type McpToolResult,
} from "./mcp-tool-catalog.js";
import {
  deleteNotesFile,
  listNotes,
  NotesSandboxError,
  readNotesFile,
  renameNotesFile,
  writeNotesFile,
} from "./mcp-notes-service.js";
import {
  lookupUploadedAsset,
  searchSimilarAssets,
} from "./mcp-asset-lookup.js";
import { runPlaytestCheck, readBridgePlaytestEvidence } from "./mcp-playtest.js";

export type McpPtyController = {
  pauseProject: (projectPath: string) => { paused: number };
};

export type ActiveStudioStore = {
  get: (projectPath: string) => string | undefined;
  set: (projectPath: string, studioId: string) => void;
  last: () => string | undefined;
};

export type McpHostContext = {
  getWindow: () => BrowserWindow | null;
  mux: StudioToolClient;
  locks: StudioLockManager;
  pty: McpPtyController | null;
  studios: ActiveStudioStore;
};

const MAP_TOOLKIT_REQUIRE =
  'require(game:GetService("ReplicatedStorage"):WaitForChild("Blockforge"):WaitForChild("MapToolkit"))';

const SPLIT_UNSUPPORTED = {
  ok: false,
  unsupported: true,
  reason:
    "Mesh split was a credits-only feature elsewhere. Blockforge does not resell credits. Split meshes in a DCC tool and import.",
};

const ICON_EDIT_PROMPT = [
  "Edit the unoutlined source PNG (not *-icon.png).",
  "Never run outline/stroke twice — refuse already-outlined files.",
  "Color-only changes: edit_icon (or native edit of download_asset), not adjust_icon_stroke.",
  "After a successful unoutlined edit, run adjust_icon_stroke once if a black outline is needed.",
].join(" ");

function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractStudioIds(payload: string): string[] {
  const ids: string[] = [];
  const re = /"studio_id"\s*:\s*"([^"]+)"/g;
  let match = re.exec(payload);
  while (match) {
    if (match[1]) {
      ids.push(match[1]);
    }
    match = re.exec(payload);
  }
  return [...new Set(ids)];
}

function parseChoiceOptions(raw: unknown): Array<{
  id: string;
  label: string;
  detail?: string;
  previewPath?: string;
}> {
  if (!Array.isArray(raw)) {
    return [];
  }
  const options: Array<{
    id: string;
    label: string;
    detail?: string;
    previewPath?: string;
  }> = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.label !== "string") {
      continue;
    }
    options.push({
      id: row.id,
      label: row.label,
      detail: typeof row.detail === "string" ? row.detail : undefined,
      previewPath: typeof row.previewPath === "string" ? row.previewPath : undefined,
    });
  }
  return options;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function muxToolText(result: McpToolResult): string {
  return result.content.map((c) => c.text).join("\n");
}

export function injectStudioId(
  args: Record<string, unknown>,
  projectPath: string,
  studios: ActiveStudioStore,
): Record<string, unknown> {
  if (typeof args.studio_id === "string" && args.studio_id.trim()) {
    return args;
  }
  const stored = projectPath ? studios.get(projectPath) : undefined;
  const studioId = stored ?? studios.last();
  if (!studioId) {
    return args;
  }
  return { ...args, studio_id: studioId };
}

export function isHostTool(name: string): boolean {
  return HOST_TOOL_NAMES.has(name);
}

/**
 * Dispatch a Blockforge host tool. Returns null when the name should be
 * forwarded to the Studio mux.
 */
export async function dispatchHostTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpHostContext,
): Promise<McpToolResult | null> {
  if (!isHostTool(name)) {
    return null;
  }

  try {
    switch (name) {
      case "list_roblox_studios": {
        try {
          const forwarded = injectStudioId(args, str(args, "projectPath"), ctx.studios);
          const result = await ctx.mux.callTool("list_roblox_studios", forwarded);
          const text = muxToolText(result);
          const ids = extractStudioIds(text);
          const projectPath = str(args, "projectPath");
          if (ids.length === 1 && ids[0] && projectPath) {
            ctx.studios.set(projectPath, ids[0]);
          }
          if (ids.length === 0 && ctx.mux.getStatus().phase === "Connected") {
            return jsonResult({
              studios: [],
              status: "NoStudio",
              message: "Studio MCP is up but no Studio windows are connected.",
              raw: text,
            });
          }
          return result;
        } catch (err) {
          return jsonResult(
            {
              status: ctx.mux.getStatus().phase,
              error: err instanceof Error ? err.message : String(err),
            },
            true,
          );
        }
      }
      case "set_active_studio": {
        const studioId = str(args, "studio_id");
        const projectPath = str(args, "projectPath");
        if (!studioId) {
          return jsonResult({ error: "studio_id is required" }, true);
        }
        if (projectPath) {
          ctx.studios.set(projectPath, studioId);
        } else {
          ctx.studios.set("", studioId);
        }
        try {
          await ctx.mux.callTool("set_active_studio", { studio_id: studioId });
        } catch {
          // persist locally even if Studio tool is missing
        }
        return jsonResult({ ok: true, studio_id: studioId, projectPath });
      }
      case "studio_connection_status": {
        const mux = ctx.mux.getStatus();
        const names = new Set(ctx.mux.getCachedTools().map((t) => t.name));
        let noStudio = false;
        if (mux.phase === "Connected" && names.has("list_roblox_studios")) {
          try {
            const listed = await ctx.mux.callTool("list_roblox_studios", {});
            noStudio = extractStudioIds(muxToolText(listed)).length === 0;
          } catch {
            noStudio = false;
          }
        }
        const phase = noStudio ? "NoStudio" : mux.phase;
        return jsonResult({
          ...mux,
          phase,
          why: noStudio
            ? "Mux connected but no Roblox Studio window is attached"
            : mux.detail,
        });
      }
      case "studio_reconnect": {
        await ctx.mux.reconnect();
        return jsonResult(ctx.mux.getStatus());
      }
      case "studio_wait_for_turn": {
        const status = await ctx.locks.waitForStudioTurn({
          sessionId: str(args, "sessionId"),
          projectPath: str(args, "projectPath"),
          timeoutMs: num(args, "timeoutMs"),
        });
        return jsonResult(status);
      }
      case "studio_release": {
        const status = await ctx.locks.releaseStudio(str(args, "sessionId"));
        return jsonResult(status);
      }
      case "playtest_check": {
        const projectPath = str(args, "projectPath");
        return runPlaytestCheck(
          {
            hypothesis: str(args, "hypothesis") || undefined,
            sessionId: str(args, "sessionId"),
            projectPath,
            timeoutMs: num(args, "timeoutMs"),
            waitMs: num(args, "waitMs"),
            studioId: injectStudioId(args, projectPath, ctx.studios).studio_id as
              | string
              | undefined,
          },
          { client: ctx.mux, locks: ctx.locks },
        );
      }
      case "start_stop_play": {
        const sessionId = str(args, "sessionId");
        const leaseError = requireDriveLease(name, sessionId, ctx.locks);
        if (leaseError) {
          return jsonResult({ error: leaseError, code: "STUDIO_LEASE_REQUIRED" }, true);
        }
        const projectPath = str(args, "projectPath");
        const forwarded = injectStudioId(args, projectPath, ctx.studios);
        return ctx.mux.callTool("start_stop_play", forwarded);
      }
      case "get_studio_state": {
        const projectPath = str(args, "projectPath");
        let muxState: unknown = null;
        const names = new Set(ctx.mux.getCachedTools().map((t) => t.name));
        if (names.has("get_studio_state")) {
          try {
            const result = await ctx.mux.callTool(
              "get_studio_state",
              injectStudioId(args, projectPath, ctx.studios),
            );
            muxState = muxToolText(result);
          } catch {
            muxState = null;
          }
        }
        const bridge = await readBridgePlaytestEvidence(projectPath);
        return jsonResult({
          locks: ctx.locks.getStatus(),
          mux: ctx.mux.getStatus(),
          muxStudioState: muxState,
          bridge: bridge.studioState,
          bridgeOk: bridge.ok,
        });
      }
      case "install_map_toolkit": {
        const projectPath = str(args, "projectPath");
        const toolkitPath = join(projectPath, "studio-tools", "MapToolkit.luau");
        const exists = await pathExists(toolkitPath);
        if (!exists) {
          return jsonResult({
            ok: false,
            path: toolkitPath,
            message:
              "studio-tools/MapToolkit.luau is missing. Run npm run map-toolkit, then require it — never paste the library into execute_luau.",
            requireSnippet: MAP_TOOLKIT_REQUIRE,
          });
        }
        return jsonResult({
          ok: true,
          path: toolkitPath,
          requireSnippet: MAP_TOOLKIT_REQUIRE,
          message:
            "MapToolkit is on disk (Rojo ReplicatedStorage.Blockforge). Require it in execute_luau; do not paste the source.",
        });
      }
      case "studio_agent_gone": {
        await ctx.locks.releaseAllForSession(str(args, "sessionId"));
        return jsonResult({ ok: true, locks: ctx.locks.getStatus() });
      }
      case "search_asset_bank": {
        const catalog = await getAssetCatalog();
        const q = str(args, "query").trim().toLowerCase();
        const limit = Math.min(Math.max(num(args, "limit") ?? 20, 1), 50);
        const entries = catalog.assets ?? [];
        const filtered = q
          ? entries.filter((e) => {
              const hay =
                `${e.name} ${e.id} ${(e.tags ?? []).join(" ")} ${e.category ?? ""}`.toLowerCase();
              return hay.includes(q);
            })
          : entries;
        return jsonResult({ results: filtered.slice(0, limit) });
      }
      case "bank_search_similar": {
        const catalog = await getAssetCatalog();
        const q = str(args, "query").trim();
        const limit = Math.min(Math.max(num(args, "limit") ?? 20, 1), 50);
        return jsonResult({
          results: searchSimilarAssets(catalog.assets ?? [], q, limit),
        });
      }
      case "download_asset": {
        const projectPath = str(args, "projectPath");
        const destDir = join(projectPath, ".blockforge", "mcp-downloads");
        await mkdir(destDir, { recursive: true });
        let source = str(args, "filePath");
        const assetId = str(args, "assetId");
        if (!source && assetId) {
          const catalog = await getAssetCatalog();
          const entry = catalog.assets.find((e) => e.id === assetId);
          source = entry?.filePath ?? "";
        }
        if (!source) {
          return jsonResult({ error: "Provide assetId or filePath" }, true);
        }
        const resolved = await resolveBankAssetPath(source);
        const dest = join(destDir, basename(resolved));
        await copyFile(resolved, dest);
        return jsonResult({ ok: true, path: dest });
      }
      case "lookup_uploaded_asset": {
        const result = await lookupUploadedAsset(
          str(args, "projectPath"),
          str(args, "query"),
        );
        if (result.hits.length === 0) {
          return jsonResult({
            ...result,
            message:
              "No registry entry. Import via Blockforge Assets — do not invent an rbxassetid.",
          });
        }
        return jsonResult(result);
      }
      case "user_asset_choice": {
        const result = await requestAssetChoice({
          projectPath: str(args, "projectPath"),
          prompt: str(args, "prompt") || undefined,
          options: parseChoiceOptions(args.options),
          getWindow: ctx.getWindow,
        });
        return jsonResult(result);
      }
      case "user_asset_preview": {
        const id = str(args, "id") || str(args, "assetId") || "preview";
        const label = str(args, "label") || id;
        const previewPath = str(args, "previewPath") || undefined;
        const result = await requestAssetChoice({
          projectPath: str(args, "projectPath"),
          prompt: str(args, "prompt") || "Preview this asset (path/id only — not uploaded).",
          options: [{ id, label, previewPath, detail: str(args, "assetId") || undefined }],
          getWindow: ctx.getWindow,
        });
        return jsonResult(result);
      }
      case "user_vfx_sprite_preview": {
        const previewPath = str(args, "previewPath");
        const result = await requestAssetChoice({
          projectPath: str(args, "projectPath"),
          prompt: str(args, "prompt") || "VFX sprite preview (not pasted into Studio).",
          options: [
            {
              id: "vfx-sprite",
              label: str(args, "label") || "VFX sprite",
              previewPath,
            },
          ],
          getWindow: ctx.getWindow,
        });
        return jsonResult(result);
      }
      case "generate_icon": {
        const generated = await generateAsset({
          projectPath: str(args, "projectPath"),
          provider: "gemini",
          prompt: str(args, "prompt"),
          postProcessIcon: true,
        });
        return jsonResult(generated);
      }
      case "edit_icon": {
        const sourcePath = str(args, "sourcePath");
        if (isOutlinedIconPath(sourcePath)) {
          return jsonResult(
            {
              ok: false,
              error:
                "Refusing to edit an already-outlined *-icon.png (double-stroke). Use the unoutlined source, or get_icon_edit_prompt.",
            },
            true,
          );
        }
        const generated = await generateAsset({
          projectPath: str(args, "projectPath"),
          provider: "gemini",
          prompt: str(args, "prompt"),
          sourceImagePath: sourcePath,
          postProcessIcon: false,
        });
        return jsonResult(generated);
      }
      case "get_icon_edit_prompt":
        return textResult(ICON_EDIT_PROMPT);
      case "adjust_icon_stroke": {
        const sourcePath = str(args, "sourcePath");
        if (isOutlinedIconPath(sourcePath)) {
          return jsonResult(
            {
              ok: false,
              error: "Refusing double-stroke of an already outlined *-icon.png.",
            },
            true,
          );
        }
        const outPath = await postProcessIconFile(sourcePath);
        return jsonResult({ ok: true, path: outPath });
      }
      case "generate_3d_model_multiview": {
        const generated = await generateAsset({
          projectPath: str(args, "projectPath"),
          provider: "meshy",
          prompt: str(args, "prompt"),
        });
        return jsonResult(generated);
      }
      case "generate_music":
      case "generate_sfx": {
        const generated = await generateAsset({
          projectPath: str(args, "projectPath"),
          provider: "elevenlabs",
          prompt: str(args, "prompt"),
        });
        return jsonResult(generated);
      }
      case "split_model_start":
      case "split_model_poll":
      case "split_model_ingest":
        return jsonResult(SPLIT_UNSUPPORTED);
      case "request_roblox_authorization": {
        const kind = args.kind === "asset_upload" ? "asset_upload" : "open_cloud";
        ctx.getWindow()?.webContents.send(IPC.OPEN_SETTINGS_FOCUS, { kind });
        return jsonResult({
          ok: true,
          message:
            kind === "asset_upload"
              ? "Opened Settings — paste an asset upload API key (Open Cloud key with asset write)."
              : "Opened Settings — paste an Open Cloud API key for publish / monetization.",
        });
      }
      case "upload_gamepass":
      case "upload_devproduct": {
        const created = await createMonetizationProduct({
          projectPath: str(args, "projectPath"),
          name: str(args, "name"),
          priceInRobux: num(args, "priceInRobux") ?? 0,
          kind: name === "upload_gamepass" ? "gamepass" : "developer-product",
        });
        return jsonResult(created, created.success === false);
      }
      case "notify_desktop": {
        const title = str(args, "title") || "Blockforge";
        const body = str(args, "body");
        try {
          new Notification({ title, body }).show();
        } catch {
          // ignore
        }
        ctx.getWindow()?.webContents.send(IPC.APP_TOAST, { title, body });
        return jsonResult({ ok: true });
      }
      case "notes_list": {
        const entries = await listNotes(str(args, "projectPath"), str(args, "path"));
        return jsonResult({ entries });
      }
      case "notes_read": {
        const content = await readNotesFile(str(args, "projectPath"), str(args, "path"));
        return textResult(content);
      }
      case "notes_write": {
        await writeNotesFile(
          str(args, "projectPath"),
          str(args, "path"),
          str(args, "content"),
        );
        return jsonResult({ ok: true });
      }
      case "notes_rename": {
        await renameNotesFile(
          str(args, "projectPath"),
          str(args, "from"),
          str(args, "to"),
        );
        return jsonResult({ ok: true });
      }
      case "notes_delete": {
        await deleteNotesFile(str(args, "projectPath"), str(args, "path"));
        return jsonResult({ ok: true });
      }
      case "pause_swarm": {
        if (!ctx.pty) {
          return jsonResult({ ok: false, error: "PTY manager is not attached" }, true);
        }
        const paused = ctx.pty.pauseProject(str(args, "projectPath"));
        return jsonResult({ ok: true, ...paused });
      }
      default:
        return jsonResult({ error: `Unknown host tool: ${name}` }, true);
    }
  } catch (err) {
    if (err instanceof NotesSandboxError) {
      return jsonResult({ error: err.message, code: "NOTES_SANDBOX" }, true);
    }
    console.error("[blockforge] host MCP tool failed", { name, err });
    return jsonResult({ error: "Something went wrong" }, true);
  }
}

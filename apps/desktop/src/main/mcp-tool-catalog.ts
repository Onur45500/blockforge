export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type McpCapabilities = {
  hasOpenCloudKey: boolean;
};

export const DISK_SOT_REMINDER =
  "Reminder: disk + Rojo are source of truth. Persist gameplay in src/ and scenery in world/; do not leave permanent edits only in Studio.";

/** Studio tools that mutate the live place — require studio_wait_for_turn. */
export const DRIVE_TOOL_NAMES = new Set([
  "execute_luau",
  "setup_luau",
  "start_stop_play",
  "user_keyboard_input",
  "user_mouse_input",
  "character_navigation",
  "multi_edit",
  "insert_asset",
  "upload_image",
]);

export const MONETIZATION_TOOL_NAMES = new Set([
  "upload_gamepass",
  "upload_devproduct",
]);

export const LEASE_REQUIRED_MESSAGE =
  "Studio drive lease required. Call studio_wait_for_turn first. Missing lease is a hard error, not a wait.";

function props(
  properties: Record<string, unknown>,
  required?: string[],
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    ...(required && required.length > 0 ? { required } : {}),
  };
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required?: string[],
): McpToolDef {
  return { name, description, inputSchema: props(properties, required) };
}

const sessionProject = {
  sessionId: { type: "string" },
  projectPath: { type: "string" },
};

export const HOST_MCP_TOOLS: McpToolDef[] = [
  tool(
    "list_roblox_studios",
    "List MCP-connected Roblox Studio windows. Prefer this over talking to Studio MCP directly.",
  ),
  tool(
    "set_active_studio",
    "Bind this project to a Studio window. studio_id is then auto-injected on proxied Studio calls.",
    {
      studio_id: { type: "string" },
      projectPath: { type: "string" },
    },
    ["studio_id"],
  ),
  tool(
    "studio_connection_status",
    "Mux + Studio connection: Unavailable / NoStudio / Reconnecting / Connected and why.",
    { projectPath: { type: "string" } },
  ),
  tool(
    "studio_reconnect",
    "Kill and respawn the official Studio MCP child (unstick a hung tools/list).",
  ),
  tool(
    "studio_wait_for_turn",
    "Acquire exclusive Studio drive lock for this agent session. Parks until free (finite timeout).",
    {
      ...sessionProject,
      timeoutMs: { type: "number" },
    },
    ["sessionId", "projectPath"],
  ),
  tool(
    "studio_release",
    "Release the Studio drive lock held by this session.",
    { sessionId: { type: "string" } },
    ["sessionId"],
  ),
  tool(
    "playtest_check",
    "Hypothesis → acquire playtest lock → start Play via Studio MCP → console + screenshot → stop Play → verdict. Saves screenshot under .blockforge/playtest/ and returns screenshotPath. Prefer this over start_stop_play. Never invent 0 errors if capture is missing. Visual hypotheses (trees/fireballs/maps) require opening the screenshot — console-clean is not proof of looks. Maps → world/*.model.json; trees → bank mesh + placeModelAsset; fireballs → ParticleEmitter not a Neon Ball.",
    {
      hypothesis: { type: "string" },
      sessionId: { type: "string" },
      projectPath: { type: "string" },
      timeoutMs: { type: "number" },
      waitMs: { type: "number" },
    },
    ["sessionId", "projectPath"],
  ),
  tool(
    "start_stop_play",
    "Locked wrapper around Studio start/stop Play. Prefer playtest_check for measured verification. Requires studio_wait_for_turn.",
    {
      enabled: { type: "boolean" },
      sessionId: { type: "string" },
      projectPath: { type: "string" },
      studio_id: { type: "string" },
    },
  ),
  tool(
    "get_studio_state",
    "Studio locks + mux status + bridge studio-state.json (merged). Also proxies Studio get_studio_state when listed.",
    { projectPath: { type: "string" } },
    ["projectPath"],
  ),
  tool(
    "install_map_toolkit",
    "Idempotent: verify studio-tools/MapToolkit.luau is in the project and return a require() snippet. Never paste the library into execute_luau.",
    { projectPath: { type: "string" } },
    ["projectPath"],
  ),
  tool(
    "studio_agent_gone",
    "Release all Studio/playtest locks for this session (same path as PTY close).",
    { sessionId: { type: "string" } },
    ["sessionId"],
  ),
  tool(
    "search_asset_bank",
    "Search the local CC0 Blockforge asset catalog. For trees/rocks/bushes use query tree/rock/bush — importable ids include kenney_tree, quat_tree_pine, quat_tree_oak. After human import, place with placeModelAsset — never Cylinder+Ball trees or Part-factory maps.",
    { query: { type: "string" }, limit: { type: "number" } },
  ),
  tool(
    "bank_search_similar",
    "Local similarity search: tag / name / category overlap against the CC0 catalog. Prefer mesh props (trees/rocks) over inventing Part kits; platforms still belong in world/*.model.json.",
    { query: { type: "string" }, limit: { type: "number" } },
  ),
  tool(
    "download_asset",
    "Copy a catalog or project file into .blockforge/mcp-downloads/ for native edits. Does not upload to Roblox.",
    {
      projectPath: { type: "string" },
      assetId: { type: "string" },
      filePath: { type: "string" },
    },
    ["projectPath"],
  ),
  tool(
    "lookup_uploaded_asset",
    "Resolve rbxassetid / registry key via assets.json + src/shared/assets.ts. Same as npm run lookup-asset.",
    {
      projectPath: { type: "string" },
      query: { type: "string" },
    },
    ["projectPath", "query"],
  ),
  tool(
    "user_asset_choice",
    "Show choice cards in Blockforge and wait for the human to pick or cancel. Nothing uploads to Roblox before this.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            detail: { type: "string" },
            previewPath: { type: "string" },
          },
          required: ["id", "label"],
        },
      },
    },
    ["projectPath", "options"],
  ),
  tool(
    "user_asset_preview",
    "Show a single path/id preview card in the choice UI. Does not paste into Studio.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
      id: { type: "string" },
      label: { type: "string" },
      previewPath: { type: "string" },
      assetId: { type: "string" },
    },
    ["projectPath"],
  ),
  tool(
    "user_vfx_sprite_preview",
    "Open a generated PNG in the choice UI with a VFX label. Does not paste into Studio.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
      previewPath: { type: "string" },
      label: { type: "string" },
    },
    ["projectPath", "previewPath"],
  ),
  tool(
    "generate_icon",
    "Generate an icon with the user Gemini key, then chroma-key + outline post-process.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
    },
    ["projectPath", "prompt"],
  ),
  tool(
    "edit_icon",
    "Gemini-edit an existing unoutlined icon. Refuses already-outlined *-icon.png (no double-stroke).",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
      sourcePath: { type: "string" },
    },
    ["projectPath", "prompt", "sourcePath"],
  ),
  tool(
    "get_icon_edit_prompt",
    "Return the icon edit recipe (unoutlined source, no double-stroke, when to use adjust_icon_stroke).",
  ),
  tool(
    "adjust_icon_stroke",
    "Run chroma-key + 1px outline once on an unoutlined PNG. Refuses *-icon.png.",
    { sourcePath: { type: "string" } },
    ["sourcePath"],
  ),
  tool(
    "generate_3d_model_multiview",
    "Meshy 3D generation using the user's key. Honest: does not invent a mesh if the job pipeline is not wired.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
    },
    ["projectPath", "prompt"],
  ),
  tool(
    "generate_music",
    "ElevenLabs music using the user's key. Honest stub until the audio pipeline is wired — never pretends a file was created.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
    },
    ["projectPath", "prompt"],
  ),
  tool(
    "generate_sfx",
    "ElevenLabs SFX using the user's key. Honest stub until the audio pipeline is wired.",
    {
      projectPath: { type: "string" },
      prompt: { type: "string" },
    },
    ["projectPath", "prompt"],
  ),
  tool(
    "split_model_start",
    "Mesh split start. Unsupported in Blockforge (was credits-only elsewhere). Does not resell credits.",
    { projectPath: { type: "string" } },
  ),
  tool(
    "split_model_poll",
    "Mesh split poll. Unsupported — Blockforge does not resell credits.",
    { jobId: { type: "string" } },
  ),
  tool(
    "split_model_ingest",
    "Mesh split ingest. Unsupported — import a DCC-split mesh instead.",
    { jobId: { type: "string" } },
  ),
  tool(
    "request_roblox_authorization",
    "Ask the user to open Settings and configure Open Cloud / asset upload keys.",
    { kind: { type: "string", enum: ["open_cloud", "asset_upload"] } },
  ),
  tool(
    "upload_gamepass",
    "Create a Game Pass via Open Cloud (hidden from the catalog when no Open Cloud key is configured).",
    {
      projectPath: { type: "string" },
      name: { type: "string" },
      priceInRobux: { type: "number" },
    },
    ["projectPath", "name", "priceInRobux"],
  ),
  tool(
    "upload_devproduct",
    "Create a Developer Product via Open Cloud (hidden from the catalog when no Open Cloud key is configured).",
    {
      projectPath: { type: "string" },
      name: { type: "string" },
      priceInRobux: { type: "number" },
    },
    ["projectPath", "name", "priceInRobux"],
  ),
  tool(
    "notify_desktop",
    "Show a desktop notification in Blockforge.",
    { title: { type: "string" }, body: { type: "string" } },
    ["title", "body"],
  ),
  tool(
    "notes_list",
    "List files under the project notes/ tree (sandboxed).",
    { projectPath: { type: "string" }, path: { type: "string" } },
    ["projectPath"],
  ),
  tool(
    "notes_read",
    "Read a markdown file under notes/ (path sandbox: no ..).",
    { projectPath: { type: "string" }, path: { type: "string" } },
    ["projectPath", "path"],
  ),
  tool(
    "notes_write",
    "Write a markdown file under notes/ (path sandbox: must stay under notes/).",
    {
      projectPath: { type: "string" },
      path: { type: "string" },
      content: { type: "string" },
    },
    ["projectPath", "path", "content"],
  ),
  tool(
    "notes_rename",
    "Rename a file under notes/. Both paths must stay inside notes/.",
    {
      projectPath: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
    ["projectPath", "from", "to"],
  ),
  tool(
    "notes_delete",
    "Delete a file under notes/ (path sandbox: no ..).",
    { projectPath: { type: "string" }, path: { type: "string" } },
    ["projectPath", "path"],
  ),
  tool(
    "pause_swarm",
    "Pause all Blockforge agent PTYs for this project (stdin writes are dropped until the session is restarted).",
    { projectPath: { type: "string" } },
    ["projectPath"],
  ),
];

export const HOST_TOOL_NAMES = new Set(HOST_MCP_TOOLS.map((t) => t.name));

export function isDriveTool(name: string): boolean {
  return DRIVE_TOOL_NAMES.has(name);
}

export function shouldPrependDiskSotReminder(name: string): boolean {
  return name === "multi_edit" || name.startsWith("script_");
}

export function dropEmptyToolNames(tools: McpToolDef[]): McpToolDef[] {
  return tools.filter((t) => typeof t.name === "string" && t.name.trim().length > 0);
}

export function filterToolsByCapability(
  tools: McpToolDef[],
  capabilities: McpCapabilities,
): McpToolDef[] {
  if (capabilities.hasOpenCloudKey) {
    return tools;
  }
  return tools.filter((t) => !MONETIZATION_TOOL_NAMES.has(t.name));
}

/**
 * Host tools win on name collision. Empty Studio names are dropped.
 * Optionally mark the HTTP catalog as degraded separately.
 */
export function mergeMcpToolCatalogs(
  hostTools: McpToolDef[],
  studioTools: McpToolDef[],
  capabilities?: McpCapabilities,
): { tools: McpToolDef[]; droppedEmpty: number } {
  const studioClean = dropEmptyToolNames(studioTools);
  const droppedEmpty = studioTools.length - studioClean.length;
  const hostNames = new Set(hostTools.map((t) => t.name));
  const merged = [
    ...hostTools,
    ...studioClean.filter((t) => !hostNames.has(t.name)),
  ];
  const filtered = capabilities
    ? filterToolsByCapability(merged, capabilities)
    : merged;
  return { tools: filtered, droppedEmpty };
}

export type LeaseHolder = {
  holdsStudioTurn: (sessionId: string) => boolean;
  renewStudioTurn: (sessionId: string) => boolean;
};

/** Returns an error message when a drive tool is called without a lease. */
export function requireDriveLease(
  toolName: string,
  sessionId: string,
  locks: LeaseHolder,
): string | null {
  if (!isDriveTool(toolName)) {
    return null;
  }
  if (!sessionId || !locks.holdsStudioTurn(sessionId)) {
    return LEASE_REQUIRED_MESSAGE;
  }
  locks.renewStudioTurn(sessionId);
  return null;
}

export function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], isError };
}

export function jsonResult(value: unknown, isError = false): McpToolResult {
  return textResult(JSON.stringify(value), isError);
}

export function prependDiskSotReminder(result: McpToolResult): McpToolResult {
  const first = result.content[0];
  const rest = result.content.slice(1);
  const text = first?.text ?? "";
  return {
    ...result,
    content: [{ type: "text", text: `${DISK_SOT_REMINDER}\n\n${text}` }, ...rest],
  };
}

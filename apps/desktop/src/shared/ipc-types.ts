import type { MappedApiError } from "@blockforge/open-cloud";

export const IPC = {
  PROJECT_LIST: "project:list",
  PROJECT_CREATE: "project:create",
  PROJECT_CREATE_PROGRESS: "project:create-progress",
  PROJECT_OPEN: "project:open",
  PROJECT_CLOSE: "project:close",
  PROJECT_GET_OPEN: "project:get-open",

  DOCTOR_RUN: "doctor:run",
  DOCTOR_INSTALL_BRIDGE_PLUGIN: "doctor:install-bridge-plugin",

  PTY_START: "pty:start",
  PTY_WRITE: "pty:write",
  PTY_RESIZE: "pty:resize",
  PTY_STOP: "pty:stop",
  PTY_LIST: "pty:list",
  PTY_DATA: "pty:data",
  PTY_EXIT: "pty:exit",
  PTY_STATUS_CHANGED: "pty:status-changed",

  ROJO_STATUS: "rojo:status",
  ROJO_STATUS_CHANGED: "rojo:status-changed",
  ROJO_STOP: "rojo:stop",
  ROJO_START: "rojo:start",
  ROJO_RESTART: "rojo:restart",

  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  SETTINGS_HAS_API_KEY: "settings:has-api-key",

  PUBLISH_PLACE: "publish:place",

  ASSET_CATALOG: "asset:catalog",
  ASSET_IMPORT: "asset:import",
  ASSET_LIST_PROJECT: "asset:list-project",
  ASSET_PREVIEW: "asset:preview",
  ASSET_PACK_STATUS: "asset:pack-status",
  ASSET_PACK_DOWNLOAD: "asset:pack-download",
  ASSET_GENERATE: "asset:generate",
  STYLE_PACK_ACTIVATE: "style-pack:activate",
  ATTRIBUTION_LIST: "attribution:list",
  MONETIZATION_LIST: "monetization:list",
  MONETIZATION_CREATE: "monetization:create",
  SYNCBACK_STATUS: "syncback:status",
  SYNCBACK_RESOLVE: "syncback:resolve",
  PROJECT_LIST_OPEN: "project:list-open",
  PROJECT_SWITCH: "project:switch",
  CLOUD_SYNC_PUSH: "cloud-sync:push",
  CLOUD_SYNC_PULL: "cloud-sync:pull",
  COMMUNITY_SHARE: "community:share",
  UPDATE_CHECK: "update:check",
  UPDATE_DOWNLOAD_INSTALL: "update:download-install",
  APP_INFO: "app:info",

  CLIPBOARD_READ: "clipboard:read",
  CLIPBOARD_WRITE: "clipboard:write",

  GIT_STATUS: "git:status",
  GIT_DIFF: "git:diff",
  GIT_STAGE: "git:stage",
  GIT_UNSTAGE: "git:unstage",
  GIT_COMMIT: "git:commit",
  GIT_BRANCHES: "git:branches",
  GIT_CHECKOUT: "git:checkout",
  GIT_CREATE_BRANCH: "git:create-branch",
  GIT_PULL: "git:pull",
  GIT_PUSH: "git:push",
  GIT_DISCARD: "git:discard",

  BACKUP_CREATE: "backup:create",
  BACKUP_LIST: "backup:list",
  BACKUP_RESTORE: "backup:restore",

  ASSET_CHOICE_PENDING: "asset:choice-pending",
  ASSET_CHOICE_RESOLVE: "asset:choice-resolve",
  ASSET_CHOICE_CANCEL: "asset:choice-cancel",

  STUDIO_LOCKS_STATUS: "studio-locks:status",
  STUDIO_LOCKS_CHANGED: "studio-locks:changed",

  APP_TOAST: "app:toast",
  OPEN_SETTINGS_FOCUS: "app:open-settings-focus",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export type ProjectSummary = {
  id: string;
  name: string;
  path: string;
  templateVersion: string;
  createdAt: string;
};

export type ProjectCreateProgressEvent = {
  step: "copy" | "npm-install" | "typecheck" | "done";
  detail: string;
};

export type TemplateUpgradeResult = {
  upgraded: boolean;
  from: string;
  to: string;
  skipped: string[];
};

export type OpenProjectState = {
  project: ProjectSummary;
  rojoPort: number;
  templateUpgrade?: TemplateUpgradeResult;
} | null;

/** Multiple concurrently open projects (M4). */
export type OpenProjectsSnapshot = {
  activeProjectId: string | null;
  projects: NonNullable<OpenProjectState>[];
};

export type DoctorCheckId =
  | "node"
  | "git-bash"
  | "roblox-studio"
  | "claude-code"
  | "codex"
  | "opencode"
  | "antigravity"
  | "wsl2"
  | "studio-mcp"
  | "blockforge-bridge-plugin";

export type AgentId =
  | "claude-code"
  | "codex"
  | "opencode"
  | "antigravity";

export type DoctorCheckResult = {
  id: DoctorCheckId;
  label: string;
  status: "ok" | "missing" | "warning";
  detail: string;
  installGuidance?: string;
};

export type DoctorReport = {
  checks: DoctorCheckResult[];
  platform: string;
};

export type InstallBridgePluginResult =
  | { success: true; path: string }
  | { success: false; message: string };

export type PtySessionSource = "ui" | "agent";

export type PtySessionStatus = "running" | "exited" | "idle" | "paused";

export type PtySessionKind = "agent" | "shell";

export const SHELL_ADAPTER_ID = "cmd" as const;

export type ShellAdapterId = typeof SHELL_ADAPTER_ID;

export type PtyAdapterId = AgentId | ShellAdapterId;

export type PtyStartRequest = {
  projectPath: string;
  cols: number;
  rows: number;
  /** Agent vs system shell. Defaults to agent. */
  kind?: PtySessionKind;
  /** Which coding agent CLI to launch (default: claude-code). Ignored for shells. */
  adapterId?: AgentId;
  /** Resume previous CLI session when the adapter supports it. */
  resume?: boolean;
  /** Stop this session id before starting (optional). */
  replaceSessionId?: string;
  /** Human-readable label (e.g. world-builder, qa, scratch). */
  label?: string;
  /** Swarm / worker role when known. */
  role?: string;
  /** Who requested the spawn. */
  source?: PtySessionSource;
  /** Ask the UI to focus this session after spawn (default false). */
  focus?: boolean;
};

export type PtyStartResult = {
  sessionId: string;
};

export type PtyWriteRequest = {
  sessionId: string;
  data: string;
};

export type PtyResizeRequest = {
  sessionId: string;
  cols: number;
  rows: number;
};

export type PtyStopRequest = {
  sessionId: string;
};

export type PtySessionInfo = {
  sessionId: string;
  kind: PtySessionKind;
  adapterId: PtyAdapterId;
  projectPath: string;
  label?: string;
  role?: string;
  status: PtySessionStatus;
  source: PtySessionSource;
  pinned: boolean;
  pid: number | null;
  startedAt: string;
  lastActivityAt: string;
  exitCode?: number;
};

export function isAgentPtySession(
  session: PtySessionInfo,
): session is PtySessionInfo & { kind: "agent"; adapterId: AgentId } {
  return session.kind !== "shell";
}

export function isShellPtySession(
  session: PtySessionInfo,
): session is PtySessionInfo & { kind: "shell"; adapterId: ShellAdapterId } {
  return session.kind === "shell";
}

export type PtyListRequest = {
  projectPath?: string;
  adapterId?: AgentId;
  kind?: PtySessionKind;
};

export type PtyDataEvent = {
  sessionId: string;
  data: string;
};

export type PtyExitEvent = {
  sessionId: string;
  exitCode: number;
};

export type PtyStatusChangedEvent = {
  projectPath: string;
  sessions: PtySessionInfo[];
  /** When set, UI should focus this session (agent or user requested). */
  focusSessionId?: string;
};

export type StudioSyncStatus = "in-sync" | "world-missing" | "stale" | "unknown";

export type RojoSyncStatus = {
  running: boolean;
  port: number | null;
  rbxtscRunning: boolean;
  rojoServeRunning: boolean;
  studioConnected: boolean;
  oneWaySyncWarning: true;
  lastError: string | null;
  /** Latest stripped rbxtsc watch line(s) for the Sync panel. */
  compilerStatus: "idle" | "ok" | "error";
  compilerLog: string | null;
  /** Blockforge Studio Output bridge listening on 127.0.0.1:34873 */
  studioBridgeRunning: boolean;
  /** Plugin has hit /health or /log recently */
  studioBridgeConnected: boolean;
  lastRuntimeError: string | null;
  /** Whether Workspace.World exists in the last Studio state snapshot */
  studioWorldPresent: boolean | null;
  studioSyncStatus: StudioSyncStatus;
  studioWorldNames: string[];
  /**
   * Guidance-only: whether the official Studio MCP launcher binary/bat was found.
   * Does not prove Assistant “Enable Studio as MCP server” is toggled on.
   */
  studioMcpLauncherFound: boolean;
  /** True only after a live Studio MCP initialize + tools/list. */
  studioMcpConnected: boolean;
  studioMcpDetail: string;
  /** True when preferred Rojo port was busy and we fell back. */
  foreignRojoPort: boolean;
  foreignRojoDetail: string | null;
};

export type AgentModelId = "sonnet" | "opus" | "haiku";

export type OpenCloudSettings = {
  universeId: string;
  placeId: string;
  userId: string;
  hasApiKey: boolean;
  /** Separate key for asset uploads (falls back to Open Cloud key when unset). */
  hasAssetUploadApiKey: boolean;
  agentModel: AgentModelId;
  /** Default agent tab when opening a project terminal. */
  defaultAgentId: AgentId;
  /** Launch agents inside WSL2 on Windows (sandbox tier 1). */
  runInWsl: boolean;
  /**
   * Enable Claude Code Agent Teams (lead Claude coordinates worker Claudes).
   * Default true — matches multi-agent swarm with Blockforge gates.
   */
  agentTeams: boolean;
  /**
   * Prefer official Studio MCP for Play verification (agents). Bridge remains fallback.
   */
  preferStudioMcp: boolean;
  /** Optional user-owned generation API keys (encrypted). */
  hasGeminiApiKey: boolean;
  hasMeshyApiKey: boolean;
  hasElevenLabsApiKey: boolean;
  /** Experimental Rojo syncback (Studio → disk). Default false = one-way. */
  experimentalSyncback: boolean;
};

export type OpenCloudSettingsInput = {
  apiKey?: string;
  /** Asset upload API key (Open Cloud asset write). OAuth deferred. */
  assetUploadApiKey?: string;
  universeId?: string;
  placeId?: string;
  userId?: string;
  agentModel?: AgentModelId;
  defaultAgentId?: AgentId;
  runInWsl?: boolean;
  agentTeams?: boolean;
  preferStudioMcp?: boolean;
  geminiApiKey?: string;
  meshyApiKey?: string;
  elevenLabsApiKey?: string;
  experimentalSyncback?: boolean;
};

export type PublishRequest = {
  projectPath: string;
  versionType?: "Published" | "Saved";
};

export type PublishResult =
  | { success: true; versionNumber: number }
  | { success: false; error: MappedApiError };

export type AssetCatalogEntry = {
  id: string;
  name: string;
  type: "model" | "decal" | "audio" | "image";
  category?: string;
  tags: string[];
  license?: string;
  attribution?: string;
  previewPath?: string;
  filePath?: string;
  uploadSupported: boolean;
};

export type AssetCatalog = {
  version: string;
  generatedAt?: string;
  description?: string;
  assets: AssetCatalogEntry[];
};

export type ProjectAssetEntry = {
  key: string;
  assetId: string;
  displayName: string;
  sourceCatalogId?: string;
  uploadedAt: string;
};

export type ProjectAssetsFile = {
  templateVersion: string;
  createdWith: string;
  assets: Record<string, ProjectAssetEntry>;
};

export type AssetImportRequest = {
  projectPath: string;
  catalogAssetId: string;
  key: string;
  filePath?: string;
};

export type AssetImportResult =
  | { success: true; assetId: string; key: string }
  | { success: false; message: string };

export type AssetPreviewRequest = {
  catalogAssetId: string;
};

export type AssetPreviewModelFormat = "fbx" | "glb" | "gltf" | "obj";

export type AssetPreviewResult =
  | { kind: "image"; dataUrl: string; mime: string; filePath: string }
  | { kind: "audio"; dataUrl: string; mime: string; filePath: string }
  | {
      kind: "model";
      dataUrl: string;
      mime: string;
      format: AssetPreviewModelFormat;
      filePath: string;
    }
  | { kind: "none"; reason: string };

export type AttributionRow = {
  catalogId: string;
  name: string;
  license: string;
  attribution: string;
  source: string;
  insertedAt: string;
  key?: string;
};

export type AttributionFile = {
  version: number;
  entries: AttributionRow[];
};

export type PackDownloadProgress = {
  status: "idle" | "downloading" | "verifying" | "ready" | "error";
  percent: number;
  detail: string;
  localPath?: string;
};

export type GenerateAssetRequest = {
  projectPath: string;
  provider: "gemini" | "meshy" | "elevenlabs";
  prompt: string;
  postProcessIcon?: boolean;
};

export type GenerateAssetResult =
  | {
      success: true;
      provider: string;
      outputPath: string;
      detail: string;
    }
  | { success: false; message: string };

export type StylePackActivateRequest = {
  projectPath: string;
  packId?: string;
};

export type StylePackActivateResult =
  | { success: true; packId: string; path: string; detail: string }
  | { success: false; message: string };

export type MonetizationProduct = {
  id: string;
  name: string;
  kind: "gamepass" | "developer-product";
  priceInRobux?: number;
  /** False for local scaffolds that have not been created on Roblox. */
  liveOnRoblox?: boolean;
};

export type CreateMonetizationRequest = {
  projectPath: string;
  name: string;
  kind: "gamepass" | "developer-product";
  priceInRobux: number;
};

export type CreateMonetizationResult =
  | { success: true; product: MonetizationProduct; message: string }
  | { success: false; message: string };

export type SyncbackConflict = {
  id: string;
  path: string;
  detail: string;
};

export type SyncbackStatus = {
  enabled: boolean;
  conflicts: SyncbackConflict[];
  lastScanAt: string | null;
};

export type SyncbackResolveRequest = {
  conflictId: string;
  resolution: "keep-disk" | "take-studio" | "open-diff";
};

export type CloudSyncResult =
  | { success: true; detail: string }
  | { success: false; message: string };

export type CommunityShareResult =
  | { success: true; detail: string }
  | { success: false; message: string };

export type AppInfo = {
  version: string;
  packaged: boolean;
};

export type UpdateCheckResult = {
  available: boolean;
  packaged: boolean;
  currentVersion: string;
  latestVersion?: string;
  detail: string;
};

export type BlockforgeApi = {
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (name: string) => Promise<ProjectSummary>;
  onProjectCreateProgress: (
    cb: (event: ProjectCreateProgressEvent) => void,
  ) => () => void;
  openProject: (id: string) => Promise<OpenProjectState>;
  closeProject: () => Promise<void>;
  getOpenProject: () => Promise<OpenProjectState>;
  listOpenProjects: () => Promise<OpenProjectsSnapshot>;
  switchProject: (id: string) => Promise<OpenProjectState>;

  runDoctor: () => Promise<DoctorReport>;
  installBridgePlugin: () => Promise<InstallBridgePluginResult>;

  ptyStart: (req: PtyStartRequest) => Promise<PtyStartResult>;
  ptyWrite: (req: PtyWriteRequest) => Promise<void>;
  ptyResize: (req: PtyResizeRequest) => Promise<void>;
  ptyStop: (req: PtyStopRequest) => Promise<void>;
  ptyList: (req?: PtyListRequest) => Promise<PtySessionInfo[]>;
  onPtyData: (cb: (event: PtyDataEvent) => void) => () => void;
  onPtyExit: (cb: (event: PtyExitEvent) => void) => () => void;
  onPtyStatusChanged: (cb: (event: PtyStatusChangedEvent) => void) => () => void;

  getRojoStatus: () => Promise<RojoSyncStatus>;
  onRojoStatusChanged: (cb: (status: RojoSyncStatus) => void) => () => void;
  stopRojo: () => Promise<OpenProjectState>;
  startRojo: () => Promise<OpenProjectState>;
  restartRojo: () => Promise<OpenProjectState>;

  getSettings: () => Promise<OpenCloudSettings>;
  setSettings: (input: OpenCloudSettingsInput) => Promise<OpenCloudSettings>;

  publishPlace: (req: PublishRequest) => Promise<PublishResult>;

  getAssetCatalog: () => Promise<AssetCatalog>;
  importAsset: (req: AssetImportRequest) => Promise<AssetImportResult>;
  listProjectAssets: (projectPath: string) => Promise<ProjectAssetsFile>;
  getAssetPreview: (req: AssetPreviewRequest) => Promise<AssetPreviewResult>;
  getPackStatus: () => Promise<PackDownloadProgress>;
  downloadAssetPack: () => Promise<PackDownloadProgress>;
  generateAsset: (req: GenerateAssetRequest) => Promise<GenerateAssetResult>;
  activateStylePack: (
    req: StylePackActivateRequest,
  ) => Promise<StylePackActivateResult>;
  listAttribution: (projectPath: string) => Promise<AttributionFile>;

  listMonetizationProducts: (projectPath: string) => Promise<MonetizationProduct[]>;
  createMonetizationProduct: (
    req: CreateMonetizationRequest,
  ) => Promise<CreateMonetizationResult>;

  getSyncbackStatus: (projectPath: string) => Promise<SyncbackStatus>;
  resolveSyncbackConflict: (req: SyncbackResolveRequest) => Promise<SyncbackStatus>;

  cloudSyncPush: (projectPath: string) => Promise<CloudSyncResult>;
  cloudSyncPull: (projectPath: string) => Promise<CloudSyncResult>;
  communitySharePack: (projectPath: string) => Promise<CommunityShareResult>;
  getAppInfo: () => Promise<AppInfo>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadAndInstallUpdate: () => Promise<UpdateCheckResult>;

  clipboardRead: () => Promise<string>;
  clipboardWrite: (text: string) => Promise<void>;

  gitStatus: (projectPath: string) => Promise<GitStatusResult>;
  gitDiff: (req: { projectPath: string; staged?: boolean }) => Promise<string>;
  gitStage: (req: { projectPath: string; paths: string[] }) => Promise<void>;
  gitUnstage: (req: { projectPath: string; paths: string[] }) => Promise<void>;
  gitCommit: (req: {
    projectPath: string;
    message: string;
  }) => Promise<{ commit: string }>;
  gitBranches: (
    projectPath: string,
  ) => Promise<{ current: string | null; all: string[] }>;
  gitCheckout: (req: { projectPath: string; branch: string }) => Promise<void>;
  gitCreateBranch: (req: {
    projectPath: string;
    branch: string;
  }) => Promise<void>;
  gitPull: (projectPath: string) => Promise<string>;
  gitPush: (projectPath: string) => Promise<string>;
  gitDiscard: (req: { projectPath: string; paths: string[] }) => Promise<void>;

  backupCreate: (req: {
    projectId: string;
    projectPath: string;
    projectName: string;
  }) => Promise<BackupInfo>;
  backupList: (projectId: string) => Promise<BackupInfo[]>;
  backupRestore: (req: {
    zipPath: string;
    destPath: string;
  }) => Promise<{ destPath: string }>;

  resolveAssetChoice: (req: {
    choiceId: string;
    optionId: string;
  }) => Promise<AssetChoiceResult>;
  cancelAssetChoice: (req: {
    choiceId: string;
    reason?: "user_dismissed" | "swarm_stopped";
  }) => Promise<AssetChoiceResult>;
  onAssetChoicePending: (cb: (event: AssetChoicePending) => void) => () => void;
  onAppToast: (
    cb: (event: { title: string; body: string }) => void,
  ) => () => void;
  onOpenSettingsFocus: (
    cb: (event: { kind: "open_cloud" | "asset_upload" }) => void,
  ) => () => void;
  getStudioLocksStatus: () => Promise<StudioLockStatusSnapshot>;
  onStudioLocksChanged: (
    cb: (status: StudioLockStatusSnapshot) => void,
  ) => () => void;
};

export type GitStatusResult = {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  files: Array<{ path: string; index: string; working_dir: string }>;
  isRepo: boolean;
};

export type BackupInfo = {
  projectId: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
};

export type AssetChoicePending = {
  choiceId: string;
  projectPath: string;
  prompt?: string;
  options: Array<{
    id: string;
    label: string;
    detail?: string;
    previewPath?: string;
  }>;
};

export type AssetChoiceResult =
  | { status: "picked"; choiceId: string; optionId: string }
  | {
      status: "cancelled";
      choiceId: string;
      reason: "user_dismissed" | "swarm_stopped" | "timeout";
    };

export type StudioLockStatusSnapshot = {
  studioHolderSessionId: string | null;
  studioHolderProjectPath: string | null;
  playtestHolderSessionId: string | null;
  playtestHolderProjectPath: string | null;
  updatedAt: string;
};

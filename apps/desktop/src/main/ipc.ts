import { join } from "node:path";
import { ipcMain, app, clipboard, type BrowserWindow } from "electron";
import { IPC } from "../shared/ipc-types.js";
import type {
  AssetPreviewRequest,
  CreateMonetizationRequest,
  GenerateAssetRequest,
  OpenCloudSettingsInput,
  PublishRequest,
  SyncbackResolveRequest,
} from "../shared/ipc-types.js";
import { ProjectManager } from "./projects.js";
import { installBridgePlugin, runDoctor } from "./doctor.js";
import { PtyManager } from "./pty-manager.js";
import { PtyControlWatcher } from "./pty-control-watcher.js";
import { studioLocks } from "./studio-locks.js";
import {
  cancelAssetChoice,
  resolveAssetChoice,
} from "./asset-choice-service.js";
import {
  createProjectBackup,
  listProjectBackups,
  restoreProjectBackup,
} from "./backup-service.js";
import {
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCreateBranch,
  gitDiff,
  gitDiscard,
  gitPull,
  gitPush,
  gitStage,
  gitStatus,
  gitUnstage,
} from "./git-service.js";
import { z } from "zod";
import {
  getOpenCloudSettings,
  setOpenCloudSettings,
} from "./open-cloud-store.js";
import { publishPlace } from "./publish-service.js";
import {
  getAssetCatalog,
  getAssetPreview,
  importAsset,
  listProjectAssets,
} from "./asset-service.js";
import { listAttribution } from "./attribution-service.js";
import { generateAsset } from "./ai-generate-service.js";
import {
  downloadAssetPack,
  getPackStatus,
} from "./pack-download-service.js";
import {
  createMonetizationProduct,
  listMonetizationProducts,
} from "./monetization-service.js";
import {
  getSyncbackStatus,
  resolveSyncbackConflict,
} from "./syncback-service.js";
import { activateStylePack } from "./style-pack-service.js";
import {
  checkForUpdates,
  cloudSyncPull,
  cloudSyncPush,
  communitySharePack,
  downloadAndInstallUpdate,
  getAppInfo,
} from "./platform-services.js";
import {
  assetImportSchema,
  backupDestPathSchema,
  backupZipPathSchema,
  parseIpc,
  projectIdSchema,
  projectPathSchema,
  ptyListSchema,
  ptyResizeSchema,
  ptySessionIdSchema,
  ptyStartSchema,
  ptyWriteSchema,
  stylePackActivateSchema,
} from "./ipc-validation.js";

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  projectManager: ProjectManager,
  ptyManager: PtyManager,
): PtyControlWatcher {
  const controlWatcher = new PtyControlWatcher(ptyManager);

  projectManager.onStatusChanged((status) => {
    getWindow()?.webContents.send(IPC.ROJO_STATUS_CHANGED, status);
  });

  projectManager.onCreateProgress((event) => {
    getWindow()?.webContents.send(IPC.PROJECT_CREATE_PROGRESS, event);
  });

  studioLocks.onStatusChanged((status) => {
    getWindow()?.webContents.send(IPC.STUDIO_LOCKS_CHANGED, status);
  });

  ipcMain.handle(IPC.PROJECT_LIST, () => projectManager.listProjects());

  ipcMain.handle(IPC.PROJECT_CREATE, (_event, name: string) => {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Invalid project name");
    }
    return projectManager.createProject(name);
  });

  ipcMain.handle(IPC.PROJECT_OPEN, async (_event, id: unknown) => {
    const opened = await projectManager.openProject(
      parseIpc(projectIdSchema, id, "project id"),
    );
    if (opened) {
      await controlWatcher.watchProject(opened.project.path);
    }
    return opened;
  });

  ipcMain.handle(IPC.PROJECT_CLOSE, async () => {
    const open = projectManager.getOpenProject();
    if (open) {
      controlWatcher.unwatchProject(open.project.path);
      await ptyManager.stopProject(open.project.path);
    }
    await projectManager.closeProject();
  });

  ipcMain.handle(IPC.PROJECT_GET_OPEN, () => projectManager.getOpenProject());

  ipcMain.handle(IPC.PROJECT_LIST_OPEN, () => projectManager.listOpenProjects());

  ipcMain.handle(IPC.PROJECT_SWITCH, async (_event, id: unknown) => {
    const opened = await projectManager.switchProject(
      parseIpc(projectIdSchema, id, "project id"),
    );
    if (opened) {
      await controlWatcher.watchProject(opened.project.path);
    }
    return opened;
  });

  ipcMain.handle(IPC.DOCTOR_RUN, () => runDoctor());

  ipcMain.handle(IPC.DOCTOR_INSTALL_BRIDGE_PLUGIN, () => installBridgePlugin());

  ipcMain.handle(IPC.PTY_START, (_event, req: unknown) =>
    ptyManager.start(parseIpc(ptyStartSchema, req, "pty:start")),
  );

  ipcMain.handle(IPC.PTY_WRITE, (_event, req: unknown) => {
    ptyManager.write(parseIpc(ptyWriteSchema, req, "pty:write"));
  });

  ipcMain.handle(IPC.PTY_RESIZE, (_event, req: unknown) => {
    ptyManager.resize(parseIpc(ptyResizeSchema, req, "pty:resize"));
  });

  ipcMain.handle(IPC.PTY_STOP, async (_event, req: unknown) => {
    await ptyManager.stop(parseIpc(ptySessionIdSchema, req, "pty:stop"));
  });

  ipcMain.handle(IPC.PTY_LIST, (_event, req: unknown) => {
    const parsed = parseIpc(ptyListSchema, req, "pty:list");
    return ptyManager.listSessions(
      parsed?.projectPath,
      parsed?.adapterId,
      parsed?.kind,
    );
  });

  ipcMain.handle(IPC.ROJO_STATUS, () => projectManager.getMergedStatus());

  ipcMain.handle(IPC.ROJO_STOP, () => projectManager.stopRojo());

  ipcMain.handle(IPC.ROJO_START, () => projectManager.startRojo());

  ipcMain.handle(IPC.ROJO_RESTART, () => projectManager.restartRojo());

  ipcMain.handle(IPC.SETTINGS_GET, () => getOpenCloudSettings());

  ipcMain.handle(IPC.SETTINGS_SET, (_event, input: OpenCloudSettingsInput) =>
    setOpenCloudSettings(input),
  );

  ipcMain.handle(IPC.SETTINGS_HAS_API_KEY, async () => {
    const settings = await getOpenCloudSettings();
    return settings.hasApiKey;
  });

  ipcMain.handle(IPC.PUBLISH_PLACE, (_event, req: PublishRequest) => {
    const binDir = join(app.getPath("userData"), "bin");
    return publishPlace(req, binDir);
  });

  ipcMain.handle(IPC.ASSET_CATALOG, () => getAssetCatalog());

  ipcMain.handle(IPC.ASSET_IMPORT, (_event, req: unknown) =>
    importAsset(parseIpc(assetImportSchema, req, "asset:import")),
  );

  ipcMain.handle(IPC.ASSET_LIST_PROJECT, (_event, projectPath: unknown) =>
    listProjectAssets(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(IPC.ASSET_PREVIEW, (_event, req: AssetPreviewRequest) =>
    getAssetPreview(req),
  );

  ipcMain.handle(IPC.ASSET_PACK_STATUS, () => getPackStatus());

  ipcMain.handle(IPC.ASSET_PACK_DOWNLOAD, () => downloadAssetPack());

  ipcMain.handle(IPC.ASSET_GENERATE, (_event, req: GenerateAssetRequest) =>
    generateAsset(req),
  );

  ipcMain.handle(IPC.STYLE_PACK_ACTIVATE, (_event, req: unknown) => {
    const parsed = parseIpc(stylePackActivateSchema, req, "style-pack:activate");
    return activateStylePack(parsed.projectPath, parsed.packId ?? "lowpoly-nature");
  });

  ipcMain.handle(IPC.ATTRIBUTION_LIST, (_event, projectPath: unknown) =>
    listAttribution(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(IPC.MONETIZATION_LIST, (_event, projectPath: unknown) =>
    listMonetizationProducts(
      parseIpc(projectPathSchema, projectPath, "projectPath"),
    ),
  );

  ipcMain.handle(
    IPC.MONETIZATION_CREATE,
    (_event, req: CreateMonetizationRequest) => createMonetizationProduct(req),
  );

  ipcMain.handle(IPC.SYNCBACK_STATUS, (_event, projectPath: unknown) =>
    getSyncbackStatus(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(
    IPC.SYNCBACK_RESOLVE,
    async (_event, req: SyncbackResolveRequest) => {
      const open = projectManager.getOpenProject();
      if (!open) {
        throw new Error("No project open");
      }
      return resolveSyncbackConflict(open.project.path, req);
    },
  );

  ipcMain.handle(IPC.CLOUD_SYNC_PUSH, (_event, projectPath: unknown) =>
    cloudSyncPush(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(IPC.CLOUD_SYNC_PULL, (_event, projectPath: unknown) =>
    cloudSyncPull(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(IPC.COMMUNITY_SHARE, (_event, projectPath: unknown) =>
    communitySharePack(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );

  ipcMain.handle(IPC.APP_INFO, () => getAppInfo());

  ipcMain.handle(IPC.UPDATE_CHECK, () => checkForUpdates());

  ipcMain.handle(IPC.UPDATE_DOWNLOAD_INSTALL, () => downloadAndInstallUpdate());

  ipcMain.handle(IPC.CLIPBOARD_READ, () => clipboard.readText());

  ipcMain.handle(IPC.CLIPBOARD_WRITE, (_event, text: unknown) => {
    if (typeof text !== "string") {
      throw new Error("clipboard:write expects a string");
    }
    clipboard.writeText(text);
  });

  const gitPathSchema = z.object({
    projectPath: projectPathSchema,
    paths: z.array(z.string().min(1)).default([]),
  });
  const gitMessageSchema = z.object({
    projectPath: projectPathSchema,
    message: z.string().min(1).max(2000),
  });
  const gitBranchSchema = z.object({
    projectPath: projectPathSchema,
    branch: z.string().min(1).max(200),
  });
  const gitDiffSchema = z.object({
    projectPath: projectPathSchema,
    staged: z.boolean().optional(),
  });

  ipcMain.handle(IPC.GIT_STATUS, (_event, projectPath: unknown) =>
    gitStatus(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );
  ipcMain.handle(IPC.GIT_DIFF, (_event, req: unknown) => {
    const parsed = parseIpc(gitDiffSchema, req, "git:diff");
    return gitDiff(parsed.projectPath, parsed.staged === true);
  });
  ipcMain.handle(IPC.GIT_STAGE, (_event, req: unknown) => {
    const parsed = parseIpc(gitPathSchema, req, "git:stage");
    return gitStage(parsed.projectPath, parsed.paths);
  });
  ipcMain.handle(IPC.GIT_UNSTAGE, (_event, req: unknown) => {
    const parsed = parseIpc(gitPathSchema, req, "git:unstage");
    return gitUnstage(parsed.projectPath, parsed.paths);
  });
  ipcMain.handle(IPC.GIT_COMMIT, (_event, req: unknown) => {
    const parsed = parseIpc(gitMessageSchema, req, "git:commit");
    return gitCommit(parsed.projectPath, parsed.message);
  });
  ipcMain.handle(IPC.GIT_BRANCHES, (_event, projectPath: unknown) =>
    gitBranches(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );
  ipcMain.handle(IPC.GIT_CHECKOUT, (_event, req: unknown) => {
    const parsed = parseIpc(gitBranchSchema, req, "git:checkout");
    return gitCheckout(parsed.projectPath, parsed.branch);
  });
  ipcMain.handle(IPC.GIT_CREATE_BRANCH, (_event, req: unknown) => {
    const parsed = parseIpc(gitBranchSchema, req, "git:create-branch");
    return gitCreateBranch(parsed.projectPath, parsed.branch);
  });
  ipcMain.handle(IPC.GIT_PULL, (_event, projectPath: unknown) =>
    gitPull(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );
  ipcMain.handle(IPC.GIT_PUSH, (_event, projectPath: unknown) =>
    gitPush(parseIpc(projectPathSchema, projectPath, "projectPath")),
  );
  ipcMain.handle(IPC.GIT_DISCARD, (_event, req: unknown) => {
    const parsed = parseIpc(gitPathSchema, req, "git:discard");
    return gitDiscard(parsed.projectPath, parsed.paths);
  });

  const backupCreateSchema = z.object({
    projectId: z.string().min(1),
    projectPath: projectPathSchema,
    projectName: z.string().min(1),
  });
  const backupRestoreSchema = z.object({
    zipPath: backupZipPathSchema,
    destPath: backupDestPathSchema,
  });

  ipcMain.handle(IPC.BACKUP_CREATE, (_event, req: unknown) =>
    createProjectBackup(parseIpc(backupCreateSchema, req, "backup:create")),
  );
  ipcMain.handle(IPC.BACKUP_LIST, (_event, projectId: unknown) =>
    listProjectBackups(parseIpc(projectIdSchema, projectId, "projectId")),
  );
  ipcMain.handle(IPC.BACKUP_RESTORE, (_event, req: unknown) =>
    restoreProjectBackup(parseIpc(backupRestoreSchema, req, "backup:restore")),
  );

  const choiceResolveSchema = z.object({
    choiceId: z.string().min(1),
    optionId: z.string().min(1),
  });
  const choiceCancelSchema = z.object({
    choiceId: z.string().min(1),
    reason: z.enum(["user_dismissed", "swarm_stopped"]).optional(),
  });

  ipcMain.handle(IPC.ASSET_CHOICE_RESOLVE, (_event, req: unknown) => {
    const parsed = parseIpc(choiceResolveSchema, req, "asset:choice-resolve");
    return resolveAssetChoice(parsed.choiceId, parsed.optionId);
  });
  ipcMain.handle(IPC.ASSET_CHOICE_CANCEL, (_event, req: unknown) => {
    const parsed = parseIpc(choiceCancelSchema, req, "asset:choice-cancel");
    return cancelAssetChoice(parsed.choiceId, parsed.reason ?? "user_dismissed");
  });

  ipcMain.handle(IPC.STUDIO_LOCKS_STATUS, () => studioLocks.getStatus());

  return controlWatcher;
}

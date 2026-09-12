import { ipcRenderer } from "electron";
import {
  ALLOWED_EVENT_CHANNELS,
  ALLOWED_INVOKE_CHANNELS,
  isAllowedEventChannel,
  isAllowedInvokeChannel,
} from "../shared/ipc-channels";
import { IPC } from "../shared/ipc-types";
import type { BlockforgeApi } from "../shared/ipc-types";

const allowedInvokeChannels = new Set<string>(ALLOWED_INVOKE_CHANNELS);
const allowedEventChannels = new Set<string>(ALLOWED_EVENT_CHANNELS);

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!isAllowedInvokeChannel(channel) || !allowedInvokeChannels.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function subscribe<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  if (!isAllowedEventChannel(channel) || !allowedEventChannels.has(channel)) {
    throw new Error(`IPC event channel not allowed: ${channel}`);
  }
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

export const blockforgeApi: BlockforgeApi = {
  listProjects: () => invoke(IPC.PROJECT_LIST),
  createProject: (name) => invoke(IPC.PROJECT_CREATE, name),
  onProjectCreateProgress: (cb) => subscribe(IPC.PROJECT_CREATE_PROGRESS, cb),
  openProject: (id) => invoke(IPC.PROJECT_OPEN, id),
  closeProject: () => invoke(IPC.PROJECT_CLOSE),
  getOpenProject: () => invoke(IPC.PROJECT_GET_OPEN),
  listOpenProjects: () => invoke(IPC.PROJECT_LIST_OPEN),
  switchProject: (id) => invoke(IPC.PROJECT_SWITCH, id),

  runDoctor: () => invoke(IPC.DOCTOR_RUN),
  installBridgePlugin: () => invoke(IPC.DOCTOR_INSTALL_BRIDGE_PLUGIN),

  ptyStart: (req) => invoke(IPC.PTY_START, req),
  ptyWrite: (req) => invoke(IPC.PTY_WRITE, req),
  ptyResize: (req) => invoke(IPC.PTY_RESIZE, req),
  ptyStop: (req) => invoke(IPC.PTY_STOP, req),
  ptyList: (req) => invoke(IPC.PTY_LIST, req),
  onPtyData: (cb) => subscribe(IPC.PTY_DATA, cb),
  onPtyExit: (cb) => subscribe(IPC.PTY_EXIT, cb),
  onPtyStatusChanged: (cb) => subscribe(IPC.PTY_STATUS_CHANGED, cb),

  getRojoStatus: () => invoke(IPC.ROJO_STATUS),
  onRojoStatusChanged: (cb) => subscribe(IPC.ROJO_STATUS_CHANGED, cb),
  stopRojo: () => invoke(IPC.ROJO_STOP),
  startRojo: () => invoke(IPC.ROJO_START),
  restartRojo: () => invoke(IPC.ROJO_RESTART),

  getSettings: () => invoke(IPC.SETTINGS_GET),
  setSettings: (input) => invoke(IPC.SETTINGS_SET, input),

  publishPlace: (req) => invoke(IPC.PUBLISH_PLACE, req),

  getAssetCatalog: () => invoke(IPC.ASSET_CATALOG),
  importAsset: (req) => invoke(IPC.ASSET_IMPORT, req),
  listProjectAssets: (projectPath) => invoke(IPC.ASSET_LIST_PROJECT, projectPath),
  getAssetPreview: (req) => invoke(IPC.ASSET_PREVIEW, req),
  getPackStatus: () => invoke(IPC.ASSET_PACK_STATUS),
  downloadAssetPack: () => invoke(IPC.ASSET_PACK_DOWNLOAD),
  generateAsset: (req) => invoke(IPC.ASSET_GENERATE, req),
  activateStylePack: (req) => invoke(IPC.STYLE_PACK_ACTIVATE, req),
  listAttribution: (projectPath) => invoke(IPC.ATTRIBUTION_LIST, projectPath),

  listMonetizationProducts: (projectPath) =>
    invoke(IPC.MONETIZATION_LIST, projectPath),
  createMonetizationProduct: (req) => invoke(IPC.MONETIZATION_CREATE, req),

  getSyncbackStatus: (projectPath) => invoke(IPC.SYNCBACK_STATUS, projectPath),
  resolveSyncbackConflict: (req) => invoke(IPC.SYNCBACK_RESOLVE, req),

  cloudSyncPush: (projectPath) => invoke(IPC.CLOUD_SYNC_PUSH, projectPath),
  cloudSyncPull: (projectPath) => invoke(IPC.CLOUD_SYNC_PULL, projectPath),
  communitySharePack: (projectPath) => invoke(IPC.COMMUNITY_SHARE, projectPath),
  getAppInfo: () => invoke(IPC.APP_INFO),
  checkForUpdates: () => invoke(IPC.UPDATE_CHECK),
  downloadAndInstallUpdate: () => invoke(IPC.UPDATE_DOWNLOAD_INSTALL),

  clipboardRead: () => invoke(IPC.CLIPBOARD_READ),
  clipboardWrite: (text) => invoke(IPC.CLIPBOARD_WRITE, text),

  gitStatus: (projectPath) => invoke(IPC.GIT_STATUS, projectPath),
  gitDiff: (req) => invoke(IPC.GIT_DIFF, req),
  gitStage: (req) => invoke(IPC.GIT_STAGE, req),
  gitUnstage: (req) => invoke(IPC.GIT_UNSTAGE, req),
  gitCommit: (req) => invoke(IPC.GIT_COMMIT, req),
  gitBranches: (projectPath) => invoke(IPC.GIT_BRANCHES, projectPath),
  gitCheckout: (req) => invoke(IPC.GIT_CHECKOUT, req),
  gitCreateBranch: (req) => invoke(IPC.GIT_CREATE_BRANCH, req),
  gitPull: (projectPath) => invoke(IPC.GIT_PULL, projectPath),
  gitPush: (projectPath) => invoke(IPC.GIT_PUSH, projectPath),
  gitDiscard: (req) => invoke(IPC.GIT_DISCARD, req),

  backupCreate: (req) => invoke(IPC.BACKUP_CREATE, req),
  backupList: (projectId) => invoke(IPC.BACKUP_LIST, projectId),
  backupRestore: (req) => invoke(IPC.BACKUP_RESTORE, req),

  resolveAssetChoice: (req) => invoke(IPC.ASSET_CHOICE_RESOLVE, req),
  cancelAssetChoice: (req) => invoke(IPC.ASSET_CHOICE_CANCEL, req),
  onAssetChoicePending: (cb) => subscribe(IPC.ASSET_CHOICE_PENDING, cb),
  onAppToast: (cb) => subscribe(IPC.APP_TOAST, cb),
  onOpenSettingsFocus: (cb) => subscribe(IPC.OPEN_SETTINGS_FOCUS, cb),
  getStudioLocksStatus: () => invoke(IPC.STUDIO_LOCKS_STATUS),
  onStudioLocksChanged: (cb) => subscribe(IPC.STUDIO_LOCKS_CHANGED, cb),
};

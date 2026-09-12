import { createRequire } from "node:module";
import { app } from "electron";
import type { AppUpdater } from "electron-updater";
import type { AppInfo, UpdateCheckResult } from "../shared/ipc-types.js";
import { compareSemver } from "../shared/semver.js";

const require = createRequire(import.meta.url);

let updaterConfigured = false;

function loadAutoUpdater(): AppUpdater {
  // electron-updater is CJS and exposes autoUpdater via a getter. Node ESM
  // named imports cannot see that export, so load it through createRequire.
  const electronUpdater = require("electron-updater") as {
    autoUpdater: AppUpdater;
  };
  return electronUpdater.autoUpdater;
}

function ensureUpdater(): AppUpdater | null {
  if (!app.isPackaged) {
    return null;
  }
  const autoUpdater = loadAutoUpdater();
  if (!updaterConfigured) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    updaterConfigured = true;
  }
  return autoUpdater;
}

function baseResult(
  partial: Omit<UpdateCheckResult, "packaged" | "currentVersion"> &
    Partial<Pick<UpdateCheckResult, "packaged" | "currentVersion">>,
): UpdateCheckResult {
  return {
    packaged: app.isPackaged,
    currentVersion: app.getVersion(),
    ...partial,
  };
}

export function getAppInfo(): AppInfo {
  return {
    version: app.getVersion(),
    packaged: app.isPackaged,
  };
}

/**
 * Query GitHub Releases. Does not download.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const updater = ensureUpdater();
    if (!updater) {
      return baseResult({
        available: false,
        detail: "Updates are checked in packaged installs, not in `pnpm dev`.",
      });
    }

    const result = await updater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    const available = Boolean(
      latestVersion && compareSemver(latestVersion, app.getVersion()) > 0,
    );

    if (!available) {
      return baseResult({
        available: false,
        latestVersion: latestVersion ?? app.getVersion(),
        detail: latestVersion
          ? `You're on the latest version (${app.getVersion()}).`
          : "No update available",
      });
    }

    return baseResult({
      available: true,
      latestVersion,
      detail: `Version ${latestVersion} is available (you have ${app.getVersion()}).`,
    });
  } catch (err) {
    return baseResult({
      available: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Download the pending update and restart into it.
 */
export async function downloadAndInstallUpdate(): Promise<UpdateCheckResult> {
  try {
    const updater = ensureUpdater();
    if (!updater) {
      return baseResult({
        available: false,
        detail: "Install updates from a packaged Blockforge build.",
      });
    }

    const check = await checkForUpdates();
    if (!check.available || !check.latestVersion) {
      return {
        ...check,
        detail: check.available
          ? check.detail
          : "No update to install.",
      };
    }

    await updater.downloadUpdate();
    updater.quitAndInstall(false, true);
    return baseResult({
      available: true,
      latestVersion: check.latestVersion,
      detail: `Installing ${check.latestVersion}…`,
    });
  } catch (err) {
    return baseResult({
      available: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");

test.describe("Blockforge desktop smoke", () => {
  test("IPC allowlist includes project + agent + asset + update channels", () => {
    const src = readFileSync(
      join(here, "../src/shared/ipc-channels.ts"),
      "utf8",
    );
    for (const token of [
      "PROJECT_LIST",
      "PTY_START",
      "PTY_LIST",
      "ASSET_GENERATE",
      "STYLE_PACK_ACTIVATE",
      "MONETIZATION_CREATE",
      "SYNCBACK_RESOLVE",
      "UPDATE_CHECK",
      "UPDATE_DOWNLOAD_INSTALL",
      "APP_INFO",
    ]) {
      expect(src).toContain(token);
    }
  });

  test("multi-agent adapters are registered", () => {
    const src = readFileSync(
      join(here, "../src/shared/agent-adapter.ts"),
      "utf8",
    );
    expect(src).toContain("CodexAdapter");
    expect(src).toContain("OpenCodeAdapter");
    expect(src).toContain("AntigravityAdapter");
    expect(src).toContain("wrapLaunchForWsl");
  });

  test("build resources include icon placeholder", () => {
    expect(existsSync(join(desktopRoot, "build", "icon.png"))).toBeTruthy();
  });

  test("packaged Electron launch smoke", async () => {
    const appPath = process.env.BLOCKFORGE_E2E_APP;
    test.skip(!appPath, "Set BLOCKFORGE_E2E_APP to run full Electron smoke");

    const { _electron: electron } = await import("@playwright/test");
    const electronApp = await electron.launch({
      executablePath: appPath,
    });
    try {
      const window = await electronApp.firstWindow({ timeout: 60_000 });
      const bodyCount = await window.locator("body").count();
      expect(bodyCount).toBeGreaterThan(0);
    } finally {
      await electronApp.close();
    }
  });
});

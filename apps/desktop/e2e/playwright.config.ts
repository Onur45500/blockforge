import { defineConfig } from "@playwright/test";

/**
 * Electron smoke e2e. Prefers a packaged binary when BLOCKFORGE_E2E_APP is set;
 * otherwise skips gracefully so CI unit jobs stay green without a full build.
 */
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    trace: "on-first-retry",
  },
});

import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@blockforge/open-cloud"] })],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  preload: {
    // Electron preload + contextBridge is most reliable as CJS.
    // With package.json "type":"module", default ESM (.mjs) often fails to expose APIs.
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
    },
  },
});


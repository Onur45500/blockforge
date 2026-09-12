import type { BlockforgeApi } from "../../shared/ipc-types";

export function getBlockforgeApi(): BlockforgeApi {
  const api = window.blockforge;
  if (!api) {
    throw new Error(
      "Blockforge API is unavailable (preload failed). Restart the app with `pnpm --filter @blockforge/desktop dev`.",
    );
  }
  return api;
}

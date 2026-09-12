/// <reference types="vite/client" />
/// <reference types="electron-vite/node" />

import type { BlockforgeApi } from "./shared/ipc-types";

declare global {
  interface Window {
    blockforge: BlockforgeApi;
  }
}

export {};

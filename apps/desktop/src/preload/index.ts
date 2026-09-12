import { contextBridge } from "electron";
import { blockforgeApi } from "./api";

try {
  contextBridge.exposeInMainWorld("blockforge", blockforgeApi);
} catch (error) {
  console.error("[blockforge] failed to expose API via contextBridge:", error);
}

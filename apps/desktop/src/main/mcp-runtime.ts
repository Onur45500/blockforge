import type { StudioMuxStatus } from "./studio-mcp-mux.js";

type MuxStatusGetter = () => StudioMuxStatus | null;

let muxStatusGetter: MuxStatusGetter | null = null;

/** Register the live mux getter from the HTTP gateway (avoids doctor→gateway cycles). */
export function registerStudioMuxStatusGetter(getter: MuxStatusGetter | null): void {
  muxStatusGetter = getter;
}

export function getStudioMuxStatus(): StudioMuxStatus | null {
  return muxStatusGetter?.() ?? null;
}

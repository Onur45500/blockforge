import type { RojoSyncStatus } from "../../shared/ipc-types";

export type SyncPillTone = "ok" | "warn" | "danger";

export type SyncPillState = {
  tone: SyncPillTone;
  text: string;
};

/** Detail line for the Sync inspector body (badge class matches existing .badge.*). */
export function studioSyncLabel(status: RojoSyncStatus): {
  text: string;
  badge: string;
} {
  switch (status.studioSyncStatus) {
    case "in-sync":
      return { text: "Studio: in sync", badge: "ok" };
    case "world-missing":
      return {
        text: `Studio: World missing — click Connect in the Rojo plugin (port ${status.port ?? "—"})`,
        badge: "missing",
      };
    case "stale":
      return {
        text: "Studio: stale — Rojo not connected or bridge idle",
        badge: "warning",
      };
    default:
      return { text: "Studio: waiting for bridge snapshot", badge: "warning" };
  }
}

/**
 * Header Sync pill: actionable, tone-mapped to `.status-pill-ok|-warn|-danger`.
 * Prefer creator time-to-Play: "Connect Rojo" over jargon when Studio is disconnected.
 */
export function syncPillState(
  status: RojoSyncStatus | null,
  lockLabel?: string | null,
): SyncPillState {
  if (!status) {
    return { tone: "warn", text: "Sync" };
  }

  const running = status.rojoServeRunning || status.rbxtscRunning;
  const lockSuffix = lockLabel ? ` · ${lockLabel}` : "";

  if (status.foreignRojoPort) {
    return {
      tone: "danger",
      text: `Port ${status.port ?? 34872} in use${lockSuffix}`,
    };
  }

  if (status.compilerStatus === "error" || (status.lastError && status.compilerStatus !== "ok")) {
    const ts = status.compilerStatus === "error" || status.lastError?.startsWith("TypeScript");
    return {
      tone: "danger",
      text: `${ts ? "TypeScript errors" : "Rojo error"}${lockSuffix}`,
    };
  }

  if (!running) {
    return { tone: "danger", text: `Rojo stopped${lockSuffix}` };
  }

  if (status.studioSyncStatus === "in-sync") {
    return { tone: "ok", text: `Studio in sync${lockSuffix}` };
  }

  if (status.studioSyncStatus === "world-missing") {
    return {
      tone: "warn",
      text: `Connect Rojo plugin · port ${status.port ?? "—"}${lockSuffix}`,
    };
  }

  if (status.studioSyncStatus === "stale") {
    return {
      tone: "warn",
      text: `Studio stale · port ${status.port ?? "—"}${lockSuffix}`,
    };
  }

  return {
    tone: "warn",
    text: `Connect Rojo plugin · port ${status.port ?? "—"}${lockSuffix}`,
  };
}

/** Human TypeScript watch headline (ANSI already stripped). */
export function compilerHeadline(
  compilerStatus: RojoSyncStatus["compilerStatus"],
  compilerLog: string | null,
): string {
  if (!compilerLog) {
    if (compilerStatus === "ok") {
      return "0 errors · watching";
    }
    if (compilerStatus === "error") {
      return "Compile failed";
    }
    return "Waiting for first compile…";
  }

  const time = compilerLog.match(/\[(\d{1,2}:\d{2}:\d{2})\]/);
  const found = compilerLog.match(/Found\s+(\d+)\s+errors?/i);
  if (found?.[1] !== undefined) {
    const count = found[1];
    const suffix = time?.[1] ? ` · ${time[1]}` : "";
    if (count === "0") {
      return `0 errors · watching${suffix}`;
    }
    return `${count} error${count === "1" ? "" : "s"} · watching${suffix}`;
  }

  return compilerLog;
}

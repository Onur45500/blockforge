import {
  DEFAULT_WORKSPACE_LAYOUT,
  normalizeOpenDocks,
  type DockId,
  type WorkspaceLayoutState,
} from "./workspace-types";

function storageKey(projectId: string): string {
  return `blockforge.ui-layout.${projectId}`;
}

function isDockId(value: unknown): value is DockId {
  return (
    value === "sync" ||
    value === "assets" ||
    value === "publish" ||
    value === "monetization" ||
    value === "credits" ||
    value === "agents" ||
    value === "git" ||
    value === "terminal"
  );
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

export function clampPanelSizes(
  sizes: WorkspaceLayoutState["panelSizes"],
): WorkspaceLayoutState["panelSizes"] {
  const d = DEFAULT_WORKSPACE_LAYOUT.panelSizes;
  return {
    left: clamp(sizes.left, 12, 46, d.left),
    center: clamp(sizes.center, 36, 100, d.center),
    right: clamp(sizes.right, 18, 40, d.right),
    main: clamp(sizes.main, 55, 100, d.main),
    bottom: clamp(sizes.bottom, 12, 50, d.bottom),
  };
}

export function loadWorkspaceLayout(projectId: string): WorkspaceLayoutState {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) {
      return {
        ...DEFAULT_WORKSPACE_LAYOUT,
        openDocks: [],
        dockSides: { ...DEFAULT_WORKSPACE_LAYOUT.dockSides },
      };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_WORKSPACE_LAYOUT };
    }
    const obj = parsed as Record<string, unknown>;
    const openDocks = normalizeOpenDocks(
      Array.isArray(obj.openDocks) ? obj.openDocks.filter(isDockId) : [],
    );
    const panelSizes = clampPanelSizes(
      typeof obj.panelSizes === "object" && obj.panelSizes !== null
        ? { ...DEFAULT_WORKSPACE_LAYOUT.panelSizes, ...(obj.panelSizes as object) }
        : DEFAULT_WORKSPACE_LAYOUT.panelSizes,
    );
    return {
      version: 2,
      openDocks,
      dockSides: {
        ...DEFAULT_WORKSPACE_LAYOUT.dockSides,
        ...(typeof obj.dockSides === "object" && obj.dockSides !== null
          ? (obj.dockSides as WorkspaceLayoutState["dockSides"])
          : {}),
      },
      panelSizes: panelSizes as WorkspaceLayoutState["panelSizes"],
      quietMode: obj.quietMode === true,
      splitView: obj.splitView === true,
      leadSessionId: typeof obj.leadSessionId === "string" ? obj.leadSessionId : null,
      activeSessionId:
        typeof obj.activeSessionId === "string" ? obj.activeSessionId : null,
      mountedSessionIds: Array.isArray(obj.mountedSessionIds)
        ? obj.mountedSessionIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_LAYOUT };
  }
}

export function saveWorkspaceLayout(
  projectId: string,
  layout: WorkspaceLayoutState,
): void {
  try {
    localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({
        ...layout,
        version: 2,
        openDocks: normalizeOpenDocks(layout.openDocks),
        panelSizes: clampPanelSizes(layout.panelSizes),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

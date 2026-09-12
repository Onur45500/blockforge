export type DockId =
  | "sync"
  | "assets"
  | "publish"
  | "monetization"
  | "credits"
  | "agents"
  | "git"
  | "terminal";

export type DockSide = "left" | "right" | "bottom";

/** Tool panels share one side slot — only one may be open at a time. */
export const TOOL_DOCK_IDS: readonly DockId[] = [
  "sync",
  "assets",
  "publish",
  "monetization",
  "credits",
  "git",
] as const;

export const BOTTOM_DOCK_IDS: readonly DockId[] = ["agents", "terminal"] as const;

export function isBottomDock(id: DockId): boolean {
  return id === "agents" || id === "terminal";
}

export function isToolDock(id: DockId): boolean {
  return !isBottomDock(id);
}

/**
 * Bottom docks (Agents + Terminal) may stay open together.
 * Tool panels share one inspector — only one may be open at a time.
 */
export function normalizeOpenDocks(openDocks: DockId[]): DockId[] {
  const seenBottom = new Set<DockId>();
  const bottom: DockId[] = [];
  for (const id of openDocks) {
    if (!isBottomDock(id) || seenBottom.has(id)) {
      continue;
    }
    seenBottom.add(id);
    bottom.push(id);
  }
  const tools = openDocks.filter(isToolDock);
  const activeTool = tools.length > 0 ? ([tools[tools.length - 1]!] as DockId[]) : [];
  return [...bottom, ...activeTool];
}

export type WorkspaceLayoutState = {
  version: 2;
  openDocks: DockId[];
  dockSides: Partial<Record<DockId, DockSide>>;
  panelSizes: {
    left: number;
    center: number;
    right: number;
    main: number;
    bottom: number;
  };
  quietMode: boolean;
  splitView: boolean;
  leadSessionId: string | null;
  activeSessionId: string | null;
  mountedSessionIds: string[];
};

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  version: 2,
  openDocks: [],
  dockSides: {
    // All tools share the right inspector; Agents stays bottom.
    sync: "right",
    assets: "right",
    publish: "right",
    monetization: "right",
    credits: "right",
    agents: "bottom",
    git: "right",
    terminal: "bottom",
  },
  panelSizes: {
    left: 22,
    center: 70,
    right: 30,
    main: 72,
    bottom: 28,
  },
  quietMode: false,
  splitView: false,
  leadSessionId: null,
  activeSessionId: null,
  mountedSessionIds: [],
};

export const DOCK_LABELS: Record<DockId, string> = {
  sync: "Sync",
  assets: "Assets",
  publish: "Publish",
  monetization: "Monetization",
  credits: "Credits",
  agents: "Agents",
  git: "Git",
  terminal: "CMD",
};

export const ADAPTER_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  antigravity: "Antigravity",
};

export function adapterSupportsResume(adapterId: string): boolean {
  return adapterId !== "antigravity";
}

export function sideFor(id: DockId): DockSide {
  if (isBottomDock(id)) return "bottom";
  return "right";
}

const ADAPTER_NAME_SET = new Set([
  ...Object.keys(ADAPTER_LABELS),
  ...Object.values(ADAPTER_LABELS),
]);

export function isLeadLabel(label: string | null | undefined): boolean {
  return label === "Lead" || label === "lead";
}

export function isGenericTerminalLabel(label: string | null | undefined): boolean {
  if (!label) {
    return true;
  }
  const lower = label.toLowerCase();
  if (lower === "scratch" || lower.startsWith("scratch-") || lower === "extra") {
    return true;
  }
  return ADAPTER_NAME_SET.has(label);
}

export function humanizeTerminalRole(label: string): string {
  return label
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Creator-facing window/tab title. Internal PTY labels stay Lead / scratch. */
export function terminalTitle(options: {
  label: string | null | undefined;
  isLead: boolean;
  extraNumber?: number;
}): string {
  if (options.isLead || isLeadLabel(options.label)) {
    return "Main agent";
  }
  if (isGenericTerminalLabel(options.label)) {
    const n = options.extraNumber ?? 1;
    return n <= 1 ? "Extra agent" : `Extra agent ${n}`;
  }
  return humanizeTerminalRole(options.label ?? "Agent");
}

export function nextUiTerminalLabel(options: {
  hasLead: boolean;
  existingLabels: string[];
}): string {
  if (!options.hasLead) {
    return "Lead";
  }
  let max = 0;
  for (const label of options.existingLabels) {
    const lower = label.toLowerCase();
    if (lower === "scratch") {
      max = Math.max(max, 1);
      continue;
    }
    const match = /^scratch-(\d+)$/i.exec(label);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  const next = max + 1;
  return next <= 1 ? "scratch" : `scratch-${next}`;
}

export function nextShellLabel(existingLabels: string[]): string {
  const used = new Set(existingLabels.map((label) => label.trim().toLowerCase()));
  if (!used.has("cmd")) {
    return "cmd";
  }
  let n = 2;
  while (used.has(`cmd ${n}`)) {
    n += 1;
  }
  return `cmd ${n}`;
}

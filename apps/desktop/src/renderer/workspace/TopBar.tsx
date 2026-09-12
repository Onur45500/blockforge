import { useEffect, useRef, useState } from "react";
import { DOCK_LABELS, type DockId } from "./workspace-types";
import type { SyncPillTone } from "./sync-label";

const ALL_TOOL_ITEMS: DockId[] = [
  "sync",
  "git",
  "assets",
  "publish",
  "monetization",
  "credits",
];

const WIDE_TOOLS: DockId[] = ALL_TOOL_ITEMS;
const COMPACT_TOOLS: DockId[] = ["sync", "git", "assets", "publish"];
const TIGHT_TOOLS: DockId[] = ["sync", "git"];

type TopBarProps = {
  brand?: string;
  appVersion?: string;
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  quietMode: boolean;
  splitView: boolean;
  openDocks: DockId[];
  doctorOpen?: boolean;
  settingsOpen?: boolean;
  onSwitchProject: (id: string) => void;
  onCloseProject: () => void;
  onOpenHome: () => void;
  onToggleQuiet: () => void;
  onToggleSplit: () => void;
  onOpenPalette: () => void;
  onToggleDock: (id: DockId) => void;
  onOpenDoctor: () => void;
  onOpenSettings: () => void;
  syncLabel?: string;
  syncTone?: SyncPillTone;
  onOpenSync?: () => void;
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (): void => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function ToolButton({
  id,
  quietMode,
  openDocks,
  onToggleDock,
}: {
  id: DockId;
  quietMode: boolean;
  openDocks: DockId[];
  onToggleDock: (id: DockId) => void;
}) {
  const active = !quietMode && openDocks.includes(id);
  return (
    <button
      type="button"
      className={`ws-tool-btn${active ? " active" : ""}`}
      title={
        active
          ? `Close ${DOCK_LABELS[id]}`
          : `Open ${DOCK_LABELS[id]} (replaces other inspector)`
      }
      aria-pressed={active}
      onClick={() => onToggleDock(id)}
    >
      {DOCK_LABELS[id]}
    </button>
  );
}

export function TopBar({
  brand = "Blockforge",
  appVersion,
  projects,
  activeProjectId,
  quietMode,
  splitView,
  openDocks,
  doctorOpen,
  settingsOpen,
  onSwitchProject,
  onCloseProject,
  onOpenHome,
  onToggleQuiet,
  onToggleSplit,
  onOpenPalette,
  onToggleDock,
  onOpenDoctor,
  onOpenSettings,
  syncLabel,
  syncTone = "warn",
  onOpenSync,
}: TopBarProps) {
  const agentsActive = !quietMode && openDocks.includes("agents");
  const terminalActive = !quietMode && openDocks.includes("terminal");
  const compact = useMediaQuery("(max-width: 1180px)");
  const tight = useMediaQuery("(max-width: 1040px)");
  const moreRef = useRef<HTMLDetailsElement | null>(null);

  const primaryTools = tight ? TIGHT_TOOLS : compact ? COMPACT_TOOLS : WIDE_TOOLS;
  const overflowTools = ALL_TOOL_ITEMS.filter((id) => !primaryTools.includes(id));
  const overlaysInMore = compact;
  const showMore = overflowTools.length > 0 || overlaysInMore;

  const moreActive =
    overflowTools.some((id) => !quietMode && openDocks.includes(id)) ||
    (overlaysInMore && Boolean(doctorOpen || settingsOpen));

  const closeMore = (): void => {
    moreRef.current?.removeAttribute("open");
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const el = moreRef.current;
      if (!el?.open) {
        return;
      }
      if (event.target instanceof Node && el.contains(event.target)) {
        return;
      }
      closeMore();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && moreRef.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        closeMore();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return (
    <header className="ws-topbar">
      <div className="ws-topbar-left">
        <button type="button" className="ws-brand" onClick={onOpenHome}>
          {brand}
          {appVersion ? <span className="ws-brand-version">v{appVersion}</span> : null}
        </button>
        <span className="ws-topbar-sep" aria-hidden />
        <label className="ws-project-switcher">
          <span className="sr-only">Project</span>
          <select
            value={activeProjectId}
            onChange={(e) => onSwitchProject(e.target.value)}
            aria-label="Switch project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="ws-topbar-tools" aria-label="Workspace tools">
        <button
          type="button"
          className={`ws-tool-btn${agentsActive ? " active" : ""}`}
          title="Agents help (bottom)"
          aria-pressed={agentsActive}
          onClick={() => onToggleDock("agents")}
        >
          Agents
        </button>
        <button
          type="button"
          className={`ws-tool-btn${terminalActive ? " active" : ""}`}
          title="CMD (bottom) — Ctrl+`"
          aria-pressed={terminalActive}
          onClick={() => onToggleDock("terminal")}
        >
          CMD
        </button>
        <span className="ws-topbar-sep" aria-hidden />
        <div className="ws-tool-group" role="group" aria-label="Inspector">
          {primaryTools.map((id) => (
            <ToolButton
              key={id}
              id={id}
              quietMode={quietMode}
              openDocks={openDocks}
              onToggleDock={onToggleDock}
            />
          ))}
        </div>
        {showMore ? (
          <details ref={moreRef} className="ws-more-menu">
            <summary
              className={`ws-tool-btn${moreActive ? " active" : ""}`}
              title="More tools"
            >
              More
            </summary>
            <div className="ws-more-panel" role="menu">
              {overflowTools.map((id) => (
                <ToolButton
                  key={id}
                  id={id}
                  quietMode={quietMode}
                  openDocks={openDocks}
                  onToggleDock={(dockId) => {
                    closeMore();
                    onToggleDock(dockId);
                  }}
                />
              ))}
              {overlaysInMore ? (
                <>
                  <button
                    type="button"
                    className={`ws-tool-btn${doctorOpen ? " active" : ""}`}
                    title="Doctor"
                    aria-pressed={Boolean(doctorOpen)}
                    onClick={() => {
                      closeMore();
                      onOpenDoctor();
                    }}
                  >
                    Doctor
                  </button>
                  <button
                    type="button"
                    className={`ws-tool-btn${settingsOpen ? " active" : ""}`}
                    title="Settings"
                    aria-pressed={Boolean(settingsOpen)}
                    onClick={() => {
                      closeMore();
                      onOpenSettings();
                    }}
                  >
                    Settings
                  </button>
                </>
              ) : null}
            </div>
          </details>
        ) : null}
        {!overlaysInMore ? (
          <>
            <span className="ws-topbar-sep" aria-hidden />
            <button
              type="button"
              className={`ws-tool-btn${doctorOpen ? " active" : ""}`}
              title="Doctor"
              aria-pressed={Boolean(doctorOpen)}
              onClick={onOpenDoctor}
            >
              Doctor
            </button>
            <button
              type="button"
              className={`ws-tool-btn${settingsOpen ? " active" : ""}`}
              title="Settings"
              aria-pressed={Boolean(settingsOpen)}
              onClick={onOpenSettings}
            >
              Settings
            </button>
          </>
        ) : null}
      </nav>

      <div className="ws-topbar-right">
        {syncLabel ? (
          <button
            type="button"
            className={`status-pill status-pill-${syncTone} status-pill-interactive`}
            title={syncLabel}
            onClick={onOpenSync}
          >
            {syncLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="btn ghost"
          onClick={onOpenPalette}
          aria-label="Command palette"
          title="Command palette"
        >
          ⌘K
        </button>
        <span className="ws-topbar-sep" aria-hidden />
        <div className="ws-view-toggles" role="group" aria-label="View">
          <button
            type="button"
            className={`btn ghost${splitView ? " active" : ""}`}
            onClick={onToggleSplit}
            aria-pressed={splitView}
            title={
              splitView
                ? "Split on — lead and worker side by side"
                : "Split — show lead and worker side by side"
            }
          >
            Split
          </button>
          <button
            type="button"
            className={`btn ghost${quietMode ? " active" : ""}`}
            onClick={onToggleQuiet}
            aria-pressed={quietMode}
            title={
              quietMode
                ? "Quiet on — tools hidden, terminals only"
                : "Quiet — hide tools, terminals only"
            }
          >
            Quiet
          </button>
        </div>
        <span className="ws-topbar-sep" aria-hidden />
        <button
          type="button"
          className="btn ghost"
          onClick={onCloseProject}
          aria-label="Close project"
          title="Close project"
        >
          Close project
        </button>
      </div>
    </header>
  );
}

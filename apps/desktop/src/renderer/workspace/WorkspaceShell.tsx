import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentId,
  OpenProjectState,
  OpenProjectsSnapshot,
  RojoSyncStatus,
} from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import { AssetGrid } from "../components/AssetGrid";
import { PublishPanel } from "../components/PublishPanel";
import { MonetizationPanel } from "../components/MonetizationPanel";
import { CreditsPanel } from "../components/CreditsPanel";
import { SyncStatus } from "../components/SyncStatus";
import { DoctorPage } from "../pages/DoctorPage";
import { SettingsPage } from "../pages/SettingsPage";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { DockHost } from "./DockHost";
import { DoctorOverlay } from "./DoctorOverlay";
import { SettingsDrawer } from "./SettingsDrawer";
import { TerminalWorkspace } from "./TerminalWorkspace";
import { TopBar } from "./TopBar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import { GitPanel } from "./GitPanel";
import { AssetChoiceOverlay } from "./AssetChoiceOverlay";
import { NoticeCard } from "../components/NoticeCard";
import { SWARM_STARTER } from "../components/SwarmModeBanner";
import { TerminalMonitor } from "./TerminalMonitor";
import { ShellTerminalPanel } from "./ShellTerminalPanel";
import {
  isToolDock,
  sideFor,
  type DockId,
} from "./workspace-types";
import { syncPillState } from "./sync-label";

type WorkspaceShellProps = {
  openProject: NonNullable<OpenProjectState>;
  openSnapshot: OpenProjectsSnapshot;
  appVersion?: string;
  onOpenProjectChange: (state: OpenProjectState) => void;
  onSwitchProject: (id: string) => Promise<void>;
  onCloseProject: () => Promise<void>;
  onOpenHome: () => void;
};

export function WorkspaceShell({
  openProject,
  openSnapshot,
  appVersion,
  onOpenProjectChange,
  onSwitchProject,
  onCloseProject,
  onOpenHome,
}: WorkspaceShellProps) {
  const projectId = openProject.project.id;
  const projectPath = openProject.project.path;
  const {
    layout,
    toggleDock,
    openDock,
    closeDock,
    setQuietMode,
    setSplitView,
    setActiveSessionId,
    setLeadSessionId,
    ensureMounted,
    unmountSession,
    setPanelSizes,
  } = useWorkspaceLayout(projectId);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<
    "open_cloud" | "asset_upload" | null
  >(null);
  const [rojo, setRojo] = useState<RojoSyncStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lockLabel, setLockLabel] = useState<string | null>(null);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);

  useEffect(() => {
    void getBlockforgeApi()
      .getRojoStatus()
      .then(setRojo)
      .catch(() => setRojo(null));
    return getBlockforgeApi().onRojoStatusChanged(setRojo);
  }, []);

  useEffect(() => {
    const unsubToast = getBlockforgeApi().onAppToast(({ title, body }) => {
      setToast(`${title}: ${body}`);
      window.setTimeout(() => setToast(null), 4000);
    });
    const unsubSettings = getBlockforgeApi().onOpenSettingsFocus(({ kind }) => {
      setSettingsFocus(kind);
      setSettingsOpen(true);
    });
    const unsubLocks = getBlockforgeApi().onStudioLocksChanged((status) => {
      if (status.playtestHolderSessionId) {
        setLockLabel("Playtest busy");
      } else if (status.studioHolderSessionId) {
        setLockLabel("Studio locked");
      } else {
        setLockLabel(null);
      }
    });
    void getBlockforgeApi()
      .getStudioLocksStatus()
      .then((status) => {
        if (status.playtestHolderSessionId) setLockLabel("Playtest busy");
        else if (status.studioHolderSessionId) setLockLabel("Studio locked");
      })
      .catch(() => undefined);
    return () => {
      unsubToast();
      unsubSettings();
      unsubLocks();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (doctorOpen) {
        setDoctorOpen(false);
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        setSettingsFocus(null);
        return;
      }
      if (paletteOpen) return;
      const tool = layout.openDocks.filter(isToolDock).at(-1);
      if (tool) {
        closeDock(tool);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDock, doctorOpen, layout.openDocks, paletteOpen, settingsOpen]);

  const syncPill = syncPillState(rojo, lockLabel);
  const syncLabel = syncPill.text;
  const syncTone = syncPill.tone;

  const [defaultAgentId, setDefaultAgentId] = useState<AgentId>("claude-code");

  useEffect(() => {
    void getBlockforgeApi()
      .getSettings()
      .then((s) => setDefaultAgentId(s.defaultAgentId ?? "claude-code"))
      .catch(() => undefined);
  }, []);

  const spawnNewTerminal = useCallback(() => {
    void getBlockforgeApi().ptyStart({
      projectPath,
      cols: 120,
      rows: 32,
      adapterId: defaultAgentId,
      label: "scratch",
      source: "ui",
      focus: true,
      resume: false,
    });
  }, [projectPath, defaultAgentId]);

  const shortcutHandlers = useMemo(
    () => ({
      onTogglePalette: () => setPaletteOpen((v) => !v),
      onToggleDock: (id: DockId) => toggleDock(id),
      onNewTerminal: spawnNewTerminal,
      onFocusLead: () => {
        if (layout.leadSessionId) {
          setActiveSessionId(layout.leadSessionId);
        }
      },
      onToggleQuiet: () => setQuietMode(!layout.quietMode),
      onToggleSplit: () => setSplitView(!layout.splitView),
      onOpenDoctor: () => setDoctorOpen(true),
      onOpenSettings: () => setSettingsOpen(true),
    }),
    [
      toggleDock,
      spawnNewTerminal,
      layout.leadSessionId,
      layout.quietMode,
      layout.splitView,
      setActiveSessionId,
      setQuietMode,
      setSplitView,
    ],
  );

  useKeyboardShortcuts(shortcutHandlers);

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      {
        id: "new-terminal",
        label: "New terminal",
        hint: "Ctrl+Shift+T",
        run: spawnNewTerminal,
      },
      {
        id: "toggle-sync",
        label: "Toggle Sync panel",
        run: () => toggleDock("sync"),
      },
      {
        id: "open-assets",
        label: "Open Assets",
        run: () => openDock("assets"),
      },
      {
        id: "open-publish",
        label: "Open Publish",
        run: () => openDock("publish"),
      },
      {
        id: "open-monetization",
        label: "Open Monetization",
        run: () => openDock("monetization"),
      },
      {
        id: "open-credits",
        label: "Open Credits",
        run: () => openDock("credits"),
      },
      {
        id: "open-agents",
        label: "Open Agents",
        run: () => openDock("agents"),
      },
      {
        id: "toggle-terminal",
        label: "Toggle CMD",
        hint: "Ctrl+`",
        run: () => toggleDock("terminal"),
      },
      {
        id: "open-git",
        label: "Open Git",
        run: () => openDock("git"),
      },
      {
        id: "backup",
        label: "Backup project now",
        run: () => {
          void getBlockforgeApi()
            .backupCreate({
              projectId,
              projectPath,
              projectName: openProject.project.name,
            })
            .then((info) => setToast(`Backup saved: ${info.fileName}`));
        },
      },
      {
        id: "swarm-starter",
        label: "Copy swarm starter prompt",
        run: () => {
          void getBlockforgeApi().clipboardWrite(SWARM_STARTER).then(() => {
            setToast("Swarm starter copied to clipboard");
            window.setTimeout(() => setToast(null), 3000);
          });
        },
      },
      {
        id: "quiet",
        label: layout.quietMode ? "Exit Quiet mode" : "Quiet mode",
        hint: "Ctrl+Shift+B",
        run: () => setQuietMode(!layout.quietMode),
      },
      {
        id: "split",
        label: layout.splitView ? "Exit split view" : "Split lead | worker",
        run: () => setSplitView(!layout.splitView),
      },
      {
        id: "doctor",
        label: "Doctor",
        hint: "Ctrl+Shift+D",
        run: () => setDoctorOpen(true),
      },
      {
        id: "settings",
        label: "Settings",
        hint: "Ctrl+,",
        run: () => setSettingsOpen(true),
      },
      {
        id: "home",
        label: "Go to Home",
        run: onOpenHome,
      },
      ...openSnapshot.projects.map((p) => ({
        id: `switch-${p.project.id}`,
        label: `Switch to ${p.project.name}`,
        run: () => {
          void onSwitchProject(p.project.id);
        },
      })),
    ],
    [
      spawnNewTerminal,
      toggleDock,
      openDock,
      layout.quietMode,
      layout.splitView,
      setQuietMode,
      setSplitView,
      onOpenHome,
      openSnapshot.projects,
      onSwitchProject,
      projectId,
      projectPath,
      openProject.project.name,
    ],
  );

  const dockNode = (id: DockId) => {
    switch (id) {
      case "sync":
        return (
          <SyncStatus
            onOpenProjectChange={onOpenProjectChange}
            projectPath={projectPath}
          />
        );
      case "assets":
        return <AssetGrid projectPath={projectPath} />;
      case "publish":
        return (
          <PublishPanel
            projectPath={projectPath}
            onOpenSettings={() => {
              setSettingsFocus("open_cloud");
              setSettingsOpen(true);
            }}
          />
        );
      case "monetization":
        return <MonetizationPanel projectPath={projectPath} />;
      case "credits":
        return <CreditsPanel projectPath={projectPath} />;
      case "agents":
        return (
          <TerminalMonitor
            projectPath={projectPath}
            leadSessionId={layout.leadSessionId}
            activeSessionId={layout.activeSessionId}
            onFocusSession={setActiveSessionId}
          />
        );
      case "terminal":
        return <ShellTerminalPanel projectPath={projectPath} />;
      case "git":
        return <GitPanel projectPath={projectPath} />;
      default:
        return null;
    }
  };

  const leftContent = layout.openDocks
    .filter((id) => sideFor(id) === "left")
    .map((id) => ({ id, node: dockNode(id) }));
  const rightContent = layout.openDocks
    .filter((id) => sideFor(id) === "right")
    .map((id) => ({ id, node: dockNode(id) }));
  const bottomContent = layout.openDocks
    .filter((id) => sideFor(id) === "bottom")
    .map((id) => ({ id, node: dockNode(id) }));

  const activeOn = (items: Array<{ id: DockId }>): DockId | null => {
    const tool = items.map((i) => i.id).filter(isToolDock).at(-1);
    if (tool) return tool;
    return items.at(-1)?.id ?? null;
  };

  const upgrade = openProject.templateUpgrade;

  return (
    <div className="ws-shell">
      <TopBar
        projects={openSnapshot.projects.map((p) => ({
          id: p.project.id,
          name: p.project.name,
        }))}
        appVersion={appVersion}
        activeProjectId={openSnapshot.activeProjectId ?? projectId}
        quietMode={layout.quietMode}
        splitView={layout.splitView}
        openDocks={layout.openDocks}
        doctorOpen={doctorOpen}
        settingsOpen={settingsOpen}
        onSwitchProject={(id) => void onSwitchProject(id)}
        onCloseProject={() => void onCloseProject()}
        onOpenHome={onOpenHome}
        onToggleQuiet={() => setQuietMode(!layout.quietMode)}
        onToggleSplit={() => setSplitView(!layout.splitView)}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleDock={toggleDock}
        onOpenDoctor={() => setDoctorOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        syncLabel={syncLabel}
        syncTone={syncTone}
        onOpenSync={() => openDock("sync")}
      />

      <div className="ws-body">
        <div className="ws-main">
          {upgrade?.upgraded && !upgradeDismissed ? (
            <NoticeCard
              title="Template upgraded"
              onDismiss={() => setUpgradeDismissed(true)}
              className="ws-inline-notice"
            >
              {upgrade.from} → {upgrade.to}
              {upgrade.skipped.length > 0
                ? ` · skipped ${upgrade.skipped.join(", ")}`
                : ""}
            </NoticeCard>
          ) : null}

          <DockHost
            layout={layout}
            leftContent={leftContent}
            rightContent={rightContent}
            bottomContent={bottomContent}
            activeLeftId={activeOn(leftContent)}
            activeRightId={activeOn(rightContent)}
            activeBottomId={activeOn(bottomContent)}
            onSelectDock={openDock}
            onCloseDock={closeDock}
            onLayoutChange={setPanelSizes}
            center={
              <TerminalWorkspace
                projectPath={projectPath}
                leadSessionId={layout.leadSessionId}
                activeSessionId={layout.activeSessionId}
                mountedSessionIds={layout.mountedSessionIds}
                splitView={layout.splitView}
                onLeadSessionId={setLeadSessionId}
                onActiveSessionId={setActiveSessionId}
                onEnsureMounted={ensureMounted}
                onUnmountSession={unmountSession}
              />
            }
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        actions={paletteActions}
        onClose={() => setPaletteOpen(false)}
      />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsFocus(null);
        }}
      >
        <SettingsPage focusSection={settingsFocus} />
      </SettingsDrawer>
      <DoctorOverlay open={doctorOpen} onClose={() => setDoctorOpen(false)}>
        <DoctorPage />
      </DoctorOverlay>
      <AssetChoiceOverlay />
      {toast ? (
        <div className="ws-toast" role="status">
          <span className="ws-toast-message">{toast}</span>
          <button
            type="button"
            className="ws-close-btn notice-close"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

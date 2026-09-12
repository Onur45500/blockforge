import { useCallback, useEffect, useState } from "react";
import type {
  AppInfo,
  OpenProjectState,
  OpenProjectsSnapshot,
  UpdateCheckResult,
} from "../shared/ipc-types";
import { getBlockforgeApi } from "./lib/api";
import { UpdateBanner } from "./components/UpdateBanner";
import { HomePage } from "./pages/HomePage";
import { WorkspaceShell } from "./workspace/WorkspaceShell";

export function App() {
  const [openProject, setOpenProject] = useState<OpenProjectState>(null);
  const [openSnapshot, setOpenSnapshot] = useState<OpenProjectsSnapshot>({
    activeProjectId: null,
    projects: [],
  });
  const [bootError, setBootError] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [updating, setUpdating] = useState(false);

  const refreshOpenProject = useCallback(async () => {
    const [current, snapshot] = await Promise.all([
      getBlockforgeApi().getOpenProject(),
      getBlockforgeApi().listOpenProjects(),
    ]);
    setOpenProject(current);
    setOpenSnapshot(snapshot);
    if (current) {
      setShowHome(false);
    }
  }, []);

  useEffect(() => {
    void refreshOpenProject().catch((err) => {
      setBootError(err instanceof Error ? err.message : String(err));
    });
  }, [refreshOpenProject]);

  useEffect(() => {
    try {
      const api = getBlockforgeApi();
      void api.getAppInfo().then(setAppInfo).catch(() => {
        setAppInfo(null);
      });
      void api.checkForUpdates().then(setUpdate).catch(() => {
        setUpdate(null);
      });
    } catch {
      setAppInfo(null);
    }
  }, []);

  const handleOpenProject = async (id: string): Promise<void> => {
    const opened = await getBlockforgeApi().openProject(id);
    setOpenProject(opened);
    setOpenSnapshot(await getBlockforgeApi().listOpenProjects());
    setShowHome(false);
  };

  const handleSwitchProject = async (id: string): Promise<void> => {
    const opened = await getBlockforgeApi().switchProject(id);
    setOpenProject(opened);
    setOpenSnapshot(await getBlockforgeApi().listOpenProjects());
    setShowHome(false);
  };

  const handleCloseProject = async (): Promise<void> => {
    await getBlockforgeApi().closeProject();
    await refreshOpenProject();
    const snapshot = await getBlockforgeApi().listOpenProjects();
    if (!snapshot.activeProjectId) {
      setShowHome(true);
    }
  };

  const handleUpdate = async (): Promise<void> => {
    setUpdating(true);
    try {
      const result = await getBlockforgeApi().downloadAndInstallUpdate();
      setUpdate(result);
    } finally {
      setUpdating(false);
    }
  };

  if (bootError) {
    return (
      <div className="app-shell home-shell">
        <main className="content home-content">
          <div className="card">
            <h1 className="page-title">Preload failed</h1>
            <p className="error-text">{bootError}</p>
            <p className="muted">
              Restart with <code>pnpm --filter @blockforge/desktop dev</code> after the
              preload path fix.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const workspaceMounted = Boolean(openProject);
  const showWorkspace = workspaceMounted && !showHome;
  const versionLabel = appInfo ? `v${appInfo.version}` : null;

  return (
    <div className={`app-shell${showWorkspace ? " workspace-mode" : " home-shell"}`}>
      <UpdateBanner result={update} busy={updating} onUpdate={() => void handleUpdate()} />
      {workspaceMounted && openProject ? (
        <div className={showWorkspace ? "ws-root" : "ws-root tab-panel-hidden"}>
          <WorkspaceShell
            openProject={openProject}
            openSnapshot={openSnapshot}
            appVersion={appInfo?.version}
            onOpenProjectChange={setOpenProject}
            onSwitchProject={handleSwitchProject}
            onCloseProject={handleCloseProject}
            onOpenHome={() => setShowHome(true)}
          />
        </div>
      ) : null}
      {!showWorkspace ? (
        <main className="content home-content">
          <header className="home-header">
            <div>
              <div className="ws-brand home-brand">Blockforge</div>
              {versionLabel ? (
                <p className="muted home-version">{versionLabel}</p>
              ) : null}
            </div>
            <div className="home-header-actions">
              {openProject ? (
                <button
                  type="button"
                  className="btn secondary compact"
                  onClick={() => setShowHome(false)}
                >
                  Back to workspace
                </button>
              ) : null}
            </div>
          </header>
          <HomePage onOpenProject={handleOpenProject} />
        </main>
      ) : null}
    </div>
  );
}

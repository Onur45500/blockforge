import { useEffect, useState } from "react";
import type {
  OpenProjectState,
  RojoSyncStatus,
  SyncbackStatus,
} from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import { compilerHeadline, studioSyncLabel } from "../workspace/sync-label";

type SyncStatusProps = {
  onOpenProjectChange?: (state: OpenProjectState) => void;
  projectPath?: string;
};

export function SyncStatus({ onOpenProjectChange, projectPath }: SyncStatusProps) {
  const [status, setStatus] = useState<RojoSyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncback, setSyncback] = useState<SyncbackStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = await getBlockforgeApi().getRojoStatus();
      if (!cancelled) {
        setStatus(initial);
      }
    })();

    const unsub = getBlockforgeApi().onRojoStatusChanged((next: RojoSyncStatus) => {
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!projectPath) {
      return;
    }
    void (async () => {
      try {
        setSyncback(await getBlockforgeApi().getSyncbackStatus(projectPath));
      } catch {
        setSyncback(null);
      }
    })();
  }, [projectPath]);

  const applyState = (state: OpenProjectState): void => {
    onOpenProjectChange?.(state);
  };

  const handleStop = async (): Promise<void> => {
    setBusy(true);
    try {
      applyState(await getBlockforgeApi().stopRojo());
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async (): Promise<void> => {
    setBusy(true);
    try {
      applyState(await getBlockforgeApi().startRojo());
    } finally {
      setBusy(false);
    }
  };

  const handleRestart = async (): Promise<void> => {
    setBusy(true);
    try {
      applyState(await getBlockforgeApi().restartRojo());
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <p className="ws-dock-lede">Loading Rojo status…</p>;
  }

  const running = status.rojoServeRunning || status.rbxtscRunning;
  const sync = studioSyncLabel(status);
  const compilerStatus = status.compilerStatus ?? "idle";
  const compilerLog = status.compilerLog ?? null;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Port {status.port ?? "—"}
            {status.port != null && status.port !== 34872
              ? " (non-default — set this port in the Rojo Studio plugin)"
              : ""}{" "}
            · rbxtsc {status.rbxtscRunning ? "running" : "stopped"} · rojo{" "}
            {status.rojoServeRunning ? "running" : "stopped"}
            {status.foreignRojoPort ? (
              <span className="error-text"> · {status.foreignRojoDetail}</span>
            ) : null}
          </div>
        </div>
        <span className={`badge ${status.studioConnected ? "ok" : "warning"}`}>
          Serve {status.studioConnected ? "reachable" : "unreachable"}
        </span>
      </div>
      <div className="row" style={{ marginTop: "0.65rem", justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {status.studioMcpDetail}
        </div>
        <span
          className={`badge ${status.studioMcpConnected ? "ok" : "warning"}`}
        >
          MCP{" "}
          {status.studioMcpConnected
            ? "connected"
            : status.studioMcpLauncherFound
              ? "waiting"
              : "missing"}
        </span>
      </div>
      <div className="row" style={{ marginTop: "0.65rem", justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          Studio bridge {status.studioBridgeRunning ? "listening :34873" : "off"}
          {status.studioBridgeConnected ? " · plugin connected" : ""}
          {" · fallback if MCP unavailable"}
        </div>
        <span
          className={`badge ${status.studioBridgeConnected ? "ok" : status.studioBridgeRunning ? "warning" : "missing"}`}
        >
          Bridge {status.studioBridgeConnected ? "connected" : status.studioBridgeRunning ? "waiting" : "stopped"}
        </span>
      </div>
      <div className="row" style={{ marginTop: "0.65rem", justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {sync.text}
          {status.studioWorldNames.length > 0
            ? ` · ${status.studioWorldNames.slice(0, 8).join(", ")}`
            : ""}
        </div>
        <span className={`badge ${sync.badge}`}>{status.studioSyncStatus}</span>
      </div>
      <div className="row" style={{ marginTop: "0.65rem" }}>
        <button
          type="button"
          className="btn secondary"
          disabled={busy || !running}
          onClick={() => void handleStop()}
        >
          Stop
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy || running}
          onClick={() => void handleRun()}
        >
          Run
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => void handleRestart()}
        >
          Restart
        </button>
      </div>
      {syncback?.enabled ? (
        <div style={{ marginTop: "0.85rem" }}>
          <strong>Experimental syncback</strong>
          {syncback.conflicts.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              No Studio↔disk conflicts
              {syncback.lastScanAt ? ` (scanned ${syncback.lastScanAt})` : ""}.
            </p>
          ) : (
            <ul style={{ marginBottom: 0 }}>
              {syncback.conflicts.map((c) => (
                <li key={c.id} style={{ marginBottom: "0.5rem" }}>
                  <code>{c.path}</code> — {c.detail}
                  <div className="row" style={{ marginTop: "0.35rem", gap: "0.35rem" }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        void getBlockforgeApi()
                          .resolveSyncbackConflict({
                            conflictId: c.id,
                            resolution: "keep-disk",
                          })
                          .then(setSyncback)
                      }
                    >
                      Keep disk
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        void getBlockforgeApi()
                          .resolveSyncbackConflict({
                            conflictId: c.id,
                            resolution: "take-studio",
                          })
                          .then(setSyncback)
                      }
                    >
                      Take Studio
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        void getBlockforgeApi()
                          .resolveSyncbackConflict({
                            conflictId: c.id,
                            resolution: "open-diff",
                          })
                          .then(setSyncback)
                      }
                    >
                      Open diff
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {status.lastRuntimeError ? (
        <p className="error-text" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
          Studio: {status.lastRuntimeError}
        </p>
      ) : null}
      {status.rbxtscRunning || compilerLog ? (
        <section className="ws-dock-section" aria-label="TypeScript compiler">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ marginBottom: 0 }}>TypeScript</h3>
            <span
              className={`badge ${
                compilerStatus === "ok"
                  ? "ok"
                  : compilerStatus === "error"
                    ? "missing"
                    : "warning"
              }`}
            >
              {compilerStatus === "ok"
                ? "watching"
                : compilerStatus === "error"
                  ? "errors"
                  : "idle"}
            </span>
          </div>
          <p
            className={
              compilerStatus === "error"
                ? "error-text"
                : compilerStatus === "ok"
                  ? "success-text"
                  : "muted"
            }
            style={{ margin: "0.45rem 0 0" }}
          >
            {compilerHeadline(compilerStatus, compilerLog)}
          </p>
          {compilerStatus === "error" && compilerLog ? (
            <pre className="sync-compiler-log">{compilerLog}</pre>
          ) : null}
        </section>
      ) : null}
      {status.lastError &&
      compilerStatus !== "error" &&
      status.lastError !== status.foreignRojoDetail ? (
        <p className="error-text" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
          {status.lastError}
        </p>
      ) : null}
    </div>
  );
}

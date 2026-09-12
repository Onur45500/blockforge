import { useCallback, useEffect, useState } from "react";
import type { PtySessionInfo, StudioLockStatusSnapshot } from "../../shared/ipc-types";
import { isAgentPtySession } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import {
  ADAPTER_LABELS,
  isLeadLabel,
  terminalTitle,
} from "./workspace-types";

type TerminalMonitorProps = {
  projectPath: string;
  leadSessionId: string | null;
  activeSessionId: string | null;
  onFocusSession: (sessionId: string) => void;
};

export function TerminalMonitor({
  projectPath,
  leadSessionId,
  activeSessionId,
  onFocusSession,
}: TerminalMonitorProps) {
  const [sessions, setSessions] = useState<PtySessionInfo[]>([]);
  const [locks, setLocks] = useState<StudioLockStatusSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const list = (await getBlockforgeApi().ptyList({ projectPath })).filter(
      isAgentPtySession,
    );
    setSessions(list);
  }, [projectPath]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    const unsubPty = getBlockforgeApi().onPtyStatusChanged((event) => {
      if (event.projectPath === projectPath) {
        setSessions(event.sessions.filter(isAgentPtySession));
      }
    });
    const unsubLocks = getBlockforgeApi().onStudioLocksChanged(setLocks);
    void getBlockforgeApi()
      .getStudioLocksStatus()
      .then(setLocks)
      .catch(() => undefined);
    return () => {
      unsubPty();
      unsubLocks();
    };
  }, [projectPath, refresh]);

  const closeSession = async (sessionId: string): Promise<void> => {
    await getBlockforgeApi().ptyStop({ sessionId });
    await refresh();
  };

  let lockLine: string | null = null;
  if (locks?.playtestHolderSessionId) {
    lockLine = "Playtest lock held";
  } else if (locks?.studioHolderSessionId) {
    lockLine = "Studio turn lock held";
  }

  return (
    <div className="ws-agents-panel">
      <p className="ws-dock-lede">
        Terminals stay in the center. This list mirrors live sessions and Studio locks.
      </p>
      {lockLine ? (
        <p className="muted" style={{ marginTop: 0 }}>
          <span className="badge warning">{lockLine}</span>
        </p>
      ) : null}
      {sessions.length === 0 ? (
        <p className="muted ws-monitor-empty">No agent terminals yet.</p>
      ) : (
        <ul className="ws-monitor-list">
          {sessions.map((session) => {
            const isLead =
              session.sessionId === leadSessionId || isLeadLabel(session.label);
            const isActive = session.sessionId === activeSessionId;
            const title = terminalTitle({
              label: session.label,
              isLead,
            });
            return (
              <li
                key={session.sessionId}
                className={`ws-monitor-item${isActive ? " active" : ""}${isLead ? " lead" : ""}`}
              >
                <button
                  type="button"
                  className="ws-monitor-focus"
                  onClick={() => onFocusSession(session.sessionId)}
                >
                  <span className="ws-monitor-title">{title}</span>
                  <span className="ws-monitor-meta muted">
                    {ADAPTER_LABELS[session.adapterId] ?? session.adapterId} ·{" "}
                    {session.status}
                    {session.source === "agent" ? " · agent" : " · ui"}
                    {locks?.studioHolderSessionId === session.sessionId
                      ? " · studio lock"
                      : ""}
                    {locks?.playtestHolderSessionId === session.sessionId
                      ? " · playtest"
                      : ""}
                  </span>
                </button>
                <div className="ws-monitor-actions">
                  <button
                    type="button"
                    className="btn ghost compact"
                    title="Close"
                    onClick={() => void closeSession(session.sessionId)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

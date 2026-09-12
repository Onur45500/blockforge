import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PtySessionInfo, PtyStatusChangedEvent } from "../../shared/ipc-types";
import { isShellPtySession } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import { ptyStartLockKey, withPtyStartLock } from "../lib/pty-spawn-lock";
import { Terminal } from "../components/Terminal";
import { nextShellLabel } from "./workspace-types";

type ShellTerminalPanelProps = {
  projectPath: string;
};

export function ShellTerminalPanel({ projectPath }: ShellTerminalPanelProps) {
  const [sessions, setSessions] = useState<PtySessionInfo[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const spawningLabels = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const list = (await getBlockforgeApi().ptyList({
      projectPath,
      kind: "shell",
    })).filter(isShellPtySession);
    setSessions(list);
    return list;
  }, [projectPath]);

  const spawnShell = useCallback(
    async (label: string) => {
      if (spawningLabels.current.has(label)) {
        return;
      }
      spawningLabels.current.add(label);
      setStarting(true);
      try {
        const sessionId = await withPtyStartLock(
          ptyStartLockKey({ kind: "shell", projectPath, label }),
          async () => {
            const listed = (
              await getBlockforgeApi().ptyList({
                projectPath,
                kind: "shell",
              })
            ).filter(isShellPtySession);
            const reuse = listed.find(
              (s) => s.label === label && s.status === "running",
            );
            if (reuse) {
              return reuse.sessionId;
            }
            const started = await getBlockforgeApi().ptyStart({
              projectPath,
              cols: 120,
              rows: 32,
              kind: "shell",
              label,
              source: "ui",
            });
            return started.sessionId;
          },
        );
        setActiveKey(sessionId);
        await refresh();
      } finally {
        spawningLabels.current.delete(label);
        setStarting(false);
      }
    },
    [projectPath, refresh],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await refresh();
      if (cancelled) {
        return;
      }
      if (list.length === 0) {
        await spawnShell("cmd");
        return;
      }
      setActiveKey((prev) => {
        if (prev && list.some((s) => s.sessionId === prev)) {
          return prev;
        }
        return list[0]?.sessionId ?? null;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath, refresh, spawnShell]);

  useEffect(() => {
    const unsub = getBlockforgeApi().onPtyStatusChanged(
      (event: PtyStatusChangedEvent) => {
        if (event.projectPath !== projectPath) {
          return;
        }
        setSessions(event.sessions.filter(isShellPtySession));
      },
    );
    return unsub;
  }, [projectPath]);

  const tabs = useMemo(
    () =>
      sessions.map((s) => ({
        sessionId: s.sessionId,
        label: s.label ?? "cmd",
      })),
    [sessions],
  );

  const activeTab =
    tabs.find((t) => t.sessionId === activeKey) ?? tabs[0];

  const closeSession = async (sessionId: string): Promise<void> => {
    await getBlockforgeApi().ptyStop({ sessionId });
    const list = await refresh();
    setActiveKey(list[0]?.sessionId ?? null);
  };

  const onNewShell = (): void => {
    const label = nextShellLabel([
      ...sessions.map((s) => s.label ?? ""),
      ...spawningLabels.current,
    ]);
    void spawnShell(label);
  };

  return (
    <div className="ws-shell-terminal">
      <div className="ws-terminal-toolbar">
        <div className="ws-terminal-tabs" role="tablist" aria-label="CMD sessions">
          {tabs.map((tab) => {
            const selected = activeTab?.sessionId === tab.sessionId;
            return (
              <div
                key={tab.sessionId}
                className={`ws-term-tab-wrap${selected ? " active" : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`ws-term-tab${selected ? " active" : ""}`}
                  onClick={() => setActiveKey(tab.sessionId)}
                >
                  {tab.label}
                </button>
                <button
                  type="button"
                  className="ws-term-tab-close"
                  aria-label={`Close ${tab.label}`}
                  title="Close"
                  onClick={() => void closeSession(tab.sessionId)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn secondary compact"
          onClick={onNewShell}
          title="New CMD"
          aria-label="New CMD"
          disabled={starting}
        >
          +
        </button>
      </div>
      <div className="ws-terminal-fill">
        {tabs.length === 0 ? (
          <div className="ws-term-empty">
            <p className="muted">{starting ? "Starting CMD…" : "No CMD yet."}</p>
            {starting ? null : (
              <button type="button" className="btn secondary" onClick={onNewShell}>
                New CMD
              </button>
            )}
          </div>
        ) : (
          <div className="ws-terminal-stage">
            <div className="ws-terminal-pane">
              {tabs.map((tab) => {
                const visible = activeTab?.sessionId === tab.sessionId;
                return (
                  <div
                    key={tab.sessionId}
                    className={
                      visible ? "ws-term-slot" : "ws-term-slot ws-term-slot-hidden"
                    }
                  >
                    <Terminal
                      kind="shell"
                      projectPath={projectPath}
                      displayName={tab.label}
                      active={visible}
                      focused={visible}
                      showTitlebar={false}
                      label={tab.label}
                      bindSessionId={tab.sessionId}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentId, PtySessionInfo, PtyStatusChangedEvent } from "../../shared/ipc-types";
import { isAgentPtySession } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import { Terminal } from "../components/Terminal";
import {
  ADAPTER_LABELS,
  adapterSupportsResume,
  isGenericTerminalLabel,
  isLeadLabel,
  nextUiTerminalLabel,
  terminalTitle,
} from "./workspace-types";

type TerminalWorkspaceProps = {
  projectPath: string;
  leadSessionId: string | null;
  activeSessionId: string | null;
  mountedSessionIds: string[];
  splitView: boolean;
  onLeadSessionId: (id: string | null) => void;
  onActiveSessionId: (id: string | null) => void;
  onEnsureMounted: (id: string) => void;
  onUnmountSession: (id: string) => void;
};

type LocalTab = {
  sessionId: string | null;
  adapterId: AgentId;
  label: string;
  /** Bind to existing session without spawning. */
  bindSessionId?: string;
};

const DEFAULT_ADAPTER: AgentId = "claude-code";

export function TerminalWorkspace({
  projectPath,
  leadSessionId,
  activeSessionId,
  mountedSessionIds,
  splitView,
  onLeadSessionId,
  onActiveSessionId,
  onEnsureMounted,
  onUnmountSession,
}: TerminalWorkspaceProps) {
  const [sessions, setSessions] = useState<PtySessionInfo[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [pendingTabs, setPendingTabs] = useState<LocalTab[]>([]);
  const [spawnAdapter, setSpawnAdapter] = useState<AgentId>(DEFAULT_ADAPTER);
  const [defaultAdapterReady, setDefaultAdapterReady] = useState(false);
  const activeRef = useRef(activeSessionId);
  activeRef.current = activeSessionId;

  useEffect(() => {
    void getBlockforgeApi()
      .getSettings()
      .then((settings) => {
        const id = settings.defaultAgentId ?? DEFAULT_ADAPTER;
        setSpawnAdapter(id === "antigravity" ? DEFAULT_ADAPTER : id);
        setDefaultAdapterReady(true);
      })
      .catch(() => setDefaultAdapterReady(true));
  }, []);

  const refresh = useCallback(async () => {
    const list = (await getBlockforgeApi().ptyList({ projectPath })).filter(
      isAgentPtySession,
    );
    setSessions(list);
    return list;
  }, [projectPath]);

  useEffect(() => {
    if (!defaultAdapterReady) {
      return;
    }
    void (async () => {
      const list = await refresh();
      if (list.length === 0) {
        setPendingTabs((prev) => {
          if (prev.some((t) => t.sessionId === null && isLeadLabel(t.label))) {
            return prev.map((t) =>
              t.sessionId === null && isLeadLabel(t.label)
                ? { ...t, adapterId: spawnAdapter }
                : t,
            );
          }
          return [
            {
              sessionId: null,
              adapterId: spawnAdapter,
              label: "Lead",
            },
          ];
        });
        return;
      }
      const lead =
        list.find((s) => s.label === "Lead" || s.label === "lead") ??
        list.find((s) => s.adapterId === spawnAdapter && s.source !== "agent") ??
        list[0];
      if (lead) {
        onLeadSessionId(lead.sessionId);
        onEnsureMounted(lead.sessionId);
        if (!activeRef.current) {
          onActiveSessionId(lead.sessionId);
        }
        for (const s of list) {
          onEnsureMounted(s.sessionId);
        }
      }
    })();
  }, [
    projectPath,
    refresh,
    onLeadSessionId,
    onActiveSessionId,
    onEnsureMounted,
    defaultAdapterReady,
    spawnAdapter,
  ]);

  useEffect(() => {
    const unsubStatus = getBlockforgeApi().onPtyStatusChanged(
      (event: PtyStatusChangedEvent) => {
        if (event.projectPath !== projectPath) {
          return;
        }
        const agentSessions = event.sessions.filter(isAgentPtySession);
        setSessions(agentSessions);
        for (const s of agentSessions) {
          onEnsureMounted(s.sessionId);
          if (!leadSessionId && s.source !== "agent") {
            onLeadSessionId(s.sessionId);
          }
        }
        if (event.focusSessionId) {
          const focused = agentSessions.find(
            (s) => s.sessionId === event.focusSessionId,
          );
          if (focused) {
            onEnsureMounted(focused.sessionId);
            onActiveSessionId(focused.sessionId);
          }
        }
      },
    );

    const unsubData = getBlockforgeApi().onPtyData(({ sessionId }) => {
      if (sessionId === activeRef.current) {
        return;
      }
      setUnread((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? 0) + 1,
      }));
    });

    return () => {
      unsubStatus();
      unsubData();
    };
  }, [
    projectPath,
    leadSessionId,
    onEnsureMounted,
    onLeadSessionId,
    onActiveSessionId,
  ]);

  const focusSession = (sessionId: string): void => {
    onEnsureMounted(sessionId);
    onActiveSessionId(sessionId);
    setUnread((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  const closeSession = async (sessionId: string): Promise<void> => {
    const wasLead = sessionId === leadSessionId;
    await getBlockforgeApi().ptyStop({ sessionId });
    onUnmountSession(sessionId);
    setPendingTabs((prev) => prev.filter((t) => t.sessionId !== sessionId));
    const list = await refresh();
    if (wasLead) {
      const nextLead =
        list.find((s) => isLeadLabel(s.label)) ??
        list.find((s) => s.source !== "agent") ??
        list[0];
      onLeadSessionId(nextLead?.sessionId ?? null);
      if (nextLead) {
        onActiveSessionId(nextLead.sessionId);
      }
    }
  };

  const spawnTerminal = async (
    adapterId: AgentId,
    label: string,
    focus = true,
    resume = false,
  ): Promise<void> => {
    const { sessionId } = await getBlockforgeApi().ptyStart({
      projectPath,
      cols: 120,
      rows: 32,
      adapterId,
      label,
      role: label,
      source: "ui",
      focus,
      resume,
    });
    onEnsureMounted(sessionId);
    if (!leadSessionId) {
      onLeadSessionId(sessionId);
    }
    if (focus) {
      onActiveSessionId(sessionId);
    }
    await refresh();
  };

  const onSessionBound = (sessionId: string, isLeadCandidate: boolean): void => {
    onEnsureMounted(sessionId);
    if (isLeadCandidate && !leadSessionId) {
      onLeadSessionId(sessionId);
    }
    if (!activeSessionId) {
      onActiveSessionId(sessionId);
    }
    setPendingTabs((prev) =>
      prev.map((t) =>
        t.sessionId === null && t.label === "Lead"
          ? { ...t, sessionId }
          : t,
      ),
    );
    void refresh();
  };

  /** Prefer the stored lead when it still exists; otherwise heal to a live session. */
  const leadSession = useMemo(() => {
    if (leadSessionId) {
      const found = sessions.find((s) => s.sessionId === leadSessionId);
      if (found) {
        return found;
      }
    }
    return (
      sessions.find((s) => isLeadLabel(s.label)) ??
      sessions.find((s) => s.source !== "agent" && s.status === "running") ??
      sessions.find((s) => s.status === "running") ??
      sessions[0] ??
      null
    );
  }, [sessions, leadSessionId]);

  const effectiveLeadId = leadSession?.sessionId ?? null;

  useEffect(() => {
    if (effectiveLeadId && effectiveLeadId !== leadSessionId) {
      onLeadSessionId(effectiveLeadId);
      return;
    }
    if (!effectiveLeadId && leadSessionId && sessions.length === 0) {
      onLeadSessionId(null);
    }
  }, [effectiveLeadId, leadSessionId, sessions.length, onLeadSessionId]);

  /** Second pane only when split is on and a non-lead session is actually running. */
  const workerSession = useMemo(() => {
    if (!splitView || !effectiveLeadId) {
      return null;
    }
    const others = sessions.filter(isAgentPtySession).filter(
      (s) => s.sessionId !== effectiveLeadId && s.status === "running",
    );
    if (others.length === 0) {
      return null;
    }
    return (
      others.find((s) => s.sessionId === activeSessionId) ?? others[0] ?? null
    );
  }, [sessions, splitView, effectiveLeadId, activeSessionId]);

  const splitActive = Boolean(splitView && effectiveLeadId && workerSession);

  const tabs: LocalTab[] = useMemo(() => {
    const fromSessions: LocalTab[] = sessions.filter(isAgentPtySession).map((s) => ({
      sessionId: s.sessionId,
      adapterId: s.adapterId,
      label:
        s.label ??
        s.role ??
        (s.sessionId === effectiveLeadId
          ? "Lead"
          : ADAPTER_LABELS[s.adapterId] ?? s.adapterId),
      bindSessionId: s.sessionId,
    }));
    const pendingOnly = pendingTabs.filter(
      (p) =>
        p.sessionId === null &&
        !fromSessions.some((s) => s.label === p.label && s.adapterId === p.adapterId),
    );
    return [...fromSessions, ...pendingOnly];
  }, [sessions, pendingTabs, effectiveLeadId]);

  const activeTab =
    tabs.find((t) => t.sessionId === activeSessionId) ??
    tabs.find((t) => t.sessionId === effectiveLeadId) ??
    tabs[0];

  const extraNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let n = 0;
    for (const tab of tabs) {
      const lead =
        (tab.sessionId !== null && tab.sessionId === effectiveLeadId) ||
        isLeadLabel(tab.label);
      if (lead || !isGenericTerminalLabel(tab.label)) {
        continue;
      }
      n += 1;
      const key = tab.sessionId ?? `pending-${tab.adapterId}-${tab.label}`;
      numbers.set(key, n);
    }
    return numbers;
  }, [tabs, effectiveLeadId]);

  const titleFor = (tab: LocalTab, lead: boolean): string => {
    const key = tab.sessionId ?? `pending-${tab.adapterId}-${tab.label}`;
    return terminalTitle({
      label: tab.label,
      isLead: lead,
      extraNumber: extraNumbers.get(key),
    });
  };

  const nextSpawnLabel = (): string =>
    nextUiTerminalLabel({
      hasLead:
        Boolean(effectiveLeadId) || sessions.some((s) => isLeadLabel(s.label)),
      existingLabels: sessions.map((s) => s.label ?? ""),
    });

  const onNewTerminal = (): void => {
    void spawnTerminal(spawnAdapter, nextSpawnLabel(), true, false);
  };

  const isLeadTab = (tab: LocalTab): boolean =>
    (tab.sessionId !== null && tab.sessionId === effectiveLeadId) ||
    (tab.sessionId === null && tab.label === "Lead");

  return (
    <div className="ws-terminal-workspace">
      <div className="ws-terminal-toolbar">
        <div className="ws-terminal-tabs" role="tablist" aria-label="Terminals">
          {tabs.map((tab, index) => {
            const id = tab.sessionId ?? `pending-${tab.adapterId}-${index}`;
            const selected =
              activeTab?.sessionId === tab.sessionId &&
              activeTab?.label === tab.label;
            const lead = isLeadTab(tab);
            const title = titleFor(tab, lead);
            return (
              <div
                key={id}
                className={`ws-term-tab-wrap${selected ? " active" : ""}${lead ? " lead" : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`ws-term-tab${selected ? " active" : ""}${lead ? " lead" : ""}`}
                  title={title}
                  onClick={() => {
                    if (tab.sessionId) {
                      focusSession(tab.sessionId);
                    }
                  }}
                >
                  {lead ? <span className="ws-term-lead-dot" aria-hidden /> : null}
                  {title}
                  {tab.sessionId && unread[tab.sessionId] ? (
                    <span className="ws-unread">{unread[tab.sessionId]}</span>
                  ) : null}
                </button>
                {tab.sessionId || tab.label === "Lead" ? (
                  <button
                    type="button"
                    className="ws-term-tab-close"
                    aria-label={`Close ${title}`}
                    title="Close"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (tab.sessionId) {
                        void closeSession(tab.sessionId);
                      } else {
                        setPendingTabs((prev) =>
                          prev.filter(
                            (p) =>
                              !(
                                p.sessionId === null &&
                                p.label === tab.label &&
                                p.adapterId === tab.adapterId
                              ),
                          ),
                        );
                      }
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="ws-terminal-actions">
          <label className="ws-adapter-field">
            <span className="ws-adapter-label">Start</span>
            <select
              className="ws-adapter-select"
              value={spawnAdapter}
              id="spawn-adapter"
              aria-label="Which agent to start"
              onChange={(e) => setSpawnAdapter(e.target.value as AgentId)}
            >
              {Object.entries(ADAPTER_LABELS)
                .filter(([id]) => id !== "antigravity")
                .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn secondary compact"
            onClick={onNewTerminal}
          >
            New terminal
          </button>
          {adapterSupportsResume(spawnAdapter) ? (
            <button
              type="button"
              className="btn secondary compact"
              onClick={() => {
                void spawnTerminal(spawnAdapter, nextSpawnLabel(), true, true);
              }}
            >
              Resume last
            </button>
          ) : null}
        </div>
      </div>

      <div className="ws-terminal-fill">
      {tabs.length === 0 ? (
        <div className="ws-term-empty">
          <p className="muted">No terminal yet.</p>
          <button type="button" className="btn secondary" onClick={onNewTerminal}>
            New terminal
          </button>
        </div>
      ) : (
      <div className={`ws-terminal-stage${splitActive ? " split" : ""}`}>
        <div className="ws-terminal-pane">
          {tabs.map((tab, index) => {
            const id = tab.sessionId ?? `pending-${tab.adapterId}-${index}`;
            const isActive =
              (!splitActive &&
                activeTab?.sessionId === tab.sessionId &&
                activeTab?.label === tab.label) ||
              (splitActive &&
                (tab.sessionId === effectiveLeadId ||
                  (tab.sessionId === null && tab.label === "Lead")));
            const shouldMount =
              tab.sessionId === null ||
              (tab.sessionId !== null && mountedSessionIds.includes(tab.sessionId)) ||
              isActive;

            if (!shouldMount && tab.sessionId !== null) {
              return null;
            }

            // Worker is rendered in the secondary pane — skip duplicate bind here.
            if (
              splitActive &&
              tab.sessionId !== null &&
              tab.sessionId === workerSession?.sessionId
            ) {
              return null;
            }

            const visible =
              isActive ||
              (!splitActive &&
                activeTab?.sessionId === tab.sessionId &&
                activeTab?.label === tab.label);

            const lead = isLeadTab(tab);
            const title = titleFor(tab, lead);

            return (
              <div
                key={id}
                className={visible ? "ws-term-slot" : "ws-term-slot ws-term-slot-hidden"}
              >
                <Terminal
                  projectPath={projectPath}
                  adapterId={tab.adapterId}
                  displayName={title}
                  subtitle={ADAPTER_LABELS[tab.adapterId] ?? tab.adapterId}
                  focused={visible}
                  showTitlebar={splitActive}
                  active={
                    splitActive
                      ? tab.sessionId === effectiveLeadId || tab.label === "Lead"
                      : Boolean(
                          activeTab &&
                            activeTab.sessionId === tab.sessionId &&
                            activeTab.label === tab.label,
                        )
                  }
                  label={tab.label === "Lead" ? "Lead" : tab.label}
                  bindSessionId={tab.bindSessionId}
                  onSessionBound={(sessionId) =>
                    onSessionBound(sessionId, tab.label === "Lead")
                  }
                  onClose={
                    tab.sessionId
                      ? () => void closeSession(tab.sessionId!)
                      : () =>
                          setPendingTabs((prev) =>
                            prev.filter(
                              (p) =>
                                !(
                                  p.sessionId === null &&
                                  p.label === tab.label &&
                                  p.adapterId === tab.adapterId
                                ),
                            ),
                          )
                  }
                />
              </div>
            );
          })}
        </div>
        {splitActive && workerSession ? (
          <div className="ws-terminal-pane secondary">
            <div className="ws-term-slot">
              <Terminal
                projectPath={projectPath}
                adapterId={workerSession.adapterId}
                displayName={terminalTitle({
                  label: workerSession.label,
                  isLead: false,
                  extraNumber: extraNumbers.get(workerSession.sessionId),
                })}
                subtitle={
                  ADAPTER_LABELS[workerSession.adapterId] ?? workerSession.adapterId
                }
                focused
                active
                showTitlebar
                label={workerSession.label}
                bindSessionId={workerSession.sessionId}
                onClose={() => void closeSession(workerSession.sessionId)}
              />
            </div>
          </div>
        ) : null}
      </div>
      )}
      </div>
    </div>
  );
}

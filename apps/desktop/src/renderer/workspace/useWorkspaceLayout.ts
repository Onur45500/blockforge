import { useCallback, useEffect, useState } from "react";
import { loadWorkspaceLayout, saveWorkspaceLayout } from "./layout-persistence";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  isBottomDock,
  isToolDock,
  normalizeOpenDocks,
  type DockId,
  type DockSide,
  type WorkspaceLayoutState,
} from "./workspace-types";

export function useWorkspaceLayout(projectId: string) {
  const [layout, setLayout] = useState<WorkspaceLayoutState>(() =>
    loadWorkspaceLayout(projectId),
  );

  useEffect(() => {
    setLayout(loadWorkspaceLayout(projectId));
  }, [projectId]);

  useEffect(() => {
    saveWorkspaceLayout(projectId, layout);
  }, [projectId, layout]);

  const toggleDock = useCallback((id: DockId) => {
    setLayout((prev) => {
      const open = prev.openDocks.includes(id);
      if (isBottomDock(id)) {
        return {
          ...prev,
          quietMode: false,
          openDocks: normalizeOpenDocks(
            open
              ? prev.openDocks.filter((d) => d !== id)
              : [...prev.openDocks.filter((d) => d !== id), id],
          ),
        };
      }

      // Tool docks are exclusive: switch or close — never stack.
      if (open) {
        return {
          ...prev,
          quietMode: false,
          openDocks: normalizeOpenDocks(prev.openDocks.filter((d) => d !== id)),
        };
      }

      const kept = prev.openDocks.filter((d) => !isToolDock(d));
      return {
        ...prev,
        quietMode: false,
        openDocks: normalizeOpenDocks([...kept, id]),
      };
    });
  }, []);

  const openDock = useCallback((id: DockId) => {
    setLayout((prev) => {
      if (isBottomDock(id)) {
        const without = prev.openDocks.filter((d) => d !== id);
        return {
          ...prev,
          quietMode: false,
          openDocks: normalizeOpenDocks([...without, id]),
        };
      }
      if (prev.openDocks.includes(id) && prev.openDocks.filter(isToolDock).length === 1) {
        return { ...prev, quietMode: false };
      }
      const kept = prev.openDocks.filter((d) => !isToolDock(d));
      return {
        ...prev,
        quietMode: false,
        openDocks: normalizeOpenDocks([...kept, id]),
      };
    });
  }, []);

  const closeDock = useCallback((id: DockId) => {
    setLayout((prev) => ({
      ...prev,
      openDocks: normalizeOpenDocks(prev.openDocks.filter((d) => d !== id)),
    }));
  }, []);

  const setDockSide = useCallback((id: DockId, side: DockSide) => {
    setLayout((prev) => ({
      ...prev,
      dockSides: { ...prev.dockSides, [id]: side },
    }));
  }, []);

  const setQuietMode = useCallback((quietMode: boolean) => {
    setLayout((prev) => ({
      ...prev,
      quietMode,
      openDocks: quietMode ? [] : prev.openDocks,
    }));
  }, []);

  const setSplitView = useCallback((splitView: boolean) => {
    setLayout((prev) => ({ ...prev, splitView }));
  }, []);

  const setActiveSessionId = useCallback((activeSessionId: string | null) => {
    setLayout((prev) => ({ ...prev, activeSessionId }));
  }, []);

  const setLeadSessionId = useCallback((leadSessionId: string | null) => {
    setLayout((prev) => ({ ...prev, leadSessionId }));
  }, []);

  const ensureMounted = useCallback((sessionId: string) => {
    setLayout((prev) => {
      if (prev.mountedSessionIds.includes(sessionId)) {
        return prev;
      }
      return {
        ...prev,
        mountedSessionIds: [...prev.mountedSessionIds, sessionId],
      };
    });
  }, []);

  const unmountSession = useCallback((sessionId: string) => {
    setLayout((prev) => {
      const leadGone = prev.leadSessionId === sessionId;
      const nextLead = leadGone ? null : prev.leadSessionId;
      const nextActive =
        prev.activeSessionId === sessionId
          ? nextLead
          : prev.activeSessionId;
      return {
        ...prev,
        mountedSessionIds: prev.mountedSessionIds.filter((id) => id !== sessionId),
        leadSessionId: nextLead,
        activeSessionId: nextActive,
      };
    });
  }, []);

  const setPanelSizes = useCallback(
    (patch: Partial<WorkspaceLayoutState["panelSizes"]>) => {
      setLayout((prev) => ({
        ...prev,
        panelSizes: { ...prev.panelSizes, ...patch },
      }));
    },
    [],
  );

  const resetLayout = useCallback(() => {
    setLayout({
      ...DEFAULT_WORKSPACE_LAYOUT,
      dockSides: { ...DEFAULT_WORKSPACE_LAYOUT.dockSides },
    });
  }, []);

  return {
    layout,
    toggleDock,
    openDock,
    closeDock,
    setDockSide,
    setQuietMode,
    setSplitView,
    setActiveSessionId,
    setLeadSessionId,
    ensureMounted,
    unmountSession,
    setPanelSizes,
    resetLayout,
  };
}

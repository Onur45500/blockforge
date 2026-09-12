import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { getBlockforgeApi } from "../lib/api";
import { ptyStartLockKey, withPtyStartLock } from "../lib/pty-spawn-lock";
import type {
  AgentId,
  PtyDataEvent,
  PtyExitEvent,
  PtySessionKind,
} from "../../shared/ipc-types";

type TerminalBaseProps = {
  projectPath: string;
  displayName: string;
  /** When false, panel is hidden but PTY stays alive. */
  active?: boolean;
  /** Optional label stored on the PTY session. */
  label?: string;
  /** Reattach this session id if still live. */
  bindSessionId?: string;
  /** Called when a session id is bound (start or reattach). */
  onSessionBound?: (sessionId: string) => void;
  /** Optional subtitle under the window title (e.g. adapter name). */
  subtitle?: string;
  /** Close control in the window title bar. */
  onClose?: () => void;
  /** Emphasize this window as focused. */
  focused?: boolean;
  /** Show the chrome titlebar (needed in split view). */
  showTitlebar?: boolean;
};

export type TerminalProps = TerminalBaseProps &
  (
    | { kind?: "agent"; adapterId: AgentId }
    | { kind: "shell"; adapterId?: never }
  );

async function copyText(text: string): Promise<void> {
  await getBlockforgeApi().clipboardWrite(text);
}

async function readClipboardText(): Promise<string> {
  return getBlockforgeApi().clipboardRead();
}

export function Terminal(props: TerminalProps) {
  const {
    projectPath,
    displayName,
    active = true,
    label,
    bindSessionId,
    onSessionBound,
    subtitle,
    onClose,
    focused = false,
    showTitlebar = true,
  } = props;
  const kind: PtySessionKind = props.kind === "shell" ? "shell" : "agent";
  const adapterId = props.kind === "shell" ? undefined : props.adapterId;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const onBoundRef = useRef(onSessionBound);
  onBoundRef.current = onSessionBound;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      rightClickSelectsWord: true,
      theme: {
        background: "#0a0c10",
        foreground: "#e8eaed",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    const pasteIntoTerminal = async (): Promise<void> => {
      try {
        const text = await readClipboardText();
        if (text) {
          term.paste(text);
        }
      } catch {
        // ignore clipboard failures
      }
    };

    const copySelection = async (): Promise<boolean> => {
      if (!term.hasSelection()) {
        return false;
      }
      try {
        await copyText(term.getSelection());
        return true;
      } catch {
        return false;
      }
    };

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        return true;
      }
      const key = event.key.toLowerCase();

      if (key === "c" && term.hasSelection()) {
        void copySelection();
        return false;
      }
      if (key === "v") {
        void pasteIntoTerminal();
        return false;
      }
      return true;
    });

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      if (term.hasSelection()) {
        void copySelection();
      } else {
        void pasteIntoTerminal();
      }
    };
    container.addEventListener("contextmenu", onContextMenu);

    const onResize = (): void => {
      if (container.clientWidth < 8 || container.clientHeight < 8) {
        return;
      }
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      const sessionId = sessionRef.current;
      if (sessionId) {
        void getBlockforgeApi().ptyResize({
          sessionId,
          cols: term.cols,
          rows: term.rows,
        });
      }
    };

    window.addEventListener("resize", onResize);
    let frame = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        onResize();
      });
    });
    resizeObserver.observe(container);

    const unsubData = getBlockforgeApi().onPtyData(({ sessionId, data }: PtyDataEvent) => {
      if (sessionId === sessionRef.current) {
        term.write(data);
      }
    });

    const unsubExit = getBlockforgeApi().onPtyExit(({ sessionId, exitCode }: PtyExitEvent) => {
      if (sessionId === sessionRef.current) {
        const tag = kind === "shell" ? "cmd" : "agent";
        term.writeln(`\r\n\x1b[33m[${tag} exited ${exitCode}]\x1b[0m`);
        sessionRef.current = null;
      }
    });

    term.onData((data) => {
      const sessionId = sessionRef.current;
      if (sessionId) {
        void getBlockforgeApi().ptyWrite({ sessionId, data });
      }
    });

    let cancelled = false;
    void (async () => {
      fitAddon.fit();
      const existing = await getBlockforgeApi().ptyList({
        projectPath,
        adapterId,
        kind,
      });
      if (cancelled) {
        return;
      }

      const byBind = bindSessionId
        ? existing.find((s) => s.sessionId === bindSessionId)
        : undefined;
      const byLabel = label
        ? existing.find((s) => s.label === label && s.status === "running")
        : undefined;
      const live = byBind ?? byLabel;

      if (live) {
        sessionRef.current = live.sessionId;
        onBoundRef.current?.(live.sessionId);
        term.writeln(
          `\x1b[36mReattached ${displayName} (session kept across project switch)…\x1b[0m`,
        );
        void getBlockforgeApi().ptyResize({
          sessionId: live.sessionId,
          cols: term.cols,
          rows: term.rows,
        });
        return;
      }

      if (bindSessionId) {
        return;
      }

      const sessionId = await withPtyStartLock(
        ptyStartLockKey({ kind, projectPath, adapterId, label }),
        async () => {
          const listed = await getBlockforgeApi().ptyList({
            projectPath,
            adapterId,
            kind,
          });
          const reuse = label
            ? listed.find((s) => s.label === label && s.status === "running")
            : undefined;
          if (reuse) {
            return reuse.sessionId;
          }
          const started = await getBlockforgeApi().ptyStart({
            projectPath,
            cols: term.cols,
            rows: term.rows,
            kind,
            adapterId,
            resume: kind === "shell" ? undefined : false,
            label,
            source: "ui",
          });
          return started.sessionId;
        },
      );
      if (cancelled) {
        return;
      }
      sessionRef.current = sessionId;
      onBoundRef.current?.(sessionId);
      term.writeln(`\x1b[36mStarting ${displayName}…\x1b[0m`);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      container.removeEventListener("contextmenu", onContextMenu);
      unsubData();
      unsubExit();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      sessionRef.current = null;
    };
  }, [projectPath, adapterId, displayName, label, bindSessionId, kind]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) {
      return;
    }
    requestAnimationFrame(() => {
      fit.fit();
      const sessionId = sessionRef.current;
      if (sessionId) {
        void getBlockforgeApi().ptyResize({
          sessionId,
          cols: term.cols,
          rows: term.rows,
        });
      }
    });
  }, [active]);

  return (
    <div
      className={`ws-term-window${focused ? " focused" : ""}${active ? "" : " inactive"}${showTitlebar ? "" : " no-titlebar"}`}
      role="region"
      aria-label={`${displayName} terminal`}
    >
      {showTitlebar ? (
        <header className="ws-term-titlebar">
          <div className="ws-term-titlebar-text">
            <span className="ws-term-title">{displayName}</span>
            {subtitle && subtitle !== displayName ? (
              <span className="ws-term-subtitle muted">{subtitle}</span>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className="ws-close-btn ws-term-close"
              aria-label={`Close ${displayName}`}
              title="Close"
              onClick={onClose}
            >
              ✕
            </button>
          ) : null}
        </header>
      ) : null}
      <div className="ws-term-body">
        <div className="terminal-wrap" ref={containerRef} />
      </div>
    </div>
  );
}

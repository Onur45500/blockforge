import { useEffect, useRef } from "react";
import type { DockId } from "./workspace-types";

type ShortcutHandlers = {
  onTogglePalette: () => void;
  onToggleDock: (id: DockId) => void;
  onNewTerminal: () => void;
  onFocusLead: () => void;
  onToggleQuiet: () => void;
  onToggleSplit: () => void;
  onOpenDoctor: () => void;
  onOpenSettings: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function targetIsXterm(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest(".xterm"));
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const h = handlersRef.current;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        return;
      }
      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        h.onTogglePalette();
        return;
      }

      if (key === "`") {
        event.preventDefault();
        h.onToggleDock("terminal");
        return;
      }

      if (isTypingTarget(event.target)) {
        if (targetIsXterm(event.target) && key === "t" && event.shiftKey) {
          event.preventDefault();
          h.onNewTerminal();
        }
        return;
      }

      if (key === "b" && event.shiftKey) {
        event.preventDefault();
        h.onToggleQuiet();
        return;
      }
      if (key === "\\" && event.shiftKey) {
        event.preventDefault();
        h.onToggleSplit();
        return;
      }
      if (key === "1") {
        event.preventDefault();
        h.onFocusLead();
        return;
      }
      if (key === ",") {
        event.preventDefault();
        h.onOpenSettings();
        return;
      }
      if (key === "d" && event.shiftKey) {
        event.preventDefault();
        h.onOpenDoctor();
        return;
      }
      if (key === "t" && event.shiftKey) {
        event.preventDefault();
        h.onNewTerminal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

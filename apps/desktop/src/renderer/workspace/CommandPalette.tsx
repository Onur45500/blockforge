import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  actions: PaletteAction[];
  onClose: () => void;
};

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return actions;
    }
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.hint?.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const runAt = (i: number): void => {
    const action = filtered[i];
    if (!action) {
      return;
    }
    onClose();
    action.run();
  };

  return (
    <div className="ws-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ws-palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((v) => Math.min(v + 1, Math.max(filtered.length - 1, 0)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((v) => Math.max(v - 1, 0));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            runAt(index);
          }
        }}
      >
        <input
          ref={inputRef}
          className="ws-palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="ws-palette-list">
          {filtered.map((action, i) => (
            <li key={action.id}>
              <button
                type="button"
                className={`ws-palette-item${i === index ? " active" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => runAt(i)}
              >
                <span>{action.label}</span>
                {action.hint ? <span className="muted">{action.hint}</span> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="muted" style={{ padding: "0.75rem 1rem" }}>
              No matches
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

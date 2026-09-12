import type { ReactNode } from "react";
import { DOCK_LABELS, type DockId, type DockSide } from "./workspace-types";

export type DockSlotItem = {
  id: DockId;
  node: ReactNode;
};

type DockSlotProps = {
  side: DockSide;
  items: DockSlotItem[];
  /** Which item is visible when several share a slot (tabs). */
  activeId: DockId | null;
  onSelect: (id: DockId) => void;
  onClose: (id: DockId) => void;
};

/**
 * One visible panel body per side. Multiple items become tabs instead of
 * stacked full-height panels (which crushed the terminal).
 */
export function DockSlot({
  side,
  items,
  activeId,
  onSelect,
  onClose,
}: DockSlotProps) {
  if (items.length === 0) {
    return null;
  }

  const active =
    items.find((item) => item.id === activeId) ?? items[items.length - 1]!;
  const multi = items.length > 1;

  return (
    <section
      className={`ws-dock-panel ws-dock-${side}`}
      aria-label={DOCK_LABELS[active.id]}
    >
      <header className="ws-dock-header">
        {multi ? (
          <div className="ws-dock-tabs" role="tablist" aria-label="Open panels">
            {items.map((item) => {
              const selected = item.id === active.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`ws-dock-tab${selected ? " active" : ""}`}
                  onClick={() => onSelect(item.id)}
                >
                  {DOCK_LABELS[item.id]}
                </button>
              );
            })}
          </div>
        ) : (
          <h2 className="ws-dock-title">{DOCK_LABELS[active.id]}</h2>
        )}
        <button
          type="button"
          className="ws-close-btn"
          onClick={() => onClose(active.id)}
          aria-label={`Close ${DOCK_LABELS[active.id]}`}
          title={`Close ${DOCK_LABELS[active.id]}`}
        >
          ✕
        </button>
      </header>
      <div
        className={`ws-dock-body${active.id === "terminal" ? " flush" : ""}`}
        role={multi ? "tabpanel" : undefined}
      >
        {active.node}
      </div>
    </section>
  );
}

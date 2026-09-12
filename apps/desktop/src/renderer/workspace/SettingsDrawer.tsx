import type { ReactNode } from "react";

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsDrawer({ open, onClose, children }: SettingsDrawerProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="ws-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="ws-drawer"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ws-drawer-header">
          <h2>Settings</h2>
          <button type="button" className="ws-close-btn" onClick={onClose} aria-label="Close settings" title="Close">
            ✕
          </button>
        </header>
        <div className="ws-drawer-body">{children}</div>
      </aside>
    </div>
  );
}

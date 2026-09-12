import type { ReactNode } from "react";

type DoctorOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function DoctorOverlay({ open, onClose, children }: DoctorOverlayProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="ws-overlay-backdrop" onClick={onClose} role="presentation">
      <div
        className="ws-overlay"
        role="dialog"
        aria-label="Doctor"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ws-drawer-header">
          <h2>Doctor</h2>
          <button type="button" className="ws-close-btn" onClick={onClose} aria-label="Close doctor" title="Close">
            ✕
          </button>
        </header>
        <div className="ws-overlay-body">{children}</div>
      </div>
    </div>
  );
}

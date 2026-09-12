import type { ReactNode } from "react";

type NoticeCardProps = {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export function NoticeCard({
  title,
  children,
  actions,
  onDismiss,
  className,
}: NoticeCardProps) {
  return (
    <div className={`notice-card${className ? ` ${className}` : ""}`} role="status">
      <header className="notice-card-header">
        <strong className="notice-card-title">{title}</strong>
        {onDismiss ? (
          <button
            type="button"
            className="ws-close-btn notice-close"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={onDismiss}
          >
            ✕
          </button>
        ) : null}
      </header>
      {children ? <div className="notice-card-body">{children}</div> : null}
      {actions ? <div className="notice-card-actions">{actions}</div> : null}
    </div>
  );
}

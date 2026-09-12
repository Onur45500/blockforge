import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  message: string | null;
};

/**
 * Keeps the shell visible if a dock/workspace throw would otherwise blank #root.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[blockforge] renderer error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.message) {
      return this.props.children;
    }
    return (
      <div className="app-shell home-shell">
        <main className="content home-content">
          <div className="card">
            <h1 className="page-title">Something went wrong</h1>
            <p className="muted">
              The workspace hit an unexpected error. Studio MCP is optional; you can keep using
              Rojo and the bridge.
            </p>
            <p className="error-text">{this.state.message}</p>
            <button
              type="button"
              className="btn"
              onClick={() => this.setState({ message: null })}
            >
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }
}

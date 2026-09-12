import { useCallback, useEffect, useState } from "react";
import type { GitStatusResult } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";

type GitPanelProps = {
  projectPath: string;
};

export function GitPanel({ projectPath }: GitPanelProps) {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [message, setMessage] = useState("");
  const [diff, setDiff] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branchName, setBranchName] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    const next = await getBlockforgeApi().gitStatus(projectPath);
    setStatus(next);
    if (!next.isRepo) {
      setDiff("");
      return;
    }
    const d = await getBlockforgeApi().gitDiff({ projectPath, staged: false });
    setDiff(d.slice(0, 8000));
  }, [projectPath]);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [refresh]);

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (status && !status.isRepo) {
    return (
      <p className="muted">
        Not a git repository. Run <code>git init</code> in the project folder to enable this panel.
      </p>
    );
  }

  return (
    <div className="git-panel">
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {status?.current ?? "…"}
          {status?.tracking ? ` → ${status.tracking}` : ""}
          {status ? ` · ↑${status.ahead} ↓${status.behind}` : ""}
        </span>
        <button type="button" className="btn ghost compact" disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <ul className="git-file-list">
        {(status?.files ?? []).map((f) => (
          <li key={f.path}>
            <code>
              {f.index}
              {f.working_dir} {f.path}
            </code>
            <span className="row">
              <button
                type="button"
                className="btn ghost compact"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await getBlockforgeApi().gitStage({
                      projectPath,
                      paths: [f.path],
                    });
                  })
                }
              >
                Stage
              </button>
              <button
                type="button"
                className="btn ghost compact"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await getBlockforgeApi().gitUnstage({
                      projectPath,
                      paths: [f.path],
                    });
                  })
                }
              >
                Unstage
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="field">
        <label htmlFor="git-msg">Commit message</label>
        <input
          id="git-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the change"
        />
      </div>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <button
          type="button"
          className="btn compact"
          disabled={busy || message.trim().length === 0}
          onClick={() =>
            void run(async () => {
              await getBlockforgeApi().gitCommit({ projectPath, message });
              setMessage("");
            })
          }
        >
          Commit
        </button>
        <button
          type="button"
          className="btn secondary compact"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await getBlockforgeApi().gitPull(projectPath);
            })
          }
        >
          Pull
        </button>
        <button
          type="button"
          className="btn secondary compact"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await getBlockforgeApi().gitPush(projectPath);
            })
          }
        >
          Push
        </button>
      </div>

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <input
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          placeholder="new-branch"
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn secondary compact"
          disabled={busy || branchName.trim().length === 0}
          onClick={() =>
            void run(async () => {
              await getBlockforgeApi().gitCreateBranch({
                projectPath,
                branch: branchName.trim(),
              });
              setBranchName("");
            })
          }
        >
          Create branch
        </button>
      </div>

      {diff ? (
        <pre className="git-diff">{diff}</pre>
      ) : (
        <p className="muted">Working tree clean (or no unstaged diff).</p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getBlockforgeApi } from "../lib/api";

type CreditsPanelProps = {
  projectPath: string;
};

type AttributionFile = {
  version: number;
  entries: Array<{
    catalogId: string;
    name: string;
    license: string;
    attribution: string;
    source: string;
    insertedAt: string;
    key?: string;
  }>;
};

export function CreditsPanel({ projectPath }: CreditsPanelProps) {
  const [data, setData] = useState<AttributionFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getBlockforgeApi().listAttribution(projectPath);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [projectPath]);

  return (
    <div>
      <p className="ws-dock-lede">
        Out-of-game attribution for inserted catalog assets. Blockforge also writes{" "}
        <code>ATTRIBUTION.md</code> in the project root. Catalog is <strong>CC0 only</strong> —
        keep this file with the repo. Cloud sync / community share below write local snapshots
        only (not a remote CDN).
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      {!data || data.entries.length === 0 ? (
        <p className="muted">No attributed assets yet. Import from Assets to record credits.</p>
      ) : (
        <ul style={{ paddingLeft: "1.1rem" }}>
          {data.entries.map((row) => (
            <li key={`${row.catalogId}-${row.key ?? ""}`} style={{ marginBottom: "0.75rem" }}>
              <strong>{row.name}</strong>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {row.license} · {row.attribution}
              </div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                {row.source}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ marginTop: "1rem", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            void getBlockforgeApi()
              .cloudSyncPush(projectPath)
              .then((r) => setError(r.success ? r.detail : r.message))
          }
        >
          Export local snapshot
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            void getBlockforgeApi()
              .communitySharePack(projectPath)
              .then((r) => setError(r.success ? r.detail : r.message))
          }
        >
          Local community manifest
        </button>
      </div>
    </div>
  );
}

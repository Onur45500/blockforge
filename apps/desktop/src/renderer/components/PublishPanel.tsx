import { useEffect, useState } from "react";
import type { OpenCloudSettings, PublishResult } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";

type PublishPanelProps = {
  projectPath: string;
  onOpenSettings?: () => void;
};

export function PublishPanel({ projectPath, onOpenSettings }: PublishPanelProps) {
  const [versionType, setVersionType] = useState<"Published" | "Saved">("Published");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [settings, setSettings] = useState<OpenCloudSettings | null>(null);

  useEffect(() => {
    void getBlockforgeApi()
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const missing: string[] = [];
  if (settings) {
    if (!settings.hasApiKey) missing.push("Open Cloud API key");
    if (!settings.universeId.trim()) missing.push("Universe ID");
    if (!settings.placeId.trim()) missing.push("Place ID");
  }
  const canPublish = settings !== null && missing.length === 0;

  const handlePublish = async (): Promise<void> => {
    setLoading(true);
    setResult(null);
    try {
      const response = await getBlockforgeApi().publishPlace({
        projectPath,
        versionType,
      });
      setResult(response);
      if (response.success) {
        const refreshed = await getBlockforgeApi().getSettings();
        setSettings(refreshed);
      }
    } finally {
      setLoading(false);
    }
  };

  const placeUrl =
    settings?.placeId && result?.success
      ? `https://www.roblox.com/games/${settings.placeId}`
      : null;

  return (
    <div>
      <p className="ws-dock-lede">
        Runs <code>rojo build</code> then uploads the place via Open Cloud.
      </p>

      {!canPublish && settings ? (
        <p className="muted">
          Missing {missing.join(", ")}.{" "}
          {onOpenSettings ? (
            <button
              type="button"
              className="btn ghost compact"
              onClick={onOpenSettings}
            >
              Open Settings
            </button>
          ) : (
            "Configure them in Settings."
          )}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="version-type">Version type</label>
        <select
          id="version-type"
          value={versionType}
          onChange={(e) => setVersionType(e.target.value as "Published" | "Saved")}
        >
          <option value="Published">Published</option>
          <option value="Saved">Saved</option>
        </select>
      </div>

      <button
        type="button"
        className="btn"
        disabled={loading || !canPublish}
        onClick={() => void handlePublish()}
      >
        {loading ? "Publishing…" : "Publish place"}
      </button>

      {result?.success ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p className="success-text" style={{ marginBottom: "0.35rem" }}>
            Published version {result.versionNumber}
          </p>
          {placeUrl ? (
            <p className="muted" style={{ margin: 0 }}>
              <a href={placeUrl} target="_blank" rel="noreferrer">
                Open place on Roblox
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {result && !result.success ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p className="error-text">{result.error.message}</p>
          {"guidance" in result.error && result.error.guidance ? (
            <p className="muted">{result.error.guidance}</p>
          ) : null}
          {result.error.kind === "rate_limited" ? (
            <p className="muted">
              Retry after ~{Math.round(result.error.retryAfterMs / 1000)}s
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

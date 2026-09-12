import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssetCatalog,
  AssetCatalogEntry,
  AssetPreviewResult,
  ProjectAssetsFile,
} from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";
import { ModelPreviewCanvas } from "./ModelPreviewCanvas";

type AssetGridProps = {
  projectPath: string;
};

const HOVER_DELAY_MS = 180;
const PAGE_SIZE = 24;

function AssetHoverPreview({
  asset,
  preview,
  loading,
}: {
  asset: AssetCatalogEntry;
  preview: AssetPreviewResult | null;
  loading: boolean;
}) {
  return (
    <div className="asset-hover-preview" role="tooltip">
      <div className="asset-hover-preview-media">
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && preview?.kind === "image" ? (
          <img
            className="asset-preview-image"
            src={preview.dataUrl}
            alt={asset.name}
          />
        ) : null}
        {!loading && preview?.kind === "audio" ? (
          <audio className="asset-preview-audio" controls src={preview.dataUrl} />
        ) : null}
        {!loading && preview?.kind === "model" ? (
          <ModelPreviewCanvas dataUrl={preview.dataUrl} format={preview.format} />
        ) : null}
        {!loading && preview?.kind === "none" ? (
          <p className="muted">{preview.reason}</p>
        ) : null}
        {!loading && !preview ? (
          <p className="muted">No preview</p>
        ) : null}
      </div>
      <div className="asset-hover-preview-meta">
        <strong>{asset.name}</strong>
        <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
          {asset.type}
          {asset.category ? ` · ${asset.category}` : ""}
          {asset.license ? ` · ${asset.license}` : ""}
        </div>
        {asset.attribution ? (
          <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
            {asset.attribution}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AssetGrid({ projectPath }: AssetGridProps) {
  const [catalog, setCatalog] = useState<AssetCatalog | null>(null);
  const [projectAssets, setProjectAssets] = useState<ProjectAssetsFile | null>(null);
  const [importKey, setImportKey] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewCache, setPreviewCache] = useState<
    Record<string, AssetPreviewResult>
  >({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [packDetail, setPackDetail] = useState<string | null>(null);
  const [genPrompt, setGenPrompt] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const hoverTarget = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [cat, proj] = await Promise.all([
      getBlockforgeApi().getAssetCatalog(),
      getBlockforgeApi().listProjectAssets(projectPath),
    ]);
    setCatalog(cat);
    setProjectAssets(proj);
    if (!selectedId && cat.assets.length > 0) {
      const first = cat.assets[0];
      if (first) {
        setSelectedId(first.id);
      }
    }
  }, [projectPath, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current != null) {
        window.clearTimeout(hoverTimer.current);
      }
    };
  }, []);

  const loadPreview = useCallback(
    async (assetId: string): Promise<void> => {
      if (previewCache[assetId]) {
        return;
      }
      setPreviewLoadingId(assetId);
      try {
        const result = await getBlockforgeApi().getAssetPreview({
          catalogAssetId: assetId,
        });
        setPreviewCache((prev) => ({ ...prev, [assetId]: result }));
      } catch (err) {
        setPreviewCache((prev) => ({
          ...prev,
          [assetId]: {
            kind: "none",
            reason: err instanceof Error ? err.message : String(err),
          },
        }));
      } finally {
        setPreviewLoadingId((current) => (current === assetId ? null : current));
      }
    },
    [previewCache],
  );

  const scheduleHover = (assetId: string): void => {
    hoverTarget.current = assetId;
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
    }
    hoverTimer.current = window.setTimeout(() => {
      if (hoverTarget.current !== assetId) {
        return;
      }
      setHoveredId(assetId);
      void loadPreview(assetId);
    }, HOVER_DELAY_MS);
  };

  const clearHover = (assetId: string): void => {
    if (hoverTarget.current === assetId) {
      hoverTarget.current = null;
    }
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoveredId((current) => (current === assetId ? null : current));
  };

  const filtered =
    catalog?.assets.filter((asset) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.id.toLowerCase().includes(q) ||
        asset.tags.some((t) => t.toLowerCase().includes(q))
      );
    }) ?? [];

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    setHoveredId(null);
  }, [query]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  useEffect(() => {
    setHoveredId(null);
  }, [safePage]);

  const handleImport = async (): Promise<void> => {
    if (!selectedId || !importKey.trim()) {
      setMessage("Select a catalog asset and provide an asset key.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await getBlockforgeApi().importAsset({
        projectPath,
        catalogAssetId: selectedId,
        key: importKey.trim(),
      });
      if (result.success) {
        setMessage(`Uploaded ${result.key} → rbxassetid://${result.assetId}`);
        setImportKey("");
        await refresh();
      } else {
        setMessage(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const selected = catalog?.assets.find((a) => a.id === selectedId);

  return (
    <div>
      <section className="ws-dock-section">
        <h3>Asset bank</h3>
        <p className="muted">
          CC0 catalog. Hover an asset for preview. Click to select for import.
        </p>
        <input
          type="search"
          placeholder="Search assets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem" }}
        />
        {catalog && catalog.assets.length === 0 ? (
          <p className="muted">
            Catalog is empty. Run{" "}
            <code>pnpm --filter @blockforge/asset-bank ingest</code>.
          </p>
        ) : filtered.length === 0 ? (
          <p className="muted">No assets match this search.</p>
        ) : (
          <>
            <div className="asset-grid">
              {pageItems.map((asset) => {
                const showPreview = hoveredId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`asset-card-wrap${showPreview ? " previewing" : ""}`}
                    onMouseEnter={() => scheduleHover(asset.id)}
                    onMouseLeave={() => clearHover(asset.id)}
                    onFocus={() => scheduleHover(asset.id)}
                    onBlur={() => clearHover(asset.id)}
                  >
                    <button
                      type="button"
                      className={`asset-card${asset.id === selectedId ? " selected" : ""}`}
                      onClick={() => setSelectedId(asset.id)}
                    >
                      <h4>{asset.name}</h4>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {asset.type}
                        {!asset.uploadSupported ? " · preview only" : ""}
                        {asset.filePath ? "" : " · metadata"}
                        {" · "}
                        {asset.tags.slice(0, 3).join(", ") || "untagged"}
                      </div>
                    </button>
                    {showPreview ? (
                      <AssetHoverPreview
                        asset={asset}
                        preview={previewCache[asset.id] ?? null}
                        loading={previewLoadingId === asset.id && !previewCache[asset.id]}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="asset-pagination">
              <button
                type="button"
                className="btn secondary"
                disabled={safePage <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <span className="muted asset-pagination-label">
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
                {pageCount > 1 ? ` · page ${safePage + 1}/${pageCount}` : ""}
              </span>
              <button
                type="button"
                className="btn secondary"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <section className="ws-dock-section">
        <h3>Import to project</h3>
        <p className="muted">
          MVP supports <strong>.fbx</strong> and <strong>.png</strong> uploads only. Audio is
          rejected (quota / preview-only).
        </p>
        {selected ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Selected: {selected.name}
            {selected.filePath ? ` (${selected.filePath})` : " — no local file yet"}
            {!selected.uploadSupported ? " — preview only" : ""}
          </p>
        ) : null}
        <div className="row">
          <input
            type="text"
            placeholder="asset key e.g. kenney_crate"
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            style={{ minWidth: "220px" }}
          />
          <button
            type="button"
            className="btn"
            disabled={loading || !selectedId || selected?.uploadSupported === false}
            onClick={() => void handleImport()}
          >
            {loading ? "Uploading…" : "Upload & register"}
          </button>
        </div>
        {message ? (
          <p
            className={message.includes("rbxassetid") ? "success-text" : "error-text"}
            style={{ marginTop: "0.65rem" }}
          >
            {message}
          </p>
        ) : null}
      </section>

      <section className="ws-dock-section">
        <h3>Project assets</h3>
        {projectAssets && Object.keys(projectAssets.assets).length === 0 ? (
          <p className="muted">No uploaded assets in this project yet.</p>
        ) : (
          <ul className="list">
            {projectAssets
              ? Object.values(projectAssets.assets).map((asset) => (
                  <li key={asset.key}>
                    <div>
                      <strong>{asset.key}</strong>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        rbxassetid://{asset.assetId} · {asset.displayName}
                      </div>
                    </div>
                  </li>
                ))
              : null}
          </ul>
        )}
      </section>

      <details className="ws-dock-section">
        <summary>CDN asset pack</summary>
        <p className="muted">
          Download/cache the Releases pack (sha256 verified). Uses local build-pack artifact when
          no remote URL is configured. Prefer catalog entries tagged <code>importable</code>.
        </p>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void (async () => {
                setPackDetail("Downloading…");
                const status = await getBlockforgeApi().downloadAssetPack();
                setPackDetail(`${status.status}: ${status.detail}`);
                await refresh();
              })()
            }
          >
            Download / cache pack
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void (async () => {
                const result = await getBlockforgeApi().activateStylePack({
                  projectPath,
                  packId: "lowpoly-nature",
                });
                setMessage(result.success ? result.detail : result.message);
              })()
            }
          >
            Activate lowpoly-nature style pack
          </button>
        </div>
        {packDetail ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {packDetail}
          </p>
        ) : null}
      </details>

      <details className="ws-dock-section">
        <summary>AI generate (user keys)</summary>
        <p className="muted">
          Uses Gemini key from Settings. Never Blockforge-hosted keys.
        </p>
        <input
          type="text"
          placeholder="Prompt (e.g. flat icon of a golden coin)"
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          style={{ width: "100%", marginBottom: "0.5rem" }}
        />
        <button
          type="button"
          className="btn"
          disabled={genBusy || genPrompt.trim().length === 0}
          onClick={() =>
            void (async () => {
              setGenBusy(true);
              setMessage(null);
              try {
                const result = await getBlockforgeApi().generateAsset({
                  projectPath,
                  provider: "gemini",
                  prompt: genPrompt,
                });
                setMessage(
                  result.success
                    ? `${result.detail} → ${result.outputPath}`
                    : result.message,
                );
              } finally {
                setGenBusy(false);
              }
            })()
          }
        >
          {genBusy ? "Generating…" : "Generate with Gemini"}
        </button>
      </details>
    </div>
  );
}

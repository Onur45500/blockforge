import { useEffect, useState } from "react";
import type { DoctorReport, InstallBridgePluginResult } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";

export function DoctorPage() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [installBusy, setInstallBusy] = useState(false);
  const [installResult, setInstallResult] = useState<InstallBridgePluginResult | null>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    const result = await getBlockforgeApi().runDoctor();
    setReport(result);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const result = await getBlockforgeApi().runDoctor();
      if (!cancelled) {
        setReport(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInstallBridge = async (): Promise<void> => {
    setInstallBusy(true);
    setInstallResult(null);
    try {
      const result = await getBlockforgeApi().installBridgePlugin();
      setInstallResult(result);
      await refresh();
    } finally {
      setInstallBusy(false);
    }
  };

  return (
    <div>
      <p className="ws-dock-lede">
        Checks local tooling required for Blockforge on {report?.platform ?? "…"}.
      </p>

      <section className="ws-dock-section">
        {loading ? (
          <p className="muted">Running checks…</p>
        ) : (
          <ul className="list">
            {report?.checks.map((check) => (
              <li key={check.id}>
                <div>
                  <strong>{check.label}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {check.detail}
                  </div>
                  {check.installGuidance ? (
                    <div style={{ marginTop: "0.35rem", fontFamily: "var(--mono)", fontSize: "0.8rem" }}>
                      {check.installGuidance}
                    </div>
                  ) : null}
                </div>
                <span className={`badge ${check.status}`}>{check.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ws-dock-section">
        <h3>Studio MCP (recommended)</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Primary live Studio channel: enable in Studio Assistant Settings → MCP Servers.
          Blockforge writes a single <code>blockforge</code> entry in{" "}
          <code>.mcp.json</code> and proxies official Studio MCP through the host mux
          (catalog generation shown here). Disk + Rojo stay source of truth — MCP is
          for inspect/playtest, not permanent Studio-only edits. Debug:{" "}
          <code>BLOCKFORGE_MCP_DIRECT_STUDIO=1</code>. See{" "}
          <code>https://create.roblox.com/docs/studio/mcp</code>.
        </p>
      </section>

      <section className="ws-dock-section">
        <h3>Studio Output bridge (fallback)</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Installs <code>BlockforgeBridge.lua</code> into the Roblox Plugins folder so Play errors
          stream to <code>.blockforge/studio-output.jsonl</code> when Studio MCP is unavailable.
        </p>
        <button
          type="button"
          className="btn"
          disabled={installBusy}
          onClick={() => void handleInstallBridge()}
        >
          {installBusy ? "Installing…" : "Install bridge plugin"}
        </button>
        {installResult ? (
          <p
            className={installResult.success ? "muted" : "error-text"}
            style={{ marginBottom: 0, marginTop: "0.5rem" }}
          >
            {installResult.success
              ? `Installed to ${installResult.path}. Restart Studio if it was already open.`
              : installResult.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

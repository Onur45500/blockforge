import { useEffect, useState } from "react";
import type { AgentId, AgentModelId, OpenCloudSettings } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";

export function SettingsPage({
  focusSection,
}: {
  focusSection?: "open_cloud" | "asset_upload" | null;
}) {
  const [settings, setSettings] = useState<OpenCloudSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [assetUploadApiKey, setAssetUploadApiKey] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [userId, setUserId] = useState("");
  const [agentModel, setAgentModel] = useState<AgentModelId>("sonnet");
  const [defaultAgentId, setDefaultAgentId] = useState<AgentId>("claude-code");
  const [runInWsl, setRunInWsl] = useState(false);
  const [agentTeams, setAgentTeams] = useState(true);
  const [preferStudioMcp, setPreferStudioMcp] = useState(true);
  const [experimentalSyncback, setExperimentalSyncback] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const current = await getBlockforgeApi().getSettings();
      setSettings(current);
      setUniverseId(current.universeId);
      setPlaceId(current.placeId);
      setUserId(current.userId);
      setAgentModel(current.agentModel ?? "sonnet");
      setDefaultAgentId(current.defaultAgentId ?? "claude-code");
      setRunInWsl(current.runInWsl === true);
      setAgentTeams(current.agentTeams !== false);
      setPreferStudioMcp(current.preferStudioMcp !== false);
      setExperimentalSyncback(current.experimentalSyncback === true);
      const info = await getBlockforgeApi().getAppInfo();
      setAppVersion(info.version);
    })();
  }, []);

  useEffect(() => {
    if (!focusSection) return;
    const id =
      focusSection === "asset_upload" ? "settings-asset-key" : "settings-oc-key";
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      (document.getElementById(id) as HTMLInputElement | null)?.focus();
    }, 50);
  }, [focusSection]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await getBlockforgeApi().setSettings({
        apiKey: apiKey.trim().length > 0 ? apiKey : undefined,
        assetUploadApiKey:
          assetUploadApiKey.trim().length > 0 ? assetUploadApiKey : undefined,
        universeId,
        placeId,
        userId,
        agentModel,
        defaultAgentId,
        runInWsl,
        agentTeams,
        preferStudioMcp,
        experimentalSyncback,
        geminiApiKey: geminiApiKey.trim().length > 0 ? geminiApiKey : undefined,
      });
      setSettings(updated);
      setApiKey("");
      setAssetUploadApiKey("");
      setGeminiApiKey("");
      setMessage("Settings saved. Secrets are encrypted with OS safeStorage.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <section className="ws-dock-section">
        <h3>About</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          Blockforge {appVersion ? `v${appVersion}` : "…"}
        </p>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
          Packaged builds check GitHub Releases on launch. Click Update to download
          and restart into the new version.
        </p>
      </section>
      <section className="ws-dock-section">
        <h3>Agents</h3>
        <div className="field">
          <label htmlFor="default-agent">Default agent</label>
          <select
            id="default-agent"
            value={defaultAgentId}
            onChange={(e) => setDefaultAgentId(e.target.value as AgentId)}
          >
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="opencode">OpenCode</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="agent-model">Claude model</label>
          <select
            id="agent-model"
            value={agentModel}
            onChange={(e) => setAgentModel(e.target.value as AgentModelId)}
          >
            <option value="sonnet">Sonnet (recommended)</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku (not recommended for game building)</option>
          </select>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
            Blockforge passes <code>--model</code> for Claude Code so a global Haiku
            default cannot override this.
          </p>
        </div>
        <div className="field">
          <label htmlFor="agent-teams">
            <input
              id="agent-teams"
              type="checkbox"
              checked={agentTeams}
              onChange={(e) => setAgentTeams(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Swarm Mode — Lead Claude + Agent Teams
          </label>
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
            Enables <code>CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS</code>. Copy the swarm
            starter from Cmd+K or the Agents dock.
          </p>
        </div>
        <div className="field">
          <label htmlFor="prefer-studio-mcp">
            <input
              id="prefer-studio-mcp"
              type="checkbox"
              checked={preferStudioMcp}
              onChange={(e) => setPreferStudioMcp(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Prefer Studio MCP for Play verification
          </label>
        </div>
        <div className="field">
          <label htmlFor="run-in-wsl">
            <input
              id="run-in-wsl"
              type="checkbox"
              checked={runInWsl}
              onChange={(e) => setRunInWsl(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Run agents in WSL2 (sandbox tier 1, Windows)
          </label>
        </div>
        <div className="field">
          <label htmlFor="syncback">
            <input
              id="syncback"
              type="checkbox"
              checked={experimentalSyncback}
              onChange={(e) => setExperimentalSyncback(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Experimental Rojo syncback (Studio → disk)
          </label>
        </div>
      </section>

      <section className="ws-dock-section">
        <h3>Roblox</h3>
        <p className="ws-dock-lede">
          Create an API key at create.roblox.com/dashboard/credentials with{" "}
          <strong>universe-places:write</strong> and <strong>asset:write</strong> (plus
          asset:read). Keys are encrypted with Electron <code>safeStorage</code>.
        </p>
        <div className="field">
          <label htmlFor="settings-oc-key">Open Cloud API key (publish + monetization)</label>
          <input
            id="settings-oc-key"
            type="password"
            placeholder={settings?.hasApiKey ? "•••••••• (stored)" : "Paste Open Cloud API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="settings-asset-key">Asset upload API key</label>
          <input
            id="settings-asset-key"
            type="password"
            placeholder={
              settings?.hasAssetUploadApiKey
                ? "•••••••• (stored)"
                : "Optional — falls back to Open Cloud key"
            }
            value={assetUploadApiKey}
            onChange={(e) => setAssetUploadApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="universe-id">Universe ID</label>
          <input
            id="universe-id"
            value={universeId}
            onChange={(e) => setUniverseId(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="place-id">Place ID</label>
          <input
            id="place-id"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="user-id">Roblox user ID (asset creator)</label>
          <input
            id="user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
      </section>

      <section className="ws-dock-section">
        <h3>Generation providers</h3>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Keys stay on your machine. Blockforge never resells coding-agent access.
        </p>
        <div className="field">
          <label htmlFor="gemini-key">Gemini API key (images/icons)</label>
          <input
            id="gemini-key"
            type="password"
            placeholder={
              settings?.hasGeminiApiKey ? "•••••••• (stored)" : "Paste Gemini key"
            }
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Meshy / ElevenLabs: not yet supported.
        </p>

        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message ? (
          <p
            className={message.startsWith("Settings saved") ? "success-text" : "error-text"}
            style={{ marginTop: "0.75rem" }}
          >
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

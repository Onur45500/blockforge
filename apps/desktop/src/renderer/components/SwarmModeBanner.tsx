import { useState } from "react";
import { getBlockforgeApi } from "../lib/api";
import { NoticeCard } from "./NoticeCard";

const SWARM_STARTER = `Spawn an agent team for this Roblox game request:
1. world-builder — scenery in world/*.model.json (Anchored, SpawnLocation, walkable)
2. gameplay-coder — TypeScript under src/ wiring exact world Names
3. qa-verifier — run npm run build / validate:world / validate:refs; if Studio MCP is connected, list_roblox_studios and playtest/console with studio_id; else read .blockforge/studio-*.json*; refuse incomplete work
Lead: create dependent tasks (world before WaitForChild). Prefer Studio MCP for Play verification; filesystem remains source of truth (no permanent Studio-only scenery). Synthesize and only declare done when gates pass and Play-trace is written.`;

type SwarmModeBannerProps = {
  /** Shown above Claude Code terminal only */
  visible?: boolean;
  onDismiss?: () => void;
};

export function SwarmModeBanner({ visible = true, onDismiss }: SwarmModeBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!visible) {
    return null;
  }

  const copyStarter = async (): Promise<void> => {
    await getBlockforgeApi().clipboardWrite(SWARM_STARTER);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <NoticeCard
      title="Swarm Mode (Lead Claude)"
      onDismiss={onDismiss}
      actions={
        <button type="button" className="btn secondary compact" onClick={() => void copyStarter()}>
          {copied ? "Copied starter prompt" : "Copy swarm starter prompt"}
        </button>
      }
    >
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Your Claude Code tab is the <em>lead</em>. It can spawn Agent Teams teammates (
        <code>world-builder</code>, <code>gameplay-coder</code>, <code>qa-verifier</code>) that work
        in parallel. Prefer <strong>Studio MCP</strong> for Play verification when connected; the
        Blockforge bridge is the fallback. Disk + Rojo stay source of truth.
      </p>
    </NoticeCard>
  );
}

export { SWARM_STARTER };

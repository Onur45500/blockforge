import { useEffect, useState } from "react";
import type { AssetChoicePending } from "../../shared/ipc-types";
import { getBlockforgeApi } from "../lib/api";

export function AssetChoiceOverlay() {
  const [pending, setPending] = useState<AssetChoicePending | null>(null);

  useEffect(() => {
    return getBlockforgeApi().onAssetChoicePending((event) => {
      setPending(event);
    });
  }, []);

  if (!pending) {
    return null;
  }

  return (
    <div className="ws-overlay-backdrop" role="presentation">
      <div className="ws-overlay asset-choice-overlay" role="dialog" aria-label="Choose asset">
        <header className="ws-drawer-header">
          <h2>Choose an option</h2>
          <button
            type="button"
            className="btn ghost compact"
            onClick={() => {
              void getBlockforgeApi()
                .cancelAssetChoice({
                  choiceId: pending.choiceId,
                  reason: "user_dismissed",
                })
                .then(() => setPending(null));
            }}
          >
            Cancel
          </button>
        </header>
        {pending.prompt ? <p className="muted">{pending.prompt}</p> : null}
        <div className="asset-choice-grid">
          {pending.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="asset-choice-card"
              onClick={() => {
                void getBlockforgeApi()
                  .resolveAssetChoice({
                    choiceId: pending.choiceId,
                    optionId: opt.id,
                  })
                  .then(() => setPending(null));
              }}
            >
              {opt.previewPath ? (
                <img src={`file://${opt.previewPath}`} alt="" className="asset-choice-preview" />
              ) : (
                <div className="asset-choice-preview placeholder" />
              )}
              <strong>{opt.label}</strong>
              {opt.detail ? <span className="muted">{opt.detail}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

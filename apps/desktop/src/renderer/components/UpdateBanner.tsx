import type { UpdateCheckResult } from "../../shared/ipc-types";

type UpdateBannerProps = {
  result: UpdateCheckResult | null;
  busy: boolean;
  onUpdate: () => void;
};

export function UpdateBanner({ result, busy, onUpdate }: UpdateBannerProps) {
  if (!result?.packaged || !result.available) {
    return null;
  }

  return (
    <div className="update-banner" role="status">
      <p className="update-banner-copy">
        {result.latestVersion
          ? `Version ${result.latestVersion} is available (you have ${result.currentVersion}).`
          : result.detail}
      </p>
      <button
        type="button"
        className="btn compact"
        disabled={busy}
        onClick={onUpdate}
      >
        {busy ? "Updating…" : "Update"}
      </button>
    </div>
  );
}

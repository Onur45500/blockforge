export type AssetType = "Decal" | "Model" | "Audio" | "Image";

export type OpenCloudConfig = {
  apiKey: string;
  baseUrl?: string;
};

export type CreateAssetInput = {
  assetType: AssetType;
  displayName: string;
  description: string;
  filePath: string;
  /** User or group creator. Defaults to user if omitted and userId provided. */
  creator?:
    | { userId: number }
    | { groupId: number };
};

export type OperationStatus = {
  path: string;
  done: boolean;
  error?: { code?: number; message?: string };
  response?: {
    assetId?: string | number;
    path?: string;
    moderationResult?: { moderationState?: string };
  };
};

export type PublishPlaceInput = {
  universeId: string | number;
  placeId: string | number;
  placeFilePath: string;
  versionType?: "Published" | "Saved";
};

export type PublishPlaceResult = {
  versionNumber: number;
};

export class OpenCloudError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "OpenCloudError";
    this.status = status;
    this.body = body;
  }
}

export type MappedApiError =
  | { kind: "unauthorized"; message: string; guidance: string }
  | { kind: "rate_limited"; message: string; retryAfterMs: number }
  | { kind: "not_found"; message: string }
  | { kind: "conflict"; message: string; guidance: string }
  | { kind: "moderation"; message: string }
  | { kind: "unknown"; message: string; status: number };

function robloxBodyMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: string; Message?: string };
    const msg = parsed.message ?? parsed.Message;
    return typeof msg === "string" && msg.trim() ? msg.trim() : null;
  } catch {
    const trimmed = body.trim();
    return trimmed.length > 0 && trimmed.length < 500 ? trimmed : null;
  }
}

export function mapOpenCloudError(error: unknown): MappedApiError {
  if (!(error instanceof OpenCloudError)) {
    return {
      kind: "unknown",
      message: error instanceof Error ? error.message : String(error),
      status: 0,
    };
  }

  const bodyMessage = robloxBodyMessage(error.body);

  if (error.status === 401 || error.status === 403) {
    return {
      kind: "unauthorized",
      message: bodyMessage ?? error.message,
      guidance:
        "Re-create your Open Cloud API key with universe-places:write for this experience. Check IP allowlist if set.",
    };
  }

  if (error.status === 429) {
    const retryMatch = /retry.?after[=:\s]+(\d+)/i.exec(error.body);
    const retryAfterMs = retryMatch ? Number(retryMatch[1]) * 1000 : 5000;
    return {
      kind: "rate_limited",
      message: bodyMessage ?? error.message,
      retryAfterMs,
    };
  }

  if (error.status === 404) {
    return {
      kind: "not_found",
      message:
        bodyMessage ??
        "Universe or place not found. Check Universe ID and Place ID in Settings.",
    };
  }

  if (error.status === 409) {
    return {
      kind: "conflict",
      message: bodyMessage ?? error.message,
      guidance:
        "Usually: (1) Place ID is not in that Universe ID, (2) Team Create / Studio has an active edit session on the place — leave the session then retry, or (3) Roblox is briefly busy — wait a minute and retry.",
    };
  }

  if (/moderat/i.test(error.body) || /moderat/i.test(error.message)) {
    return { kind: "moderation", message: bodyMessage ?? error.message };
  }

  return {
    kind: "unknown",
    message: bodyMessage ? `${error.message}: ${bodyMessage}` : error.message,
    status: error.status,
  };
}

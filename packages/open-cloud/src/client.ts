import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import {
  CreateAssetInput,
  OpenCloudConfig,
  OpenCloudError,
  OperationStatus,
  PublishPlaceInput,
  PublishPlaceResult,
} from "./types.js";

const DEFAULT_BASE = "https://apis.roblox.com";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function contentTypeForFile(filePath: string, assetType: string): string {
  const ext = extname(filePath).toLowerCase();
  if (assetType === "Model") {
    if (ext === ".fbx") return "model/fbx";
    if (ext === ".gltf") return "model/gltf+json";
    if (ext === ".glb") return "model/gltf-binary";
    throw new Error(`Unsupported model extension ${ext}. Assets API requires fbx/gltf/glb.`);
  }
  if (assetType === "Decal" || assetType === "Image") {
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".bmp") return "image/bmp";
    if (ext === ".tga") return "image/tga";
    throw new Error(`Unsupported image extension ${ext}`);
  }
  if (assetType === "Audio") {
    if (ext === ".mp3") return "audio/mpeg";
    if (ext === ".ogg") return "audio/ogg";
    throw new Error(`Unsupported audio extension ${ext}`);
  }
  throw new Error(`Unknown asset type ${assetType}`);
}

export class OpenCloudClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenCloudConfig) {
    if (!config.apiKey) {
      throw new Error("Open Cloud API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      ...extra,
    };
  }

  async request(
    method: string,
    path: string,
    init?: {
      headers?: Record<string, string>;
      body?: ArrayBuffer | Uint8Array | Blob | FormData | string | null;
      retryOn429?: boolean;
    },
  ): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const retryOn429 = init?.retryOn429 ?? true;
    let attempt = 0;
    let delayMs = 1000;

    while (true) {
      const response = await fetch(url, {
        method,
        headers: this.headers(init?.headers),
        body: init?.body,
      });

      if (response.status !== 429 || !retryOn429 || attempt >= 5) {
        return response;
      }

      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const wait = retryAfter > 0 ? retryAfter * 1000 : delayMs;
      await sleep(wait);
      delayMs = Math.min(delayMs * 2, 30_000);
      attempt += 1;
    }
  }

  async createAsset(input: CreateAssetInput): Promise<OperationStatus> {
    const fileBytes = await readFile(input.filePath);
    const contentType = contentTypeForFile(input.filePath, input.assetType);
    const form = new FormData();

    const creator = input.creator ?? undefined;
    if (!creator) {
      throw new Error("createAsset requires creator.userId or creator.groupId");
    }

    const requestPayload = {
      assetType: input.assetType,
      displayName: input.displayName,
      description: input.description,
      creationContext: {
        creator:
          "userId" in creator
            ? { userId: creator.userId }
            : { groupId: creator.groupId },
      },
    };

    form.append("request", JSON.stringify(requestPayload));
    form.append(
      "fileContent",
      new Blob([new Uint8Array(fileBytes)], { type: contentType }),
      basename(input.filePath),
    );

    const response = await this.request("POST", "/assets/v1/assets", {
      body: form,
    });

    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Asset upload failed (${response.status})`,
        response.status,
        body,
      );
    }

    return JSON.parse(body) as OperationStatus;
  }

  async getOperation(operationPathOrId: string): Promise<OperationStatus> {
    const path = operationPathOrId.startsWith("operations/")
      ? `/assets/v1/${operationPathOrId}`
      : operationPathOrId.startsWith("/assets/")
        ? operationPathOrId
        : `/assets/v1/operations/${operationPathOrId}`;

    const response = await this.request("GET", path);
    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Operation poll failed (${response.status})`,
        response.status,
        body,
      );
    }
    return JSON.parse(body) as OperationStatus;
  }

  async pollOperation(
    operationPathOrId: string,
    options?: { maxAttempts?: number; initialDelayMs?: number },
  ): Promise<OperationStatus> {
    const maxAttempts = options?.maxAttempts ?? 20;
    let delayMs = options?.initialDelayMs ?? 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, 15_000);
      }
      const status = await this.getOperation(operationPathOrId);
      if (status.done) {
        if (status.error) {
          throw new OpenCloudError(
            status.error.message ?? "Asset operation failed",
            status.error.code ?? 500,
            JSON.stringify(status),
          );
        }
        return status;
      }
    }

    throw new OpenCloudError(
      "Timed out waiting for asset operation",
      408,
      operationPathOrId,
    );
  }

  async uploadAssetAndWait(input: CreateAssetInput): Promise<{
    assetId: string;
    operation: OperationStatus;
  }> {
    const started = await this.createAsset(input);
    if (!started.path) {
      throw new OpenCloudError("Asset create response missing path", 500, JSON.stringify(started));
    }
    const operation = await this.pollOperation(started.path);
    const assetIdRaw =
      operation.response?.assetId ??
      operation.response?.path?.replace(/^assets\//, "");
    if (assetIdRaw === undefined || assetIdRaw === null) {
      throw new OpenCloudError(
        "Asset operation completed without assetId",
        500,
        JSON.stringify(operation),
      );
    }
    return { assetId: String(assetIdRaw), operation };
  }

  async publishPlace(input: PublishPlaceInput): Promise<PublishPlaceResult> {
    const bytes = await readFile(input.placeFilePath);
    const versionType = input.versionType ?? "Published";
    const path = `/universes/v1/${input.universeId}/places/${input.placeId}/versions?versionType=${versionType}`;

    const response = await this.request("POST", path, {
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(bytes),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Place publish failed (${response.status})`,
        response.status,
        body,
      );
    }

    const parsed = JSON.parse(body) as { versionNumber?: number };
    if (typeof parsed.versionNumber !== "number") {
      throw new OpenCloudError("Publish response missing versionNumber", 500, body);
    }
    return { versionNumber: parsed.versionNumber };
  }

  /**
   * Developer product scaffolding via Open Cloud.
   * Endpoint surface varies by Roblox API version; failures bubble to callers
   * who may fall back to local monetization.json.
   */
  async createDeveloperProduct(input: {
    universeId: string | number;
    name: string;
    description: string;
    priceInRobux: number;
  }): Promise<{ id: string }> {
    const path = `/developer-products/v1/universes/${input.universeId}/developerproducts`;
    const response = await this.request("POST", path, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        priceInRobux: input.priceInRobux,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Developer product create failed (${response.status})`,
        response.status,
        body,
      );
    }
    const parsed = JSON.parse(body) as { id?: string | number; productId?: string | number };
    const id = parsed.id ?? parsed.productId;
    if (id === undefined) {
      throw new OpenCloudError("Developer product response missing id", 500, body);
    }
    return { id: String(id) };
  }

  async listDeveloperProducts(universeId: string | number): Promise<Array<{ id: string; name: string }>> {
    const path = `/developer-products/v1/universes/${universeId}/developerproducts?limit=100`;
    const response = await this.request("GET", path);
    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Developer product list failed (${response.status})`,
        response.status,
        body,
      );
    }
    const parsed = JSON.parse(body) as {
      data?: Array<{ id?: string | number; name?: string }>;
      developerProducts?: Array<{ id?: string | number; name?: string }>;
    };
    const rows = parsed.data ?? parsed.developerProducts ?? [];
    return rows
      .filter((r) => r.id != null)
      .map((r) => ({ id: String(r.id), name: r.name ?? String(r.id) }));
  }

  async createGamePass(input: {
    universeId: string | number;
    name: string;
    description: string;
    priceInRobux: number;
  }): Promise<{ id: string }> {
    const path = `/game-passes/v1/universes/${input.universeId}/game-passes`;
    const response = await this.request("POST", path, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        priceInRobux: input.priceInRobux,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new OpenCloudError(
        `Game pass create failed (${response.status})`,
        response.status,
        body,
      );
    }
    const parsed = JSON.parse(body) as { id?: string | number; gamePassId?: string | number };
    const id = parsed.id ?? parsed.gamePassId;
    if (id === undefined) {
      throw new OpenCloudError("Game pass response missing id", 500, body);
    }
    return { id: String(id) };
  }
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import type {
  AgentId,
  AgentModelId,
  OpenCloudSettings,
  OpenCloudSettingsInput,
} from "../shared/ipc-types.js";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_AGENT_MODEL,
  isAgentId,
} from "../shared/agent-adapter.js";

type StoredSettings = {
  universeId: string;
  placeId: string;
  userId: string;
  apiKeyCiphertext?: string;
  assetUploadApiKeyCiphertext?: string;
  agentModel?: AgentModelId;
  defaultAgentId?: AgentId;
  runInWsl?: boolean;
  agentTeams?: boolean;
  preferStudioMcp?: boolean;
  geminiApiKeyCiphertext?: string;
  meshyApiKeyCiphertext?: string;
  elevenLabsApiKeyCiphertext?: string;
  experimentalSyncback?: boolean;
};

function normalizeAgentModel(value: unknown): AgentModelId {
  if (value === "sonnet" || value === "opus" || value === "haiku") {
    return value;
  }
  return DEFAULT_AGENT_MODEL;
}

function normalizeAgentId(value: unknown): AgentId {
  return isAgentId(value) ? value : DEFAULT_AGENT_ID;
}

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

async function readStored(): Promise<StoredSettings> {
  const defaults: StoredSettings = {
    universeId: "",
    placeId: "",
    userId: "",
    agentModel: DEFAULT_AGENT_MODEL,
    defaultAgentId: DEFAULT_AGENT_ID,
    runInWsl: false,
    agentTeams: true,
    preferStudioMcp: true,
    experimentalSyncback: false,
  };
  try {
    const raw = await readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      universeId: parsed.universeId ?? "",
      placeId: parsed.placeId ?? "",
      userId: parsed.userId ?? "",
      apiKeyCiphertext: parsed.apiKeyCiphertext,
      assetUploadApiKeyCiphertext: parsed.assetUploadApiKeyCiphertext,
      agentModel: normalizeAgentModel(parsed.agentModel),
      defaultAgentId: normalizeAgentId(parsed.defaultAgentId),
      runInWsl: parsed.runInWsl === true,
      agentTeams: parsed.agentTeams !== false,
      preferStudioMcp: parsed.preferStudioMcp !== false,
      geminiApiKeyCiphertext: parsed.geminiApiKeyCiphertext,
      meshyApiKeyCiphertext: parsed.meshyApiKeyCiphertext,
      elevenLabsApiKeyCiphertext: parsed.elevenLabsApiKeyCiphertext,
      experimentalSyncback: parsed.experimentalSyncback === true,
    };
  } catch {
    return defaults;
  }
}

async function writeStored(data: StoredSettings): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(data, null, 2), "utf8");
}

function decryptSecret(ciphertext: string | undefined): string | null {
  if (!ciphertext) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS encryption (safeStorage) is not available on this system");
  }
  const buffer = Buffer.from(ciphertext, "base64");
  return safeStorage.decryptString(buffer);
}

function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS encryption (safeStorage) is not available on this system");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function setOptionalSecret(
  stored: StoredSettings,
  field:
    | "apiKeyCiphertext"
    | "assetUploadApiKeyCiphertext"
    | "geminiApiKeyCiphertext"
    | "meshyApiKeyCiphertext"
    | "elevenLabsApiKeyCiphertext",
  value: string | undefined,
): void {
  if (value === undefined) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    delete stored[field];
  } else {
    stored[field] = encryptSecret(trimmed);
  }
}

export async function getOpenCloudSettings(): Promise<OpenCloudSettings> {
  const stored = await readStored();
  return {
    universeId: stored.universeId,
    placeId: stored.placeId,
    userId: stored.userId,
    hasApiKey: Boolean(stored.apiKeyCiphertext),
    hasAssetUploadApiKey: Boolean(stored.assetUploadApiKeyCiphertext),
    agentModel: normalizeAgentModel(stored.agentModel),
    defaultAgentId: normalizeAgentId(stored.defaultAgentId),
    runInWsl: stored.runInWsl === true,
    agentTeams: stored.agentTeams !== false,
    preferStudioMcp: stored.preferStudioMcp !== false,
    hasGeminiApiKey: Boolean(stored.geminiApiKeyCiphertext),
    hasMeshyApiKey: Boolean(stored.meshyApiKeyCiphertext),
    hasElevenLabsApiKey: Boolean(stored.elevenLabsApiKeyCiphertext),
    experimentalSyncback: stored.experimentalSyncback === true,
  };
}

export async function setOpenCloudSettings(
  input: OpenCloudSettingsInput,
): Promise<OpenCloudSettings> {
  const stored = await readStored();

  if (input.universeId !== undefined) {
    stored.universeId = input.universeId.trim();
  }
  if (input.placeId !== undefined) {
    stored.placeId = input.placeId.trim();
  }
  if (input.userId !== undefined) {
    stored.userId = input.userId.trim();
  }
  setOptionalSecret(stored, "apiKeyCiphertext", input.apiKey);
  setOptionalSecret(stored, "assetUploadApiKeyCiphertext", input.assetUploadApiKey);
  setOptionalSecret(stored, "geminiApiKeyCiphertext", input.geminiApiKey);
  setOptionalSecret(stored, "meshyApiKeyCiphertext", input.meshyApiKey);
  setOptionalSecret(stored, "elevenLabsApiKeyCiphertext", input.elevenLabsApiKey);
  if (input.agentModel !== undefined) {
    stored.agentModel = normalizeAgentModel(input.agentModel);
  }
  if (input.defaultAgentId !== undefined) {
    stored.defaultAgentId = normalizeAgentId(input.defaultAgentId);
  }
  if (input.runInWsl !== undefined) {
    stored.runInWsl = input.runInWsl;
  }
  if (input.agentTeams !== undefined) {
    stored.agentTeams = input.agentTeams;
  }
  if (input.preferStudioMcp !== undefined) {
    stored.preferStudioMcp = input.preferStudioMcp;
  }
  if (input.experimentalSyncback !== undefined) {
    stored.experimentalSyncback = input.experimentalSyncback;
  }

  await writeStored(stored);
  return getOpenCloudSettings();
}

export async function getDecryptedApiKey(): Promise<string | null> {
  const stored = await readStored();
  return decryptSecret(stored.apiKeyCiphertext);
}

/** Asset uploads prefer dedicated key, else fall back to Open Cloud key. */
export async function getDecryptedAssetUploadApiKey(): Promise<string | null> {
  const stored = await readStored();
  return (
    decryptSecret(stored.assetUploadApiKeyCiphertext) ??
    decryptSecret(stored.apiKeyCiphertext)
  );
}

export async function getDecryptedGeminiApiKey(): Promise<string | null> {
  const stored = await readStored();
  return decryptSecret(stored.geminiApiKeyCiphertext);
}

export async function getDecryptedMeshyApiKey(): Promise<string | null> {
  const stored = await readStored();
  return decryptSecret(stored.meshyApiKeyCiphertext);
}

export async function getDecryptedElevenLabsApiKey(): Promise<string | null> {
  const stored = await readStored();
  return decryptSecret(stored.elevenLabsApiKeyCiphertext);
}

export async function getPublishConfig(): Promise<{
  apiKey: string;
  universeId: string;
  placeId: string;
  userId: string;
} | null> {
  const stored = await readStored();
  const apiKey = decryptSecret(stored.apiKeyCiphertext);
  if (!apiKey || !stored.universeId || !stored.placeId) {
    return null;
  }
  return {
    apiKey,
    universeId: stored.universeId,
    placeId: stored.placeId,
    userId: stored.userId,
  };
}

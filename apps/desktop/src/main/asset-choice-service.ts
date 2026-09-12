import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import { IPC } from "../shared/ipc-types.js";

export type AssetChoiceOption = {
  id: string;
  label: string;
  detail?: string;
  previewPath?: string;
};

export type AssetChoicePending = {
  choiceId: string;
  projectPath: string;
  prompt?: string;
  options: AssetChoiceOption[];
};

export type AssetChoiceResult =
  | { status: "picked"; choiceId: string; optionId: string }
  | { status: "cancelled"; choiceId: string; reason: "user_dismissed" | "swarm_stopped" | "timeout" };

type Pending = {
  projectPath: string;
  resolve: (result: AssetChoiceResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Pending>();

export function requestAssetChoice(args: {
  projectPath: string;
  prompt?: string;
  options: AssetChoiceOption[];
  getWindow: (() => BrowserWindow | null) | null;
  timeoutMs?: number;
}): Promise<AssetChoiceResult> {
  const choiceId = randomUUID();
  const timeoutMs = args.timeoutMs ?? 300_000;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(choiceId);
      resolve({ status: "cancelled", choiceId, reason: "timeout" });
    }, timeoutMs);

    pending.set(choiceId, {
      projectPath: args.projectPath,
      resolve,
      timer,
    });

    const payload: AssetChoicePending = {
      choiceId,
      projectPath: args.projectPath,
      prompt: args.prompt,
      options: args.options,
    };
    args.getWindow?.()?.webContents.send(IPC.ASSET_CHOICE_PENDING, payload);
  });
}

export function resolveAssetChoice(
  choiceId: string,
  optionId: string,
): AssetChoiceResult {
  const entry = pending.get(choiceId);
  if (!entry) {
    return { status: "cancelled", choiceId, reason: "user_dismissed" };
  }
  clearTimeout(entry.timer);
  pending.delete(choiceId);
  const result: AssetChoiceResult = {
    status: "picked",
    choiceId,
    optionId,
  };
  entry.resolve(result);
  return result;
}

export function cancelAssetChoice(
  choiceId: string,
  reason: "user_dismissed" | "swarm_stopped" = "user_dismissed",
): AssetChoiceResult {
  const entry = pending.get(choiceId);
  const result: AssetChoiceResult = { status: "cancelled", choiceId, reason };
  if (!entry) {
    return result;
  }
  clearTimeout(entry.timer);
  pending.delete(choiceId);
  entry.resolve(result);
  return result;
}

export function cancelAllAssetChoices(
  reason: "user_dismissed" | "swarm_stopped" = "swarm_stopped",
): void {
  for (const choiceId of [...pending.keys()]) {
    cancelAssetChoice(choiceId, reason);
  }
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { STUDIO_STATE_STALE_MS } from "./studio-bridge.js";
import type { StudioLockManager } from "./studio-locks.js";
import type { StudioToolClient } from "./studio-mcp-mux.js";
import { jsonResult, type McpToolResult } from "./mcp-tool-catalog.js";

export type PlaytestCheckArgs = {
  hypothesis?: string;
  sessionId: string;
  projectPath: string;
  timeoutMs?: number;
  waitMs?: number;
  studioId?: string;
};

export type BridgePlaytestEvidence = {
  ok: boolean;
  stale?: boolean;
  capturedAt: string | null;
  error?: string;
  studioState: unknown;
  recentConsoleTail: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toolNames(client: StudioToolClient): Set<string> {
  return new Set(client.getCachedTools().map((t) => t.name));
}

function firstText(result: McpToolResult): string {
  return result.content.map((c) => c.text).join("\n");
}

function consoleLooksErrored(text: string): boolean {
  return /error|exception|traceback/i.test(text);
}

/**
 * Persist capture bytes/text under .blockforge/playtest/ and return a project-relative path.
 */
async function persistScreenshot(
  projectPath: string,
  sessionId: string,
  payload: string,
): Promise<string | null> {
  try {
    const dir = join(projectPath, ".blockforge", "playtest");
    await mkdir(dir, { recursive: true });
    const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    const stamp = Date.now();
    const looksBase64 =
      /^[A-Za-z0-9+/=\s]+$/.test(payload.slice(0, 200)) && payload.length > 200;
    if (looksBase64) {
      const fileName = `${safeSession}-${stamp}.png`;
      const abs = join(dir, fileName);
      await writeFile(abs, Buffer.from(payload.replace(/\s+/g, ""), "base64"));
      return `.blockforge/playtest/${fileName}`;
    }
    const fileName = `${safeSession}-${stamp}.txt`;
    const abs = join(dir, fileName);
    await writeFile(abs, payload, "utf8");
    return `.blockforge/playtest/${fileName}`;
  } catch {
    return null;
  }
}

export async function readBridgePlaytestEvidence(
  projectPath: string,
): Promise<BridgePlaytestEvidence> {
  const statePath = join(projectPath, ".blockforge", "studio-state.json");
  const logPath = join(projectPath, ".blockforge", "studio-output.jsonl");
  let stateRaw = "";
  let logRaw = "";
  try {
    stateRaw = await readFile(statePath, "utf8");
  } catch {
    stateRaw = "";
  }
  try {
    logRaw = await readFile(logPath, "utf8");
  } catch {
    logRaw = "";
  }

  if (!stateRaw && !logRaw) {
    return {
      ok: false,
      capturedAt: null,
      error:
        "No Studio bridge capture (.blockforge/studio-state.json / studio-output.jsonl). Do not assume 0 errors.",
      studioState: null,
      recentConsoleTail: null,
    };
  }

  let studioState: { receivedAt?: string; ts?: string } | null = null;
  if (stateRaw) {
    try {
      studioState = JSON.parse(stateRaw) as { receivedAt?: string; ts?: string };
    } catch {
      studioState = null;
    }
  }

  const capturedAt =
    (typeof studioState?.receivedAt === "string" && studioState.receivedAt) ||
    (typeof studioState?.ts === "string" && studioState.ts) ||
    null;

  if (capturedAt) {
    const age = Date.now() - Date.parse(capturedAt);
    if (!Number.isFinite(age) || age > STUDIO_STATE_STALE_MS) {
      return {
        ok: false,
        stale: true,
        capturedAt,
        error:
          "Studio bridge snapshot is stale. Do not assume 0 errors.",
        studioState,
        recentConsoleTail: logRaw.trim().split(/\r?\n/).slice(-40).join("\n") || null,
      };
    }
  } else if (!logRaw) {
    return {
      ok: false,
      stale: true,
      capturedAt: null,
      error:
        "Studio bridge capture has no timestamp. Do not assume 0 errors.",
      studioState,
      recentConsoleTail: null,
    };
  }

  return {
    ok: true,
    stale: false,
    capturedAt,
    studioState,
    recentConsoleTail: logRaw.trim().split(/\r?\n/).slice(-40).join("\n") || null,
  };
}

/**
 * Honest playtest: start Play via mux, collect console/screenshot, stop, verdict.
 * Falls back to bridge JSONL only if mux Play cannot run. Never reports 0 errors
 * when capture is missing.
 */
export async function runPlaytestCheck(
  args: PlaytestCheckArgs,
  deps: {
    client: StudioToolClient;
    locks: StudioLockManager;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<McpToolResult> {
  const sleep = deps.sleep ?? delay;
  const waitMs =
    typeof args.waitMs === "number" && args.waitMs >= 0 ? args.waitMs : 8_000;
  const hypothesis = args.hypothesis?.trim() || null;

  await deps.locks.waitForStudioTurn({
    sessionId: args.sessionId,
    projectPath: args.projectPath,
    timeoutMs: args.timeoutMs ?? 30_000,
  });
  await deps.locks.acquirePlaytest({
    sessionId: args.sessionId,
    projectPath: args.projectPath,
    timeoutMs: args.timeoutMs ?? 180_000,
  });

  let started = false;
  try {
    const names = toolNames(deps.client);
    const muxPlayable =
      deps.client.getStatus().phase === "Connected" && names.has("start_stop_play");

    if (!muxPlayable) {
      const bridge = await readBridgePlaytestEvidence(args.projectPath);
      return jsonResult({
        ok: false,
        hypothesis,
        muxPlay: false,
        reason:
          "Studio MCP start_stop_play unavailable — used bridge fallback only when present.",
        bridge,
        verdict:
          bridge.ok && bridge.recentConsoleTail
            ? `Inconclusive vs ${hypothesis ?? "hypothesis"}: mux Play did not run; bridge console is not a live playtest_check measurement.`
            : "Cannot verify. Mux Play was not started and bridge capture is missing/stale. Do not assume 0 errors.",
        evidence: { source: "bridge", ...bridge },
      });
    }

    const playArgs: Record<string, unknown> = { enabled: true };
    if (args.studioId) {
      playArgs.studio_id = args.studioId;
    }

    try {
      const startResult = await deps.client.callTool("start_stop_play", playArgs);
      if (startResult.isError) {
        throw new Error(firstText(startResult));
      }
      started = true;
    } catch (err) {
      const bridge = await readBridgePlaytestEvidence(args.projectPath);
      return jsonResult({
        ok: false,
        hypothesis,
        muxPlay: false,
        error: err instanceof Error ? err.message : String(err),
        bridge,
        verdict:
          "Cannot verify. Studio MCP failed to start Play. Do not assume 0 errors.",
      });
    }

    await sleep(waitMs);

    let consoleText: string | null = null;
    let screenshot: string | null = null;
    let screenshotPath: string | null = null;
    const callArgs: Record<string, unknown> = args.studioId
      ? { studio_id: args.studioId }
      : {};

    if (names.has("get_console_output")) {
      try {
        const cons = await deps.client.callTool("get_console_output", callArgs);
        consoleText = firstText(cons);
      } catch {
        consoleText = null;
      }
    }
    if (names.has("screen_capture")) {
      try {
        const shot = await deps.client.callTool("screen_capture", callArgs);
        screenshot = firstText(shot);
        if (screenshot && screenshot.trim()) {
          screenshotPath = await persistScreenshot(
            args.projectPath,
            args.sessionId,
            screenshot,
          );
        }
      } catch {
        screenshot = null;
      }
    }

    const hasEvidence = Boolean(
      (consoleText && consoleText.trim()) || (screenshot && screenshot.trim()),
    );
    if (!hasEvidence) {
      return jsonResult({
        ok: false,
        hypothesis,
        muxPlay: true,
        verdict:
          "Cannot verify. Play ran but console/screenshot capture was missing. Do not assume 0 errors.",
        evidence: { console: consoleText, screenshot: null, screenshotPath: null },
      });
    }

    const errored = consoleText ? consoleLooksErrored(consoleText) : false;
    const visualNote = screenshotPath
      ? ` Screenshot saved at ${screenshotPath} — open it to judge visuals (trees/fireballs/maps).`
      : " No screenshot path written — do not claim visual hypotheses are proven.";
    const verdict = errored
      ? `Rejected${hypothesis ? `: ${hypothesis}` : ""} — console contains error-level lines.`
      : `Supported${hypothesis ? `: ${hypothesis}` : ""} — captured output has no error-level lines (not a visual proof).${visualNote}`;

    return jsonResult({
      ok: !errored,
      hypothesis,
      muxPlay: true,
      verdict,
      evidence: {
        console: consoleText,
        screenshot: screenshotPath ? `[saved ${screenshotPath}]` : null,
        screenshotPath,
      },
    });
  } finally {
    if (started) {
      try {
        const stopArgs: Record<string, unknown> = { enabled: false };
        if (args.studioId) {
          stopArgs.studio_id = args.studioId;
        }
        await deps.client.callTool("start_stop_play", stopArgs);
      } catch {
        // still release playtest lock
      }
    }
    await deps.locks.releasePlaytest(args.sessionId);
  }
}

/**
 * Parse rbxtsc / TypeScript watch output for the Sync panel.
 * Strips ANSI so we never show raw `ESC[90m` sequences.
 */

const CSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;
const OSC = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;
const CHARSET = /\u001B[()][A-B0-2]/g;

export function stripAnsi(text: string): string {
  return text.replace(OSC, "").replace(CSI, "").replace(CHARSET, "").replace(/\r/g, "");
}

export type CompilerWatchStatus = "idle" | "ok" | "error";

export type CompilerWatchState = {
  status: CompilerWatchStatus;
  log: string | null;
};

export function classifyCompilerOutput(raw: string): {
  kind: "ok" | "error" | "ignore";
  text: string;
} {
  const text = stripAnsi(raw).trim();
  if (!text) {
    return { kind: "ignore", text: "" };
  }

  const found = text.match(/Found\s+(\d+)\s+errors?/i);
  if (found?.[1] !== undefined) {
    const count = Number(found[1]);
    return { kind: count === 0 ? "ok" : "error", text };
  }

  if (/error TS\d+/i.test(text)) {
    return { kind: "error", text };
  }

  return { kind: "ignore", text };
}

const MAX_LOG_CHARS = 4000;

function appendLog(previous: string | null, next: string): string {
  const combined = previous ? `${previous}\n${next}` : next;
  if (combined.length <= MAX_LOG_CHARS) {
    return combined;
  }
  return combined.slice(combined.length - MAX_LOG_CHARS);
}

export function applyCompilerChunk(
  state: CompilerWatchState,
  raw: string,
): CompilerWatchState {
  const classified = classifyCompilerOutput(raw);
  if (classified.kind === "ignore") {
    return state;
  }
  if (classified.kind === "ok") {
    return { status: "ok", log: classified.text };
  }
  const base = state.status === "error" ? state.log : null;
  return { status: "error", log: appendLog(base, classified.text) };
}

export function compilerErrorSummary(log: string | null): string | null {
  if (!log) {
    return null;
  }
  const found = log.match(/Found\s+(\d+)\s+errors?/i);
  if (found?.[1] !== undefined) {
    const count = Number(found[1]);
    if (count === 0) {
      return null;
    }
    return `TypeScript: ${count} error${count === 1 ? "" : "s"}`;
  }
  const diagnostic = log.split(/\n/).find((line) => /error TS\d+/i.test(line));
  return diagnostic ?? "TypeScript compile error";
}

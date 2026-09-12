#!/usr/bin/env node
/**
 * Stdio MCP launcher for Blockforge host gateway.
 * Proxies tools/list + tools/call to BLOCKFORGE_MCP_URL (default http://127.0.0.1:34874).
 */
import { createInterface } from "node:readline";

const baseUrl = (
  process.env.BLOCKFORGE_MCP_URL || "http://127.0.0.1:34874"
).replace(/\/$/, "");

function writeMessage(msg) {
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${buf.length}\r\n\r\n`);
  process.stdout.write(buf);
}

async function httpJson(path, init) {
  const headers = {
    ...(init?.headers ?? {}),
    ...(process.env.BLOCKFORGE_MCP_TOKEN
      ? {
          Authorization: `Bearer ${process.env.BLOCKFORGE_MCP_TOKEN}`,
          "X-Blockforge-Token": process.env.BLOCKFORGE_MCP_TOKEN,
        }
      : {}),
  };
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Bad JSON from gateway (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "blockforge", version: "0.1.0" },
      },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }
  if (method === "tools/list") {
    const data = await httpJson("/tools");
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: { tools: data.tools ?? [] },
    });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    const sessionId = process.env.BLOCKFORGE_SESSION_ID;
    const projectPath = process.env.BLOCKFORGE_PROJECT_PATH;
    const merged = {
      ...args,
      ...(sessionId && !args.sessionId ? { sessionId } : {}),
      ...(projectPath && !args.projectPath ? { projectPath } : {}),
    };
    const result = await httpJson("/tools/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: merged }),
    });
    writeMessage({ jsonrpc: "2.0", id, result });
    return;
  }
  if (method === "ping") {
    writeMessage({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

let buffer = Buffer.alloc(0);

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4);
      continue;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) return;
    const body = buffer.subarray(bodyStart, bodyStart + len).toString("utf8");
    buffer = buffer.subarray(bodyStart + len);
    try {
      const msg = JSON.parse(body);
      if (msg.method) {
        void handleRequest(msg).catch((err) => {
          if (msg.id !== undefined) {
            writeMessage({
              jsonrpc: "2.0",
              id: msg.id,
              error: {
                code: -32000,
                message: err instanceof Error ? err.message : String(err),
              },
            });
          }
        });
      }
    } catch {
      // ignore
    }
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer();
});

let lastCatalogGeneration = null;
let pollDelayMs = 2000;

async function pollCatalogGeneration() {
  try {
    const data = await httpJson("/tools");
    const gen = data.catalogGeneration;
    if (
      lastCatalogGeneration !== null &&
      gen !== undefined &&
      gen !== lastCatalogGeneration
    ) {
      writeMessage({
        jsonrpc: "2.0",
        method: "notifications/tools/list_changed",
      });
    }
    if (typeof gen === "number") {
      lastCatalogGeneration = gen;
      if (gen > 0) {
        pollDelayMs = 15000;
      }
    }
  } catch {
    // gateway may not be up yet
  }
  setTimeout(() => {
    void pollCatalogGeneration();
  }, pollDelayMs);
}

void pollCatalogGeneration();

// Also accept newline-delimited JSON for simple tests
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", () => {
  /* Content-Length framing handled via raw data */
});

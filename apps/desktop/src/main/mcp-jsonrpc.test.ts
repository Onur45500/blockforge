import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PassThrough } from "node:stream";
import {
  encodeJsonRpcFrame,
  encodeJsonRpcNdjson,
  JsonRpcFramer,
  JsonRpcStdioClient,
  isJsonRpcResponse,
} from "./mcp-jsonrpc.js";

describe("mcp-jsonrpc framing", () => {
  it("round-trips a Content-Length JSON-RPC message", () => {
    const payload = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
    const frame = encodeJsonRpcFrame(payload);
    const framer = new JsonRpcFramer();
    const messages = framer.push(frame);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], payload);
  });

  it("parses Content-Length frames with LF-only headers", () => {
    const payload = { jsonrpc: "2.0", id: 3, result: { ok: true } };
    const json = JSON.stringify(payload);
    const frame = Buffer.from(
      `Content-Length: ${Buffer.byteLength(json)}\n\n${json}`,
      "utf8",
    );
    const messages = new JsonRpcFramer().push(frame);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], payload);
  });

  it("round-trips MCP NDJSON", () => {
    const payload = { jsonrpc: "2.0", id: 1, method: "initialize", params: {} };
    const frame = encodeJsonRpcNdjson(payload);
    assert.ok(frame.toString("utf8").endsWith("\n"));
    assert.equal(frame.includes(Buffer.from("Content-Length:", "utf8")), false);
    const messages = new JsonRpcFramer().push(frame);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0], payload);
  });

  it("handles split Content-Length chunks", () => {
    const payload = { jsonrpc: "2.0", id: 7, result: { ok: true } };
    const frame = encodeJsonRpcFrame(payload);
    const framer = new JsonRpcFramer();
    const mid = Math.max(1, Math.floor(frame.length / 2));
    assert.equal(framer.push(frame.subarray(0, mid)).length, 0);
    const rest = framer.push(frame.subarray(mid));
    assert.equal(rest.length, 1);
    assert.equal(isJsonRpcResponse(rest[0]), true);
  });

  it("handles split NDJSON chunks", () => {
    const payload = { jsonrpc: "2.0", id: 8, result: { ndjson: true } };
    const frame = encodeJsonRpcNdjson(payload);
    const framer = new JsonRpcFramer();
    const mid = Math.max(1, Math.floor(frame.length / 2));
    assert.equal(framer.push(frame.subarray(0, mid)).length, 0);
    const rest = framer.push(frame.subarray(mid));
    assert.equal(rest.length, 1);
    assert.deepEqual(rest[0], payload);
  });
});

describe("JsonRpcStdioClient", () => {
  it("times out initialize when the child stays silent", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const client = new JsonRpcStdioClient({ stdin, stdout });
    await assert.rejects(
      () => client.request("initialize", {}, 40),
      /JSON-RPC timeout \(40ms\): initialize/,
    );
    client.close();
    stdin.destroy();
    stdout.destroy();
  });

  it("writes NDJSON initialize and reads an NDJSON result", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const client = new JsonRpcStdioClient({ stdin, stdout });
    const pending = client.request("initialize", { protocolVersion: "2024-11-05" }, 500);
    const written = await new Promise<Buffer>((resolve) => {
      stdin.once("data", (chunk: Buffer) => resolve(chunk));
    });
    const parsed = new JsonRpcFramer().push(written)[0] as { id: number };
    assert.equal(written.toString("utf8").includes("Content-Length:"), false);
    stdout.write(
      encodeJsonRpcNdjson({
        jsonrpc: "2.0",
        id: parsed.id,
        result: { protocolVersion: "2024-11-05" },
      }),
    );
    const result = await pending;
    assert.deepEqual(result, { protocolVersion: "2024-11-05" });
    client.close();
    stdin.destroy();
    stdout.destroy();
  });

  it("reads a Content-Length result after sending NDJSON", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const client = new JsonRpcStdioClient({ stdin, stdout });
    const pending = client.request("tools/list", {}, 500);
    const written = await new Promise<Buffer>((resolve) => {
      stdin.once("data", (chunk: Buffer) => resolve(chunk));
    });
    const parsed = new JsonRpcFramer().push(written)[0] as { id: number };
    stdout.write(
      encodeJsonRpcFrame({
        jsonrpc: "2.0",
        id: parsed.id,
        result: { tools: [{ name: "execute_luau" }] },
      }),
    );
    const result = await pending;
    assert.deepEqual(result, { tools: [{ name: "execute_luau" }] });
    client.close();
    stdin.destroy();
    stdout.destroy();
  });
});

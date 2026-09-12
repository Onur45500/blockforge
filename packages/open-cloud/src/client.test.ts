import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  OpenCloudClient,
  OpenCloudError,
  mapOpenCloudError,
  contentTypeForFile,
} from "./index.js";

describe("contentTypeForFile", () => {
  it("accepts fbx models", () => {
    assert.equal(contentTypeForFile("mesh.fbx", "Model"), "model/fbx");
  });

  it("rejects unsupported model extensions before network", () => {
    assert.throws(
      () => contentTypeForFile("mesh.obj", "Model"),
      /Unsupported model extension \.obj/,
    );
  });
});

describe("OpenCloudClient.pollOperation", () => {
  it("returns when done is true", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          path: "operations/abc",
          done: calls >= 2,
          response: calls >= 2 ? { assetId: 42 } : undefined,
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      const result = await client.pollOperation("operations/abc", {
        maxAttempts: 5,
        initialDelayMs: 1,
      });
      assert.equal(result.done, true);
      assert.equal(result.response?.assetId, 42);
      assert.ok(calls >= 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws OpenCloudError when operation reports error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          path: "operations/abc",
          done: true,
          error: { code: 400, message: "bad asset" },
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      await assert.rejects(
        () =>
          client.pollOperation("operations/abc", {
            maxAttempts: 3,
            initialDelayMs: 1,
          }),
        (error: unknown) => error instanceof OpenCloudError,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("OpenCloudClient.publishPlace", () => {
  let dir: string;
  let placePath: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "blockforge-oc-"));
    placePath = join(dir, "place.rbxl");
    await writeFile(placePath, Buffer.from("fake-rbxl"));
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns versionNumber on success", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ versionNumber: 7 }), { status: 200 })) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      const result = await client.publishPlace({
        universeId: "1",
        placeId: "2",
        placeFilePath: placePath,
      });
      assert.equal(result.versionNumber, 7);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("maps 401 to unauthorized", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "bad-key" });
      await assert.rejects(
        () =>
          client.publishPlace({
            universeId: "1",
            placeId: "2",
            placeFilePath: placePath,
          }),
        (error: unknown) => {
          assert.ok(error instanceof OpenCloudError);
          const mapped = mapOpenCloudError(error);
          assert.equal(mapped.kind, "unauthorized");
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("retries on 429 then succeeds", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("slow down", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return new Response(JSON.stringify({ versionNumber: 3 }), { status: 200 });
    }) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      const result = await client.publishPlace({
        universeId: "1",
        placeId: "2",
        placeFilePath: placePath,
      });
      assert.equal(result.versionNumber, 3);
      assert.ok(calls >= 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("OpenCloudClient.uploadAssetAndWait", () => {
  let dir: string;
  let fbxPath: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "blockforge-asset-"));
    fbxPath = join(dir, "sample.fbx");
    await writeFile(fbxPath, "; FBX stub\n");
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates asset then polls until assetId is ready", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (input: string | URL) => {
      calls += 1;
      const url = String(input);
      if (url.includes("/assets/v1/assets") && !url.includes("operations")) {
        return new Response(JSON.stringify({ path: "operations/op-1", done: false }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          path: "operations/op-1",
          done: true,
          response: { assetId: 999 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      const result = await client.uploadAssetAndWait({
        assetType: "Model",
        displayName: "Sample",
        description: "test",
        filePath: fbxPath,
        creator: { userId: 1 },
      });
      assert.equal(result.assetId, "999");
      assert.ok(calls >= 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects .obj before calling the network", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const objPath = join(dir, "mesh.obj");
    await writeFile(objPath, "o mesh\n");

    try {
      const client = new OpenCloudClient({ apiKey: "test-key" });
      await assert.rejects(
        () =>
          client.uploadAssetAndWait({
            assetType: "Model",
            displayName: "Bad",
            description: "test",
            filePath: objPath,
            creator: { userId: 1 },
          }),
        /Unsupported model extension \.obj/,
      );
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

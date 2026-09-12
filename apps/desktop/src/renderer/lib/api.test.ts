import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getBlockforgeApi } from "./api.js";
import type { BlockforgeApi } from "../../shared/ipc-types.js";

describe("getBlockforgeApi", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  it("throws when window.blockforge is missing", () => {
    (globalThis as { window?: { blockforge?: BlockforgeApi } }).window = {};
    assert.throws(
      () => getBlockforgeApi(),
      /Blockforge API is unavailable/,
    );
  });

  it("returns the API when present", () => {
    const stub = {
      createProject: async () => {
        throw new Error("not implemented");
      },
    } as unknown as BlockforgeApi;
    (globalThis as { window: { blockforge: BlockforgeApi } }).window = {
      blockforge: stub,
    };
    assert.equal(getBlockforgeApi(), stub);
  });
});

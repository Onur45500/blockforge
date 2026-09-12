import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapOpenCloudError, OpenCloudError } from "./types.js";

describe("mapOpenCloudError", () => {
  it("maps 401 to unauthorized with guidance", () => {
    const mapped = mapOpenCloudError(
      new OpenCloudError("nope", 401, "unauthorized"),
    );
    assert.equal(mapped.kind, "unauthorized");
    if (mapped.kind === "unauthorized") {
      assert.match(mapped.guidance, /API key/i);
    }
  });

  it("maps 429 to rate_limited with retry", () => {
    const mapped = mapOpenCloudError(
      new OpenCloudError("slow down", 429, "retry-after: 3"),
    );
    assert.equal(mapped.kind, "rate_limited");
    if (mapped.kind === "rate_limited") {
      assert.equal(mapped.retryAfterMs, 3000);
    }
  });

  it("maps 409 to conflict with guidance", () => {
    const mapped = mapOpenCloudError(
      new OpenCloudError(
        "Place publish failed (409)",
        409,
        JSON.stringify({
          code: "Conflict",
          message: "Save failed. Server is busy and unable to process your upload request.",
        }),
      ),
    );
    assert.equal(mapped.kind, "conflict");
    if (mapped.kind === "conflict") {
      assert.match(mapped.message, /busy/i);
      assert.match(mapped.guidance, /Team Create|Universe/i);
    }
  });

  it("maps unknown non-OpenCloudError", () => {
    const mapped = mapOpenCloudError(new Error("boom"));
    assert.equal(mapped.kind, "unknown");
  });
});

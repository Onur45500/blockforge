import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSemver, parseSemver } from "./semver.js";

describe("compareSemver", () => {
  it("orders patch versions numerically", () => {
    assert.ok(compareSemver("0.1.10", "0.1.9") > 0);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
    assert.ok(compareSemver("0.2.0", "0.1.9") > 0);
  });

  it("parses a v prefix", () => {
    assert.deepEqual(parseSemver("v1.2.3"), [1, 2, 3]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "./slugify.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(slugify("My Cool Game"), "my-cool-game");
  });

  it("strips special characters", () => {
    assert.equal(slugify("Onur!!!"), "onur");
  });

  it("falls back for empty input", () => {
    assert.equal(slugify("   "), "project");
    assert.equal(slugify("@@@"), "project");
  });

  it("truncates long names", () => {
    const long = "a".repeat(80);
    assert.equal(slugify(long).length, 48);
  });
});

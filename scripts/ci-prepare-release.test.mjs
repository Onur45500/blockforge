import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bumpPatch,
  compareSemver,
  nextReleaseVersion,
} from "./ci-prepare-release.mjs";

describe("nextReleaseVersion", () => {
  it("ships package.json on the first release when there are no tags", () => {
    assert.equal(nextReleaseVersion("0.1.0", []), "0.1.0");
  });

  it("increments patch when package.json matches the latest tag", () => {
    assert.equal(nextReleaseVersion("0.1.0", ["v0.1.0"]), "0.1.1");
  });

  it("keeps a manual bump that is already newer than the latest tag", () => {
    assert.equal(nextReleaseVersion("0.2.0", ["v0.1.5"]), "0.2.0");
  });

  it("increments from the latest tag when package.json is behind", () => {
    assert.equal(nextReleaseVersion("0.1.0", ["v0.1.4"]), "0.1.5");
  });

  it("avoids reusing an existing tag after a manual bump that was already released", () => {
    assert.equal(nextReleaseVersion("0.2.0", ["v0.2.0"]), "0.2.1");
  });
});

describe("semver helpers", () => {
  it("orders patch versions numerically", () => {
    assert.ok(compareSemver("0.1.10", "0.1.9") > 0);
  });

  it("bumps patch", () => {
    assert.equal(bumpPatch("1.2.3"), "1.2.4");
  });
});

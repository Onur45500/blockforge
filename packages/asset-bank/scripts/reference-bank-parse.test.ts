import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guessBlockforgeKind,
  parseKenneyPackSlugs,
  parseKenneyPackTitle,
  parseZipHrefs,
  summarizePolyHaven,
} from "./reference-bank-parse.js";

describe("reference-bank-parse", () => {
  it("extracts Kenney pack slugs and skips pagination", () => {
    const html = `
      <a href="/assets/game-icons">Game Icons</a>
      <a href="https://kenney.nl/assets/nature-kit">Nature</a>
      <a href="/assets/page:2">Next</a>
      <a href="/assets/tags">Tags</a>
    `;
    assert.deepEqual(parseKenneyPackSlugs(html).sort(), ["game-icons", "nature-kit"]);
  });

  it("resolves zip hrefs against the pack page", () => {
    const html = `<a href="/media/pages/assets/game-icons/abc/game-icons.zip">Download</a>`;
    const zips = parseZipHrefs(html, "https://kenney.nl/assets/game-icons");
    assert.equal(zips.length, 1);
    assert.match(zips[0] ?? "", /game-icons\.zip$/);
  });

  it("reads the pack title from h1", () => {
    assert.equal(parseKenneyPackTitle("<h1>Game Icons</h1>"), "Game Icons");
  });

  it("summarizes Poly Haven types", () => {
    const summary = summarizePolyHaven({
      brick: { name: "Brick", type: "textures" },
      chair: { name: "Chair", type: "models" },
      studio: { name: "Studio", type: "hdris" },
      numericHdr: { name: "Sky", type: 0 },
    });
    assert.equal(summary.total, 4);
    assert.equal(summary.byType.models, 1);
    assert.equal(summary.byType.hdris, 2);
  });

  it("guesses Blockforge kinds from extensions", () => {
    assert.equal(guessBlockforgeKind("Tree.fbx"), "model");
    assert.equal(guessBlockforgeKind("coin.png"), "image");
    assert.equal(guessBlockforgeKind("jump.ogg"), "audio");
    assert.equal(guessBlockforgeKind("wood_diff_1k.png"), "texture");
  });
});

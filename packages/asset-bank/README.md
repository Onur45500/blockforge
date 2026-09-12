# Asset Bank

Curated **CC0** asset catalog for Blockforge.

## Layout

- `catalog/index.json` — searchable metadata (unique CC0 Kenney / Quaternius / Poly Haven / ambientCG entries; most lack binaries until pack download)
- `fixtures/` — tiny local files for pipeline tests
- `scripts/ingest.ts` — rebuilds the catalog
- `pack/` — release artifacts (gitignored binaries; licenses committed via build)

## Rules

- MVP license: **CC0 only** (CC-BY deferred — Roblox has no good in-game attribution surface). Source policy: [SOURCES.md](./SOURCES.md).
- 3D uploads: **fbx** (ingestion notes OBJ→fbx via Blender when downloading packs)
- Audio: **preview only** in the app; no one-click Open Cloud upload

## Commands

```bash
pnpm --filter @blockforge/asset-bank ingest
pnpm --filter @blockforge/asset-bank build-pack
```

## Inspection-only CC0 dump

Do not scrape proprietary commercial toolboxes. Blockforge only indexes official CC0 sources.

`scripts/seed-packs.ts`, `scripts/seed-packs-deep.ts`, and `scripts/seed-cc0-sources.ts` add unique CC0 slots (no dummy `_vN` copies) from Kenney’s live pack index, Quaternius, Poly Haven, and **ambientCG** (official popular materials + HDRIs). Search them in the Assets dock. Only ids with files under `pack/curated/` import today (~25). Use `BLOCKFORGE_INGEST_DOWNLOAD=1` later if you want real Kenney/Quaternius meshes.

Sketchfab, Freesound, OpenGameArt, itch.io, Textures.com, and Roblox Toolbox are **not** scraped — see [SOURCES.md](./SOURCES.md).

To study **official CC0** catalogs (Kenney.nl pack list + Poly Haven API) when designing new Blockforge entries:

```bash
# Metadata only (small): Kenney pack index + Poly Haven JSON
pnpm assets:reference-bank

# Also download + unzip Kenney zips (several GB)
pnpm assets:reference-bank -- --download --out D:/cc0-reference-bank
```

Writes a gitignored folder (`packages/asset-bank/.reference-bank` by default) with `inventory.md`. Do **not** copy those files into `catalog/` or a game project.

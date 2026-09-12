# Free asset sources (Blockforge policy)

The desktop **Asset bank** only indexes **CC0 1.0** metadata. CC-BY is deferred until every insert writes Credits / `ATTRIBUTION.md`. Do **not** scrape proprietary community toolboxes.

## Indexed in the catalog (CC0, official pages)

| Source | What | How |
|--------|------|-----|
| [Kenney.nl](https://kenney.nl/assets) | Low-poly 3D kits, UI, **Kenney Audio** SFX | Catalog + optional zip ingest |
| [Quaternius](https://quaternius.com) | Low-poly 3D (fantasy, sci-fi, nature) | Catalog metadata |
| [Poly Haven](https://polyhaven.com) | Models, PBR textures, HDRI | Catalog + official API |
| [ambientCG](https://ambientcg.com) | PBR materials + HDRI | Catalog from [official API](https://docs.ambientcg.com/) |

Search these in Blockforge Assets. Most rows are metadata until a binary is on disk.

## Browse yourself — do not bulk-import into `catalog/`

| Source | Why it stays out of the shipped bank |
|--------|--------------------------------------|
| [Sketchfab](https://sketchfab.com) (Downloadable + CC) | Mixed CC-BY / CC-BY-NC; API key + per-asset license. Use the site, then import a **CC0** file you own. |
| [Freesound](https://freesound.org) | Huge SFX set; many **CC-BY**. Audio in Blockforge is preview-only anyway. Use Kenney Audio in-catalog, or download CC0 clips yourself. |
| [OpenGameArt.org](https://opengameart.org) | Mixed **CC0 / CC-BY / GPL**. GPL cannot go in a Roblox game. Check the license on **each** page. |
| [itch.io assets](https://itch.io/game-assets/free) | Quality and licenses vary; no bulk scrape. |
| [Textures.com](https://www.textures.com) | Free tier needs an account; license is **per asset**, often not CC0. |
| **Roblox Toolbox / Creator Marketplace** | Use **inside Studio**. Those assets are Roblox-hosted (`rbxassetid://`), not Kenney zips. Never scrape Creator Store into Blockforge. After you insert one, register it in `assets.json` via the Assets dock / `lookup_uploaded_asset`. |

## Adding a file you downloaded

1. Confirm **CC0** (or wait for CC-BY attribution UX).
2. Keep the zip **out** of `world/` and out of git.
3. Import through the Blockforge Assets dock when a local `.fbx` / `.png` exists, or place Parts until then.

Inspection dump of Kenney + Poly Haven indexes: `pnpm assets:reference-bank`.

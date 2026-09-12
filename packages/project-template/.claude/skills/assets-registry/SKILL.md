---
name: assets-registry
description: Use when importing, looking up, or wiring rbxassetid:// values. Never invent asset ids.
---

# Asset registry

| File | Role |
|------|------|
| `assets.json` | Upload manifest (roblox id, type, source) |
| `src/shared/assets.ts` | Typed constants agents import |
| `src/shared/placeModel.ts` | `placeModelAsset(key, cframe)` |

```bash
npm run lookup-asset -- 123456789
npm run lookup-asset -- kenney_crate
```

## Flow

1. Search the Blockforge CC0 bank (`search_asset_bank`) / generate → **human choice cards**.
2. Import in Blockforge Assets dock (Kenney / Quaternius / Poly Haven / ambientCG metadata; binaries only if on disk).
3. Use the generated key in TypeScript.
4. If you only have an `rbxassetid://` from old code **or** from Studio Toolbox / Creator Store, look it up — do not guess a new number. Do not scrape Creator Store into the CC0 catalog.

Missing id ⇒ import or tell the user. Never hardcode a random numeric id.

CC-BY sites (Sketchfab, many Freesound / OpenGameArt / itch.io rows) stay out of the bank until attribution UX exists. Roblox Toolbox stays in Studio — never scrape Creator Store.

---
name: icons
description: Use when generating or editing game icons, shop thumbnails, or HUD glyphs via Blockforge MCP.
---

# Icons

## Generate

1. `search_asset_bank` first if a CC0 icon might exist.
2. Else `generate_icon` with `{ projectPath, prompt }` (Gemini + host chroma-key + black outline).
3. `user_asset_choice` — **nothing uploads to Roblox** until the human picks a card.

## Edit

Color/style change of an existing icon is an **edit**, not a new outline. Do not download the finalized outlined PNG and paint over it (double stroke). Ask the human to re-generate or supply the unoutlined source.

## After import

Bank import writes `assets.json` + `src/shared/assets.ts`. Never invent `rbxassetid://`. Lookup:

```bash
npm run lookup-asset -- rbxassetid://123
```

Prompt cards: `docs/examples/icons/prompt-cards.md`.

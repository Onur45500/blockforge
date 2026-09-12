---
name: imagegen
description: Use when the user wants concept art, thumbnails, or non-icon images via Gemini. Not for outlined game icons (use icons skill).
---

# Image generation

Decision: outlined glyph / store icon → `icons`. Photo, concept art, 16:9 thumbnail, particle sprite → this skill.

## Flow

1. `search_asset_bank` first if a CC0 image might exist.
2. Else generate via Blockforge Assets / Gemini **without** icon chroma-key outline. Default aspect: **16:9** for thumbnails, **1:1** only when asked.
3. `user_asset_choice` — nothing is final until the human picks a card.
4. Import → `assets-registry` (`assets.json` + `src/shared/assets.ts`). Never invent `rbxassetid://`.

## Do not

- Use `generate_icon` here (it adds a black outline).
- Pretend Meshy 3D or ElevenLabs audio ran — those pipelines are **not wired**. Keys can be saved in Settings for later.

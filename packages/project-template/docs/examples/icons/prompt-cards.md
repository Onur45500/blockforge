# Icon / image prompt cards (non-script)

Use with Blockforge `generate_icon` (outlined game glyph) or plain Gemini (no outline). Always `user_asset_choice` before treating a file as final.

## Icons (`generate_icon`)

- Coin: “flat gold coin, simple glyph, front view, no text, solid color background”
- Sword: “simple sword silhouette, side view, game HUD icon, no text”
- Heart: “simple heart glyph, HUD health, no text, high contrast”

Edits of an existing icon: do **not** outline a file that already has a black stroke. See `.claude/skills/icons/SKILL.md`.

## Plain images (`imagegen` skill)

- Shop banner: “wide 16:9 stall counter, readable at thumbnail size, no logos”
- Thumbnail: “one character + one landmark, high contrast, no tiny text”

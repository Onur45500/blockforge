# Nature trees (bank mesh — reference only)

Copy `place-trees.server.ts` into `src/server/` **after** importing a tree from the Blockforge Asset bank.

## Do this

1. MCP `search_asset_bank` with query `tree` (or Assets dock).
2. Import an on-disk id: `kenney_tree`, `quat_tree_pine`, or `quat_tree_oak` → writes `shared/assets.ts`.
3. Copy / adapt `place-trees.server.ts` so `placeModelAsset` uses your real key near spawn.

## Do not

- Build trees from `Cylinder` + `Ball` Parts in `world/` or scripts.
- Invent `rbxassetid://` MeshIds.
- Rebuild the lobby with Part factories — platforms stay in `world/*.model.json`.

Ground the mesh near spawn (Y ≈ platform top). Prefer MapToolkit `groundModel` in Studio if placement floats.

---
name: mapping
description: Use when placing 3D scenery, grounding models on terrain, scattering props, or auditing overlaps and z-fighting. Requires the versioned MapToolkit.
---

# 3D mapping

Static scenery belongs in `world/*.model.json` (schema: `docs/MODEL_JSON.md`) or imported meshes via `placeModelAsset`. Do **not** rebuild maps with `new Instance("Part")` as a Rojo fix.

## Platforms vs trees

| Ask | Do |
|-----|-----|
| Platforms, lobbies, floors, walls | `world/*.model.json` only |
| Trees, rocks, bushes | `search_asset_bank` → import → `placeModelAsset` (`docs/examples/nature/`) |

**Do not** build trees from Cylinder+Ball Parts. Prefer importable ids `kenney_tree`, `quat_tree_pine`, `quat_tree_oak`.

## Versioned toolkit

Library: `studio-tools/MapToolkit.luau` → Rojo `ReplicatedStorage.Blockforge.MapToolkit`.

```bash
npm run map-toolkit
```

After Rojo is connected, call it from Studio MCP `execute_luau` with `require(game.ReplicatedStorage.Blockforge.MapToolkit)`.

**Never paste the `.luau` file into `execute_luau`.** A stale paste is how audits run against the wrong library.

## Contracts (implemented in MapToolkit)

- Ground Y comes from **raycast down**, never the caller’s Y.
- Bounds use **eight-corner projection** (rotated `GetBoundingBox()` is wrong).
- Scatter is rejection-sampled against an **occupancy** grid that persists across calls in the same session.
- **Coplanar faces** (z-fighting): parts with overlapping AABB and nearly parallel facing, distance &lt; 0.05 studs.

Also run `npm run audit-scenery` for disk-side AABB overlaps in `world/*.model.json`.

Live Studio snippet: `docs/examples/mapping/audit.example.luau` (require only — never paste MapToolkit).

## Play audit extras

Broken Motor6D rigs and off-screen `ScreenGui` — see `motion` and `ui` skills. Use `studio_wait_for_turn` before driving Studio.

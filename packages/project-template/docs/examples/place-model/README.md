# Place a bank model (reference only)

After Assets import writes `src/shared/assets.ts`, copy `place-prop.server.ts` into `src/server/` (or call `placeModelAsset` from your own script).

Static scenery can also stay as `world/*.model.json`. Do not rebuild the map with `new Instance("Part")`.

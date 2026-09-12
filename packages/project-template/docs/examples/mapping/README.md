# MapToolkit live audit (reference only)

1. `npm run map-toolkit`
2. Confirm Rojo connected (`Workspace.World` present).
3. `studio_wait_for_turn`, then `execute_luau` with [audit.example.luau](./audit.example.luau).

Grounding / scatter (same module, still do not paste the library):

```lua
local T = require(game.ReplicatedStorage.Blockforge.MapToolkit)
local spots = T.scatter(8, Vector3.new(0, 20, 0), 40, 4, 40)
return spots
```

Disk-side: `npm run audit-scenery` on `world/*.model.json`.

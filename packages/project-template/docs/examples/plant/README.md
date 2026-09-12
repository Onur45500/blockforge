# Plant / harvest (reference only)

Copy `PlanterBed.model.json` into `world/` and `plant.server.ts` into `src/server/`. Needs coins ([leaderstats](../leaderstats/)).

ProximityPrompt on `PlanterBed`: **Plant** → wait 8s (server) → **Harvest** → +8 Coins. A small anchored `Crop` Part is created in TypeScript — do not invent MeshIds.

Simulator-lite only (one bed, one currency). No trading, no hatch eggs.

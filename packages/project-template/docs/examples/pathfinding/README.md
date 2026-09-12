# Pathfinding chase NPC (reference only)

Copy `ChaseNpc.model.json` into `world/` and `pathfinding.server.ts` into `src/server/`.

`ChaseNpc` stays **Anchored**. The server calls `PathfindingService.CreatePath` / `ComputeAsync` / `GetWaypoints` and `PivotTo`s along the path toward the nearest player. Failed paths fall back to a short straight step.

Hop-between-points patrol (no pathfinding): [npc](../npc/). Do not vendor SimplePath. Unanchored Humanoid `MoveTo` is out of this MVP (`validate-world` + void).

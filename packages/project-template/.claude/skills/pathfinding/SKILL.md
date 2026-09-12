---
name: pathfinding
description: Use when NPCs chase or walk around obstacles with PathfindingService. Keep dummies Anchored; do not vendor SimplePath.
---

# Pathfinding

Patrol hops (`docs/examples/npc/`) do **not** need this. Use this skill when the dummy must go around obstacles toward a player or marker.

## MVP

1. Named anchored Part `ChaseNpc` in `world/`.
2. Copy `docs/examples/pathfinding/pathfinding.server.ts`.
3. Server: `PathfindingService.CreatePath` → `ComputeAsync` → `GetWaypoints` → `PivotTo`.
4. If `Path.Status` is not `Success`, take a short straight step. Never throw.

## Rules

- Dummy stays **Anchored** (same as pets/vehicles). Unanchored Humanoid `MoveTo` falls into the void under `validate-world`.
- Compute on the **server**. Do not accept a client-sent path or “I reached the NPC.”
- Ignore `PathWaypointAction.Jump` on the anchored MVP.
- Do not `npm install` SimplePath / ZonePlus / FastCast unless the user asks for that library.

## Do not

- Client-driven NPC positions
- Recalculating every Heartbeat for many agents (retarget ~0.8s)
- Inventing a navmesh mesh id

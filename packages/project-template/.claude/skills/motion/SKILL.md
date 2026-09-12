---
name: motion
description: Use when adding character or prop animation, Motor6D rigs, tweens, or squash/stretch motion.
---

# Motion / animation

## Who runs the tween

| Kind | Where | Why |
|------|-------|-----|
| Cosmetic juice (bob a lantern, squash a sprite) | **Client** `TweenService` | Cheap, no gameplay authority |
| Moving hazards, NPC hops, vehicles, pets that other players must see | **Server** `TweenService` / `PivotTo` | Replication + hitboxes stay honest |

Few-shot server bob: `docs/examples/motion/` (`BobMarker` tweens on the **server** so every player sees the same motion — there is no client bob example). Pets: `docs/examples/pet-follower/`. Drive: `docs/examples/vehicle/`. Fade floor: `docs/examples/obby-trap/`. Volume enter/leave (not Touched): `docs/examples/zone/`. Path chase: `docs/examples/pathfinding/`.

## Rules

- Animate **Models** with a PrimaryPart / Humanoid, not loose unanchored parts.
- Rigs: do not break `Motor6D` names (`Root`, `Neck`, `Left Shoulder`, …). If a rig looks exploded in Play, the Motor6D `Part0`/`Part1` or C0 is wrong — fix the imported model, do not hide it with a new Part factory.
- Static scenery stays in `world/*.model.json`. Scripts only tween named markers (see `BobMarker`).

## Squash / stretch (VFX-adjacent)

For a sprite or part that should streak along velocity: scale the axis parallel to `AssemblyLinearVelocity` and keep volume roughly constant. Pair with the `vfx` skill for particles.

## Do not

- Run heavy Heartbeat tweens on hundreds of parts on the server.
- Unanchor decorative parts “so they animate” (they fall into the void).

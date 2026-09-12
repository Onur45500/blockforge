---
name: combat
description: Use when adding melee, raycast hits, damage, knockback, or team-filtered PvP. Never trust client hit lists.
---

# Combat

Hits, damage, and death are **server** state. The client may play swing FX; it must not decide who was hit.

## Patterns

| Verb | Server check | Few-shot |
|------|----------------|----------|
| Melee swing | Nearby `Humanoid` within range of HRP look | `docs/examples/tool/` |
| Hitscan | `Workspace.Raycast` from HRP look, exclude attacker character | `docs/examples/combat-raycast/` |
| Projectile (fireball) | Server spawns core + `ParticleEmitter`, velocity from HRP look, touch damage | `docs/examples/fireball/` |
| Lava / hazard | Anchored `.Touched` → `Humanoid.Health = 0` | `docs/examples/obby-trap/` |

## Rules

- Connect `Tool.Activated` on the **server** after giving the tool (or validate a remote with cooldown + raycast).
- Cooldown per `UserId`. Ignore self. Skip same-team if `Player.Team` is set (`docs/examples/teams-round/`).
- Never accept a client array of “I hit these humanoids.”
- Do not invent MeshIds for weapon handles — `assets-registry` or a Part handle.
- Do **not** ship a lone Neon Ball as a fireball — use `docs/examples/fireball/` (core + particles).

## Do not

- Client-reported damage numbers
- Unanchored kill bricks “for physics” (obby kill bricks stay anchored + `.Touched` on server)
- Yellow/orange Neon sphere with no particles as “fire”

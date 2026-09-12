---
name: vfx
description: Use when adding particles, beams, trails, sprite sheets, or impact/burst effects.
---

# VFX

## Where it lives

| Kind | Prefer |
|------|--------|
| Always-on pad aura, lantern sparkle | `world/*.model.json` (`ParticleEmitter` on an **anchored** Attachment) |
| Touch / hit burst | Script `Emit` then `Enabled = false` — `docs/examples/vfx/` |
| Projectile / fireball | Small core Part + `ParticleEmitter` (orange/red) — `docs/examples/fireball/` |
| Cosmetic juice only | Client is OK; gameplay-tied FX still **start** from a server event |

Prefer `ParticleEmitter`, `Beam`, `Trail`. Do not unanchor décor to “make it float.”

**Do not** ship a lone Neon Ball as a fireball or flame.

## Particles

- Rate × lifetime × size must stay cheap on mobile (few emitters at spawn; Rate well below 200).
- `LockedToPart` for auras; world-space for explosions.
- Burst: emit a short burst then `Enabled = false` — do not leave Rate=200 forever.

## Sprites

If generating a particle texture: `generate_icon` is the wrong tool (icons get a black outline). Use `imagegen`, then import via the Asset bank so an `rbxassetid://` lands in `shared/assets.ts`.

Do not invent decal ids. Sound pads: `docs/examples/sound-pad/` (skip play if no imported audio).

## Motion

Velocity squash (streak) — `motion` skill. Preview in Play; `playtest_check` will not prove VFX by itself — ask for a screenshot if needed.

# Fireball projectile (reference only)

Copy into `src/` after `ensure-remotes.ts`:

| File | Copy into |
|------|-----------|
| [`../_shared/ensure-remotes.ts`](../_shared/ensure-remotes.ts) | `src/shared/ensure-remotes.ts` |
| `fireball.server.ts` | `src/server/` |
| `fireball-input.client.ts` | `src/client/` |

## Flow

1. Client: R key → `Remotes/CastFireball` `FireServer()` (cooldown). No direction trust beyond “cast now” — server uses HRP look.
2. Server: spawn a small dark core Part with **ParticleEmitter** (orange/red), fling with `LinearVelocity` / `AssemblyLinearVelocity`, damage on touch.
3. Never ship a lone Neon Ball as the whole fireball.

Server-authoritative damage. See `.claude/skills/combat/SKILL.md` and `vfx`.

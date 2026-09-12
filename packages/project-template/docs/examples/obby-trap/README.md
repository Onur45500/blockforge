# Fade trap + lava (reference only)

Copy `TrapCourse.model.json` into `world/` and `obby-trap.server.ts` into `src/server/`.

Walk off spawn onto `TrapApproach`, then `FadeTrap`. The floor fades on the **server** (`TweenService`) and drops `CanCollide`. `LavaBrick` underneath is anchored; `.Touched` sets `Humanoid.Health = 0`.

Instant respawn-to-checkpoint is still [obby-logic](../obby-logic/) (`KillBrick` / `Checkpoint1`). Do not unanchor the lava “for physics.”

# Minimal admin commands (reference only)

Tiny allowlist admin — **not** Adonis or any third-party admin suite. Copy into `src/`.

## Commands

- `:speed [n]` — set local walk speed (server sets Humanoid.WalkSpeed)
- `:tp <playerName>` — teleport self to another player

Gated by `ADMIN_USER_IDS` in `admin-config.ts`. Replace with group-rank checks later.

Never paste exploit “admin scripts” or require backdoors.

# RNG / weighted roll (reference only)

Copy `RollPad.model.json` into `world/` and `rng.server.ts` into `src/server/`. Needs `leaderstats/Coins`.

Copy [`_shared/ensure-remotes.ts`](../_shared/ensure-remotes.ts) into `src/shared/ensure-remotes.ts` first.

Server picks the tier. The client must not send rarity. Pity after 10 commons. Weights: `.claude/skills/economy/SKILL.md`.

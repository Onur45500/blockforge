# Game Pass speed perk (reference only)

Copy `GamePassPad.model.json` into `world/`, both `.ts` files into `src/`, and [`_shared/ensure-remotes.ts`](../_shared/ensure-remotes.ts) into `src/shared/`.

- Client: `PromptGamePassPurchase` only.
- Server: `UserOwnsGamePassAsync` + `PromptGamePassPurchaseFinished` → WalkSpeed.
- Replace `GAME_PASS_ID = 0` with a live id from `monetization.json` (not `local-*`).

Developer products use [monetization](../monetization/) `ProcessReceipt` instead.

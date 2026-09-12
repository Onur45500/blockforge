# Developer products (reference only)

Copy `process-receipt.server.ts` into `src/server/` after Blockforge Monetization has **live** product ids (not `local-*`).

- Prompt on the **client** with `MarketplaceService.PromptProductPurchase`.
- Grant on the **server** via `ProcessReceipt`.
- Unknown `ProductId` → `NotProcessedYet` (do not mark the receipt granted with no grant).
- Game Pass speed perk is a separate example: [gamepass](../gamepass/).
- Game passes / products are **owner-only** on shared projects.

See `monetization.example.json` for the file shape the app writes.

---
name: monetization
description: Use when adding Game Passes, Developer Products, or paid perks. Owner-only on shared projects.
---

# Monetization

## Two credentials (Blockforge Settings)

| Key | Used for |
|-----|----------|
| Open Cloud API key | Game Pass / Developer Product create |
| Asset upload key | Images / 3D / audio (OAuth later) |

Connecting Roblox for assets does **not** unlock gamepasses. If create fails, `request_roblox_authorization` with `kind: "open_cloud"`.

## Owner only

On a shared/cloud project, only the owner creates passes/products. Collaborators must not ask for a key or retry. Tell the user to switch to the owner.

## Developer Product vs Game Pass

| Kind | Prompt (client) | Grant (server) |
|------|-----------------|----------------|
| Developer Product | `PromptProductPurchase` | `MarketplaceService.ProcessReceipt` — DataStore `PurchaseId`, `pcall` Get/Set |
| Game Pass | `PromptGamePassPurchase` | `UserOwnsGamePassAsync` + `PromptGamePassPurchaseFinished` (also `pcall`) |

`local-*` ids in `monetization.json` are Studio fallbacks — **not** live on Roblox. Copy live numeric ids into the server map.

## Receipts

Unknown `ProductId` → `NotProcessedYet` (do not mark granted with no grant). Idempotent key: `receipt_${PurchaseId}`. Persistence patterns: `backend`.

## Do not

- `FireServer("iBoughtX")` / client-trusted “I paid” flags
- Grant perks from a shop remote without a receipt / pass check

Few-shots: `docs/examples/monetization/process-receipt.server.ts`, `docs/examples/gamepass/`.

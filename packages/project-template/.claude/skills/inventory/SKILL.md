---
name: inventory
description: Use when adding owned items, loot pads, backpack grants, or an inventory HUD. The client cannot add items.
---

# Inventory

Owned item ids live on the **server** (Folder of `IntValue`s on the player, or a table saved with coins). The client HUD only **reads**.

## MVP

1. Server creates `player.Inventory` (Folder) on join.
2. Touch `LootPad` / shop grant / receipt → increment a named `IntValue` (e.g. `Potion`).
3. Client HUD lists counts (`docs/examples/inventory/`).
4. Spending an item (if any) is a remote with **item id only** — server checks count.

Remotes: `docs/REMOTE_EVENTS.md` + `ensure-remotes.ts`. Persistence: `backend`. Shop coins: `economy`. Paid grants: `monetization`.

## Do not

- `FireServer("addItem", "Sword")` from a client cheat path
- A second backpack UI framework unless the user asks
- Trading / limiteds on day one (`game-design`)

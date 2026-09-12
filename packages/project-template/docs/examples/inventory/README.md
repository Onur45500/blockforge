# Inventory loot pad (reference only)

Copy `LootPad.model.json` into `world/`, `inventory.server.ts` into `src/server/`, and `inventory.client.ts` into `src/client/`.

Touch `LootPad` → server increments `player.Inventory/Potion`. HUD only reads. The client must not add items.

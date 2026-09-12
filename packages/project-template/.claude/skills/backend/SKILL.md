---
name: backend
description: Use when adding DataStores, player profiles, remotes, leaderstats, or any server-authoritative state.
---

# Backend

Source of truth is **TypeScript under `src/server/`**. Never trust the client for coins, inventory, damage, or admin. **Never** call `DataStoreService` from `src/client/`.

## Remotes

Follow `docs/REMOTE_EVENTS.md`: find-or-create the `Remotes` folder on the **server** (`docs/examples/_shared/ensure-remotes.ts`), `WaitForChild` on the client.

Handler checklist: `typeof` / `IsA` on arguments, debounce per `UserId`, mutate on server, replicate result (leaderstats / `FireClient` FX).

## Persistence

- Wrap `DataStoreService` calls in `pcall`.
- Key by `player.UserId`. Load on join, save on leave + periodic + **`game.BindToClose`**.
- Studio needs **API Services** enabled for live DataStores.
- Pattern: `docs/examples/leaderstats/leaderstats.server.ts`.
- HUD: `docs/examples/hud/hud.client.ts`.
- Click collect: `docs/examples/collect/`.
- Inventory folder: `docs/examples/inventory/` + `inventory` skill.

Do **not** invent a new framework (ProfileService forks, Knit, etc.) unless the user asks. Keep a small module in `src/server/`. Do not store secrets in profiles.

## Trust

- `.Touched` economy pads run on the **server**.
- Combat: server proximity / raycast (`combat` skill), never client-reported hits as truth.
- Refuse exploit dumps / script hubs (`docs/ALLOWED_SOURCES.md`).

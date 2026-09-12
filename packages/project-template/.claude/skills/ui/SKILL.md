---
name: ui
description: Use when building HUDs, shops, ScreenGui, billboards, or fixing UI that is off-screen or unreadable.
---

# UI

Prefer `src/client/**` with `@rbxts/services` (`Players`, `StarterGui`). Do not put UI logic only in Studio.

## Layout

- Scale with `UDim2.fromScale` for the root; offset for padding.
- Anchor point `(0.5, 0.5)` for centered HUD; keep important CTAs inside the safe 16:9 center (avoid the top 36px and edges on phones).
- `ResetOnSpawn = false` on persistent HUD; `true` for death screens.
- ZIndex: HUD 10, modals 50, toasts 80.
- Phone inset: `IgnoreGuiInset = true` on HUD ScreenGuis that sit under the Roblox top bar.

## ScreenGui vs world UI

| Kind | Where |
|------|--------|
| Coins / shop / inventory HUD | Client `ScreenGui` under `PlayerGui` |
| Nameplate / prompt label on a part | `BillboardGui` in `world/*.model.json` or cloned on the client onto a named part |
| Poster on a wall | `SurfaceGui` on that part |

Do not parent ScreenGui to Workspace.

## Audit (Play)

If the user says they cannot see UI:

1. `playtest_check` / Studio Output for errors.
2. Check `IgnoreGuiInset`, `ClipDescendants`, and parent `Visible`.
3. ScreenGui must live under `PlayerGui`.
4. After Rojo sync, `require(game.ReplicatedStorage.Blockforge.MapToolkit).auditOffscreenGui()` (client / LocalPlayer). Do not paste MapToolkit into `execute_luau`.

## Shop

Client shows buttons; **server** deducts coins (`docs/examples/leaderstats/shop.client.ts`). Remotes: `docs/REMOTE_EVENTS.md`. Never send the price from the client as truth. Inventory HUD: `docs/examples/inventory/`.

HUD: `docs/examples/hud/hud.client.ts`. Off-screen audit: `docs/examples/mapping/` + `MapToolkit.auditOffscreenGui()`.
catedStorage.ArenaStatus` only). Off-screen audit: `docs/examples/mapping/` + `MapToolkit.auditOffscreenGui()`.

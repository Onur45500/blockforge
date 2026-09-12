---
name: economy
description: Use when tuning prices, drops, XP, rarity, or progression curves.
---

# Economic balancing

Persistence of balances is **`backend`** (DataStore + `pcall`, load/save). This skill only tunes **numbers**.

## Defaults (until the user specifies otherwise)

- Starter currency: enough for **one** tutorial purchase, not the whole shop.
- Touch-pad coin: 1–5, debounce ≥ 1s.
- Click collect: 1, debounce ≥ 0.4s.
- Kill/obby fail: no currency loss on MVP.
- Soft cap: `level = 1 + math.floor(math.sqrt(xp / 50))` so early levels are fast.

## Rarity (RNG)

Weights live on the **server**. Example table (copy into `notes/design/economy.md`):

| Tier | Weight | MVP grant |
|------|-------:|-----------|
| Common | 70 | 1 coin |
| Uncommon | 24 | 5 coins |
| Rare | 5 | 15 coins |
| Pity rare | after 10 commons | force Rare |

Never let the client send the rolled tier. See `docs/examples/rng/`.

## Server only

Prices live on the **server**. Client UI may display them. `BuyItem.FireServer()` (or `FireServer(itemId)` only) **never** includes a client-chosen price or amount.

Balance mutation only in `src/server/`. Soft vs hard currency (Robux) is `monetization`.

## Anti-patterns

- Client-sent coin amount or rarity
- Double-collect without debounce
- Two currencies before the first loop is playable
- Granting Robux perks from a shop remote (that is `ProcessReceipt` / game pass)

## Notes

If `notes/` has economy docs, **read them** before changing numbers. Write the new table back so the next session does not reinvent prices.

Rebirth multiplier: `docs/examples/rebirth/`. Plant harvest: `docs/examples/plant/` (+8 coins, 8s grow).

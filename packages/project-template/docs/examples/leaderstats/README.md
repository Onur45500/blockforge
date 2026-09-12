# Leaderstats + DataStore MVP (reference only)

Copy into `src/server` (and shop client if needed). Not compiled from `docs/examples/`.

Copy [`_shared/ensure-remotes.ts`](../_shared/ensure-remotes.ts) into `src/shared/ensure-remotes.ts` first.

## World

Add an anchored Part named `CoinPad` near spawn (or use the sample in `CoinPad.model.json`).

## Flow

1. On `PlayerAdded`: create `leaderstats/Coins`, load from DataStore (pcall).
2. On `CoinPad.Touched`: debounce, add coins (multiplied if `RebirthMultiplier` exists — see [rebirth](../rebirth/)).
3. On leave / `BindToClose`: save coins (pcall).
4. Optional shop: client fires `BuyItem` with **no amount**; server checks coins, deducts, and grants `ShopGadget` into Backpack.

See `leaderstats.server.ts` and `shop.client.ts`.

# Coins HUD (reference only)

Copy `hud.client.ts` into `src/client/`. Pair with [leaderstats](../leaderstats/).

Layout: top-left, inside the safe 16:9 center (below the 36px inset). `ResetOnSpawn = false`.

If `leaderstats` is missing, the HUD warns and exits instead of hanging on `WaitForChild`.

Shop buttons stay client-side; **prices and grants stay on the server**.

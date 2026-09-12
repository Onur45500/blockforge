# Tool / weapon MVP (reference only)

Copy into `src/server` (and optionally create the Tool under ReplicatedStorage at runtime or as a model). Not compiled from `docs/examples/`.

## World

Optional: anchored Part named `WeaponRack` — stepping on it gives the tool (see `WeaponRack.model.json`). This example is **rack-touch only**; uncomment a `PlayerAdded` give in `tool.server.ts` if you want a tool on join.

## Flow

1. Server creates a `Tool` with a Handle Part under ReplicatedStorage.
2. Clone into `player.Backpack` when the player touches `WeaponRack`.
3. On `Tool.Activated`, a **server** connection after parenting deals proximity damage — see `tool.server.ts`. Do not trust a client-reported hit list.

See also `WeaponRack.model.json` and `docs/examples/combat-raycast/` for a raycast swing.

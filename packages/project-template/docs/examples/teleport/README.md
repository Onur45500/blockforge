# Teleport pad example (reference only)

Copy these patterns into `src/server` / `src/client` when the user asks for a teleport pad.
These files under `docs/examples/` are **not** compiled by rbxtsc.

Copy [`_shared/ensure-remotes.ts`](../_shared/ensure-remotes.ts) into `src/shared/ensure-remotes.ts` if you want the optional FX remote.

## World pads

Copy `TeleportPads.model.json` into `world/`, or add two anchored Parts named `TeleportPadA` and `TeleportPadB`. The server looks them up under `Workspace.World`.

## Flow

1. Server finds pads by name under `Workspace.World`.
2. On `Touched`, resolve the player character and move `HumanoidRootPart` to the other pad.
3. Debounce so one touch does not spam teleports.
4. After moving, server `FireClient`s `Remotes/PlayerTeleported` — copy `teleport.client.ts` for FX-only visuals.

See `teleport.server.ts` and optional `teleport.client.ts`.

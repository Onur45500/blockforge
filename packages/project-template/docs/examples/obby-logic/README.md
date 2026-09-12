# Obby kill brick + checkpoint (reference only)

Copy server logic into `src/server`. World parts live in `docs/examples/ObbySegment.model.json` (`KillBrick`, `Checkpoint1`).

## Flow

1. Touch `KillBrick` → teleport character to last checkpoint (or SpawnLocation).
2. Touch `Checkpoint1` → remember that CFrame for the player.
3. Debounce touches.

See `obby-logic.server.ts`. Fading floor + lava (`Health = 0`): [obby-trap](../obby-trap/).

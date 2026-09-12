# One-plot tycoon (reference only)

Copy `TycoonPlot.model.json` into `world/` and `tycoon.server.ts` into `src/server/`. Needs coins ([leaderstats](../leaderstats/)).

MVP: dropper spawns a neon blob that **moves toward** `TycoonCollector`. Touching a `TycoonDrop` pays coins and destroys the blob. One plot. No conveyor physics, no 40 buttons, no reincarnation.

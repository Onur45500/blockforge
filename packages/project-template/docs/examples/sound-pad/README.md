# Sound pad (reference only)

Copy `SoundPad.model.json` into `world/` and `sound-pad.server.ts` into `src/server/`.

Touch `SoundPad` plays a `Sound` parented to the pad. **SoundId** must come from `shared/assets.ts` after an Asset-bank import. If `ASSETS` is empty, the script prints and does not invent an id.

# Zone volume (reference only)

Copy `ZoneVolume.model.json` into `world/` and `zone.server.ts` into `src/server/`.

`ZoneVolume` is a **CanCollide false** box. The server polls `GetPartsInPart` (not `.Touched`) for `HumanoidRootPart`. Enter → WalkSpeed boost + `InZone` attribute; leave → restore.

Do not install ZonePlus. Combat/obby kill bricks still use `.Touched` on solid parts.

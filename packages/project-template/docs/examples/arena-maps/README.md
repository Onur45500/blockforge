# Arena maps + round timer (reference only)

Copy `ArenaMaps.model.json` into `world/`, `arena-maps.server.ts` into `src/server/`, and `arena-maps.client.ts` into `src/client/`.

Two floors (`MapA_*` / `MapB_*`) — **not** extra enabled SpawnLocations. Each round picks a map, teleports Red/Blue, writes `ReplicatedStorage.ArenaStatus`, awards `leaderstats/Points`. Client HUD only **reads** the status string.

Single pad pair without map pick: [teams-round](../teams-round/). Combat: [combat-raycast](../combat-raycast/).

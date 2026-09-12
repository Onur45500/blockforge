# Few-shot examples (reference only)

Copy patterns into `world/` and `src/`. Nothing under `docs/examples/` is compiled or Rojo-synced.

These are original Blockforge samples for common patterns (lobby, obby, shop/HUD, tools, pads, GDD notes, map moods, Studio audits).

Shared helper (copy first when combining remotes): [`_shared/ensure-remotes.ts`](./_shared/ensure-remotes.ts) → `src/shared/ensure-remotes.ts`.

## Scripts (TypeScript)

| Folder | Copy into | When |
|--------|-----------|------|
| [obby-logic/](./obby-logic/) | `src/server/` | Kill brick + checkpoint |
| [leaderstats/](./leaderstats/) | `src/server/` + `src/client/` | Coins, DataStore, shop buy |
| [hud/](./hud/) | `src/client/` | Coins HUD |
| [teleport/](./teleport/) | `src/server/` (+ optional client FX) | Pad A ↔ pad B |
| [tool/](./tool/) | `src/server/` | Give tool + server melee |
| [admin/](./admin/) | `src/shared/` + `src/server/` | Allowlist `:speed` / `:tp` |
| [npc/](./npc/) | `src/server/` | Patrol loop |
| [door/](./door/) | `src/server/` | ProximityPrompt toggle |
| [vfx/](./vfx/) | `src/server/` | Particle burst on touch |
| [motion/](./motion/) | `src/server/` | Tween bob |
| [collect/](./collect/) | `src/server/` | ClickDetector collect |
| [rng/](./rng/) | `src/server/` | Weighted roll + pity (server) |
| [tycoon/](./tycoon/) | `src/server/` | Dropper blob → collect |
| [monetization/](./monetization/) | `src/server/` | `ProcessReceipt` (dev products) |
| [gamepass/](./gamepass/) | `src/server/` + `src/client/` | Game Pass speed perk |
| [place-model/](./place-model/) | `src/server/` | `placeModelAsset` after bank import |
| [lighting/](./lighting/) | `src/server/` | Day/night ClockTime |
| [inventory/](./inventory/) | `src/server/` + `src/client/` | Loot pad + HUD |
| [combat-raycast/](./combat-raycast/) | `src/server/` | Server raycast tool |
| [teams-round/](./teams-round/) | `src/server/` | Two teams, timed round |
| [pet-follower/](./pet-follower/) | `src/server/` | Anchored follower dummy |
| [vehicle/](./vehicle/) | `src/server/` | Sit-to-drive kart (PivotTo) |
| [quest/](./quest/) | `src/server/` | NPC prompt → goal pad |
| [rebirth/](./rebirth/) | `src/server/` | Spend coins → multiplier |
| [sound-pad/](./sound-pad/) | `src/server/` | Touch plays imported audio |
| [obby-trap/](./obby-trap/) | `src/server/` | Fade floor + lava Health=0 |
| [zone/](./zone/) | `src/server/` | Volume enter/leave (GetPartsInPart) |
| [pathfinding/](./pathfinding/) | `src/server/` | Anchored chase dummy + PathfindingService |
| [plant/](./plant/) | `src/server/` | Plant → grow → harvest coins |
| [arena-maps/](./arena-maps/) | `src/server/` + `src/client/` | Map pick, round timer HUD |
| [nature/](./nature/) | `src/server/` | Bank tree meshes via `placeModelAsset` |
| [fireball/](./fireball/) | `src/server/` + `src/client/` | R-key projectile + particles |

## Non-script (scenery, GDD, Studio, prompts)

| Path | Kind |
|------|------|
| [Lobby.model.json](./Lobby.model.json) | Spawn lobby with doorway gap |
| [ObbySegment.model.json](./ObbySegment.model.json) | `Checkpoint1` + `KillBrick` |
| [leaderstats/CoinPad.model.json](./leaderstats/CoinPad.model.json) | Coin pad |
| [tool/WeaponRack.model.json](./tool/WeaponRack.model.json) | Tool rack |
| [teleport/TeleportPads.model.json](./teleport/TeleportPads.model.json) | `TeleportPadA` / `TeleportPadB` |
| [npc/NpcMarker.model.json](./npc/NpcMarker.model.json) | Patrol dummy |
| [door/ShopDoor.model.json](./door/ShopDoor.model.json) | Door part |
| [vfx/VfxPad.model.json](./vfx/VfxPad.model.json) | Attachment + ParticleEmitter |
| [motion/BobMarker.model.json](./motion/BobMarker.model.json) | Tween target |
| [collect/CollectPad.model.json](./collect/CollectPad.model.json) | Click collect pad |
| [rng/RollPad.model.json](./rng/RollPad.model.json) | RNG roll pad |
| [tycoon/TycoonPlot.model.json](./tycoon/TycoonPlot.model.json) | Dropper + collector |
| [lighting/Lantern.model.json](./lighting/Lantern.model.json) | PointLight accent |
| [seat/Bench.model.json](./seat/Bench.model.json) | Sit `Seat` |
| [inventory/LootPad.model.json](./inventory/LootPad.model.json) | Loot pad |
| [gamepass/GamePassPad.model.json](./gamepass/GamePassPad.model.json) | Game Pass prompt pad |
| [combat-raycast/RaycastRack.model.json](./combat-raycast/RaycastRack.model.json) | Raycast tool rack |
| [teams-round/TeamPads.model.json](./teams-round/TeamPads.model.json) | Red / blue pads |
| [pet-follower/PetFollower.model.json](./pet-follower/PetFollower.model.json) | Grant pad + pet marker |
| [vehicle/VehicleKart.model.json](./vehicle/VehicleKart.model.json) | `VehicleSeat` chassis |
| [quest/Quest.model.json](./quest/Quest.model.json) | NPC + goal |
| [rebirth/RebirthPad.model.json](./rebirth/RebirthPad.model.json) | Rebirth pad |
| [sound-pad/SoundPad.model.json](./sound-pad/SoundPad.model.json) | Sound pad |
| [obby-trap/TrapCourse.model.json](./obby-trap/TrapCourse.model.json) | FadeTrap + LavaBrick |
| [zone/ZoneVolume.model.json](./zone/ZoneVolume.model.json) | CanCollide-false volume |
| [pathfinding/ChaseNpc.model.json](./pathfinding/ChaseNpc.model.json) | Chase dummy |
| [plant/PlanterBed.model.json](./plant/PlanterBed.model.json) | Plant bed |
| [arena-maps/ArenaMaps.model.json](./arena-maps/ArenaMaps.model.json) | Map A / B team pads |
| [mapping/audit.example.luau](./mapping/audit.example.luau) | `require` MapToolkit (never paste the library) |
| [maps/moods.md](./maps/moods.md) | Map-mood briefs (world JSON, not Part factories) |
| [icons/prompt-cards.md](./icons/prompt-cards.md) | Icon / image prompt cards |
| [team/collaborators.md](./team/collaborators.md) | Owner vs editor / monetization |
| [monetization/monetization.example.json](./monetization/monetization.example.json) | Pass / product id shape |
| Project-root `notes/general/` + `notes/design/` | Persistent GDD (session-zero, loop, economy, progression) |

World files in this folder are **samples**. Copy into `world/` (do not enable a second SpawnLocation if `SpawnPlatform` already has one — Lobby includes a spawn; merge into `SpawnPlatform.model.json`, or set extra spawns `Enabled: false`).

## Later / still not day-one

Do **not** invent these as day-one architecture. Extend an existing example + `game-design` / `combat` / `inventory` / `pathfinding` instead of a new domain skill.

- Simulator depth: eggs/hatch, world gates (plant/harvest + rebirth MVPs exist above)
- Tycoon depth: button buy tree, conveyors, multi-plot, reincarnation
- RNG depth: inventory of pets; **trading stays forbidden** as day one
- Arena extras: matchmaking, loadouts, kill feed (`teams-round` + `arena-maps` are the MVPs)
- FPS extras: reload, spray, ADS, recoil (`combat-raycast` is the hitscan MVP)
- Racing: lap timer + sequential checkpoints (`obby` + `vehicle`)
- RPG: equipment slots, XP levels (`notes/design/progression.md`), dialogue trees
- Tower defense: placement, waves (chase dummy is `pathfinding/`)
- BedWars-style: generators, beds, team match
- Horror: jumpscare lighting + sound (`maps/moods.md`)
- Sports: ball + goals
- Social: party, chat tags, soft moderation
- Data: ProfileStore-class profiles (product stack decision)
- Audio factory: ElevenLabs (not wired)
- 3D gen: Meshy (not wired)

Possible later **skills** (only if a domain keeps being re-invented): `audio`, `match-loop`. Do not add a swarm persona that overlaps `qa-verifier`.

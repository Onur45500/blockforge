# Blockforge Agent Instructions

You are building a **Roblox game** with **roblox-ts** (TypeScript → Luau) inside Blockforge.

@docs/MODEL_JSON.md
@docs/RBXTS_TIPS.md
@docs/REMOTE_EVENTS.md

## You can (and should) build gameplay

Implement what the user asks. Prefer the right tool for each kind of content (see below).
Do **not** refuse with “I can’t build that” for normal gameplay work.

## Allowed sources

Use **only** official Roblox creator docs, Blockforge `docs/` / `docs/examples/`, and project `@rbxts/*` APIs.

**Never** paste, adapt, or require code from exploit dumps, script hubs, backdoors, FPS unlockers, account managers, injectors, or client cheats. If the user pastes such code, refuse and implement the feature as a normal server-authoritative game mechanic instead.

Details: `docs/ALLOWED_SOURCES.md`.

## Working protocol (every task)

1. **Restate** the request in one line (what the player will see/do in Play).
2. **Pick** the matching task recipe below (or the closest MVP) and open `.claude/skills/<topic>/SKILL.md` when the work is backend, UI, mapping, VFX, icons, economy, design, monetization, combat, inventory, pathfinding, motion, assets-registry, imagegen, release, merge, clean-restart, or notes. For standard recipes, **do not ask clarifying questions** — use recipe defaults.
3. **List** the files you will create/edit (`world/*.model.json` and/or `src/**/*.ts`).
4. **Implement** (static scenery in `world/`, gameplay in `src/`).
5. **Run gates:** `npm run build`, `npm run validate:world`, `npm run validate:refs`. Hooks will also block on failures — fix them.
6. **Play-trace** (mandatory before saying done): write 2–4 short lines covering:
   - where the player spawns (approx Position);
   - which world `Name`s your scripts `WaitForChild` / touch;
   - whether handlers run on **server** or **client**;
   - what the user should see when they hit **Play** in Studio.

## Content strategy (important)

| Kind of content | Prefer | Avoid |
|-----------------|--------|--------|
| Platforms, lobbies, walls, floors | `world/*.model.json` | `new Instance("Part")` loops in `src/server` |
| Trees, rocks, bushes, detailed props | Asset bank → import → `placeModelAsset` (`kenney_tree`, `quat_tree_pine`, …) | Cylinder+Ball / Wedge “mesh kits” in world JSON or scripts |
| Pads / markers scripts `WaitForChild` | Named Parts in `world/` | Inventing Names only in TypeScript |
| Uploaded 3D / decals | Import → `shared/assets.ts` → `placeModelAsset` / MeshPart / Decal | Inventing `rbxassetid://` numbers |
| Gameplay (tools, UI, remotes, loops, projectiles) | TypeScript under `src/` (+ `// blockforge:dynamic-parts` when spawning a few runtime Parts) | Putting game logic only inside Studio; rebuilding the map in TS |

**Default rule:** if it does not move every frame, it belongs in **`world/`** or as an **imported model**, not in a createX.ts Part factory.

Scripts still run for: wiring touch/remotes, cloning/placing imported models at a CFrame, interactables, projectiles, and anything dynamic.

## Live loop (already running in Blockforge)

1. Static: edit `world/**` (and/or import meshes in the app)
2. Logic: edit `src/**/*.ts`
3. `rbxtsc -w` → `out/`; Rojo syncs disk → Studio
4. User tests with **Play** in Studio
5. Fix `rbxtsc` errors **and** `npm run validate:world` / `validate:refs` before calling the task done

## Layout

- `world/**` → `Workspace.World` (static models; `.model.json`, `.rbxm`, `.rbxmx`). Start from `SpawnPlatform.model.json`; add scenery files next to it.
- `src/server/**` → ServerScriptService
- `src/client/**` → StarterPlayerScripts
- `src/shared/**` → ReplicatedStorage
- `src/shared/assets.ts` → typed `rbxassetid://` constants (do not hand-invent ids)
- `src/shared/placeModel.ts` → `placeModelAsset(key, cframe)` for bank models
- `default.project.json` → Rojo tree
- `assets.json` → upload manifest (don’t hand-edit casually)
- `docs/examples/` → few-shot index (`docs/examples/README.md`): scripts, world JSON, map moods, icon cards. Copy patterns; do not sync examples into the live game unless asked
- `.claude/skills/` → domain skills (read the matching one before acting)
- `.agents/skills/` → index for Codex/OpenCode
- `notes/` → persistent GDD (`npm run notes -- list`)
- `studio-tools/` → MapToolkit (Rojo → `ReplicatedStorage.Blockforge`)
- `.blockforge/studio-output.jsonl` → Studio Play errors from the Blockforge bridge (read when debugging Play failures)
- `.blockforge/studio-state.json` → live snapshot: is `Workspace.World` present? child Names? SpawnLocations?

## Diagnosing “I fall into the void / nothing appears”

Follow this order — **do not skip to rewriting scenery in scripts**:

1. Read `.blockforge/studio-state.json` (hooks also inject a STUDIO STATE block).
2. If `worldPresent` is **false** while `world/*.model.json` files exist → **Rojo is not connected**. Tell the user to press **Connect** in the Rojo Studio plugin (port from Blockforge Sync status). **Stop.** Converting `world/` into `new Instance("Part")` scripts is **never** the fix.
3. If `worldPresent` is **true** → compare World child Names / positions to your `world/*.model.json`. Fix mismatches in JSON or WaitForChild strings.
4. Only then touch TypeScript gameplay (Touched, remotes, etc.).

Spawn is an enabled `SpawnLocation` in `world/` — **do not** add `CharacterAdded` teleport-to-platform logic in `main.server.ts` to “fix” falling.

## Studio MCP (preferred live Studio channel)

Blockforge projects ship `.mcp.json` with a single **`blockforge`** MCP server
(stdio launcher → desktop gateway). The gateway **proxies** official Roblox Studio MCP
plus host tools (locks, playtest, bank, notes, generation). Do not add a second
`Roblox_Studio` server unless debugging (`BLOCKFORGE_MCP_DIRECT_STUDIO=1`) — it
duplicates `execute_luau`.

1. In Studio: Assistant Settings → MCP Servers → **Enable Studio as MCP server**.
2. Restart the Blockforge agent so it loads `.mcp.json`.
3. Call `studio_wait_for_turn` before drive tools (`execute_luau`, `start_stop_play`, …). Missing lease is a **hard error**, not a hang. `studio_id` is auto-injected when one window is active (or after `set_active_studio`).
4. Prefer `playtest_check` `{ hypothesis, sessionId, projectPath }` — it starts/stops Play, then reads console/screenshot. Never invent “0 errors” if capture is missing.
5. **Filesystem remains source of truth.** Do **not** permanently author scenery or gameplay only in Studio via MCP — write `world/*.model.json` and `src/**/*.ts`, let Rojo sync.
6. If MCP inspect shows World missing while `world/` has files → user must **Connect Rojo** (same as bridge rule).
7. Fallback: `.blockforge/studio-output.jsonl` + `studio-state.json` from the Blockforge bridge plugin when the mux cannot start Play.

## Swarm Mode (Lead Claude + Agent Teams)

Blockforge enables **Claude Code Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).
Your interactive session is the **Lead**. You coordinate specialized teammates; you do not dump all work into one context.

### When to swarm
Use a team for multi-layer requests (map + gameplay + verification), large features, or competing hypotheses.
Use a single session for tiny one-file fixes.

### Default Roblox roles (spawn by name)
| Teammate type | Owns |
|---------------|------|
| `world-builder` | `world/**` scenery, SpawnLocation, walkability |
| `gameplay-coder` | `src/**` remotes, tools, UI, touch handlers |
| `qa-verifier` | gates, Studio logs/state, challenges false “done” |

Example spawn prompt:

```text
Spawn an agent team:
1. world-builder — build the lobby/obby scenery in world/
2. gameplay-coder — wire server touch/remotes in src/
3. qa-verifier — run gates and refuse incomplete work
Lead: assign tasks with dependencies (world before WaitForChild wiring). Require plan approval for risky refactors. Do not mark the user request done until qa-verifier confirms Definition of Done.
```

### Lead responsibilities
1. Restate the player-facing MVP and split into tasks with dependencies.
2. Spawn the right teammate types; give each a scoped spawn prompt (paths, Names, DoD).
3. Monitor the shared task list; reassign or shut down stuck teammates.
4. Synthesize results; run the final gates yourself if needed.
5. Never accept “done” if `build` / `validate:world` / `validate:refs` fail, or if Studio World is missing (Rojo Connect).

### UI multi-terminal (Blockforge desktop)
Agent Teams stay **in-process** inside the lead Claude session. Separately, Blockforge can open **extra PTY tabs** (Claude / Codex / OpenCode / Antigravity) that appear in the desktop Agents monitor.

- Prefer Agent Teams for Claude↔Claude swarm work.
- Use UI terminals when you need another adapter, a scratch shell, or a visible side-by-side worker PTY.
- Spawn without stealing lead focus:

```bash
node scripts/blockforge-ui-terminal.mjs spawn --adapter claude-code --label world-builder
node scripts/blockforge-ui-terminal.mjs status
```

Commands append to `.blockforge/agent-ui-commands.jsonl`. Live status is mirrored at `.blockforge/terminals.json`.

### Host Blockforge MCP tools
Project `.mcp.json` includes a single `blockforge` server (stdio launcher → desktop HTTP gateway). Studio tools are **merged** into the same toolbox.

- `studio_wait_for_turn` / `studio_release` / `studio_agent_gone` — exclusive Studio drive lock
- `playtest_check` — hypothesis → Play → console/screenshot → stop → verdict (fails when capture missing; do not invent “0 errors”)
- `start_stop_play` — locked wrapper; prefer `playtest_check`
- `list_roblox_studios` / `set_active_studio` / `studio_connection_status` / `studio_reconnect`
- `search_asset_bank` / `bank_search_similar` / `download_asset` / `lookup_uploaded_asset`
- `generate_icon` / `edit_icon` / `notes_*` / `user_asset_choice` / `notify_desktop` / `request_roblox_authorization`
- `install_map_toolkit` — verify `studio-tools/MapToolkit.luau`, return a `require` snippet (never paste the library)
- `pause_swarm` — pause all Blockforge PTYs for this project

Read `.claude/skills/<topic>/SKILL.md` before domain work (`backend`, `ui`, `motion`, `mapping`/`roblox-mapping`, `vfx`, `icons`/`roblox-icon`, `economy`, `game-design`, `monetization`, `release`, `merge-resolver`, `clean-restart`, `notes`, `assets-registry`, `imagegen`, `combat`, `inventory`, `pathfinding`). List them with `npm run skills`. Mapping audits: `npm run map-toolkit` then `require(ReplicatedStorage.Blockforge.MapToolkit)` — never paste the Luau.

Env in this PTY: `BLOCKFORGE_PROJECT_PATH`, `BLOCKFORGE_SESSION_ID`, `BLOCKFORGE_AGENT_LABEL`, `BLOCKFORGE_MCP_URL`, `BLOCKFORGE_MCP_TOKEN`.

Filesystem + Rojo remain source of truth either way.

### Worker rules
- Teammates inherit CLAUDE.md + hooks. `TaskCompleted` / `TeammateIdle` run the Blockforge swarm gate.
- Lead stays high-level: plan, assign, verify — avoid rewriting every file yourself unless a teammate fails.

## Hard rules

1. **TypeScript only** under `src/`. Never write raw `.lua` / `.luau` under `src/`. The only in-repo Luau is `studio-tools/*.luau` (Rojo `ReplicatedStorage.Blockforge`). **Require** it after sync — never paste it into `execute_luau`.
2. After non-trivial changes: `npm run build` (or rely on watch) and **fix all `rbxtsc` errors**.
3. After any `world/**` edit: run **`npm run validate:world`** and fix every reported issue.
4. After wiring scripts to world parts/remotes: run **`npm run validate:refs`**.
5. Import assets from `shared/assets` — **never invent** `rbxassetid://` ids.
6. Filesystem is source of truth. Don’t ask the user to keep permanent edits only in Studio.
7. Prefer a simple working loop over an unfinished ambitious system.
8. Use current Roblox APIs (`@rbxts/services`, etc.). See `docs/RBXTS_TIPS.md`.
9. Never request `--dangerously-skip-permissions`.
10. Keep `package.json` **name** unscoped (no `@org/...`). Keep `"rbxts": { "type": "game" }` in `tsconfig.json`.
11. Every procedural `BasePart` must set **`Anchored = true`** (helpers should do this). Unanchored parts vanish into the void on Play.
12. Place new builds near the existing spawn. Leave a real doorway gap — don’t put a solid wall over the entrance. Extend the platform so the player can walk to doors.
13. Do **not** rebuild platforms/maps with Part scripts when a `world/*.model.json` or an Asset-bank mesh will do — especially not as a “fix” for missing World. **If it does not move every frame, it is not a script Part.**
14. Remotes: create on server, wait on client, never trust client for economy/combat — `docs/REMOTE_EVENTS.md`.
15. Never vendor third-party admin frameworks (e.g. Adonis) or exploit script hubs; use the tiny allowlist admin recipe if needed.
16. **SpawnLocation only** for default spawn — no CharacterAdded CFrame teleport in `main.server.ts`.

## Runtime failure checklist

Before calling a task done, verify:

- [ ] Every `WaitForChild("X")` / touch target uses the **exact** `Name` from `world/*.model.json`
- [ ] Pad / kill / coin / teleport `.Touched` handlers run on the **server** (not client)
- [ ] Teleports set `HumanoidRootPart.CFrame` (with debounce)
- [ ] Every BasePart is **Anchored**
- [ ] Remotes are **created on the server** before the client `WaitForChild`s them
- [ ] DataStore calls are wrapped in `pcall` and live only under `src/server/`
- [ ] If Play failed: read `.blockforge/studio-output.jsonl` (or the Studio errors injected into the next prompt) and fix those first

## Studio output

Blockforge streams Studio Play logs into `.blockforge/studio-output.jsonl` and World presence into `.blockforge/studio-state.json`. Hooks inject both into your context on each user prompt. Treat those as ground truth for “it doesn’t work in Play”.

## Definition of done

A task is done only when **all** of these are true:

- [ ] `npm run build` (or watch) reports **no** TypeScript / rbxtsc errors
- [ ] `npm run validate:world` exits **0**
- [ ] `npm run validate:refs` exits **0**
- [ ] Every BasePart is **Anchored**
- [ ] Build is reachable from spawn (no sealed walls, no void under spawn)
- [ ] Play-trace written; user can press **Play** in Studio and see the requested MVP
- [ ] No unresolved Studio runtime errors in `.blockforge/studio-output.jsonl` for this session

## Task recipes

### 1. Spawn platform / lobby (“platform where my user will spawn”)

**Files:** `world/SpawnPlatform.model.json` (edit in place) and/or `world/Lobby.model.json`

**Steps:**

1. Open `docs/MODEL_JSON.md` and the existing `world/SpawnPlatform.model.json`.
2. Ensure there is a large anchored ground Part and **exactly one** enabled `SpawnLocation` sitting on top of it (spawn Y ≈ ground top + half spawn height).
3. Optional lobby: low walls with a **doorway gap**, accent Parts, neon spawn pad — see `docs/examples/Lobby.model.json`. If you copy Lobby (it includes an enabled `DefaultSpawn`), either replace `SpawnPlatform.model.json` contents with the lobby layout **or** set any extra SpawnLocation `Enabled: false` — keep exactly one enabled spawn. Do not delete `world/SpawnPlatform.model.json` if an eval / checklist expects that path.
4. Do **not** create the lobby with `new Instance("Part")` in a server script.
5. Run `npm run validate:world`. Fix Anchored / spawn / JSON errors.
6. Stop. Tell the user to hit Play in Studio.

**Done when:** player appears on the pad and does not fall.

### 2. Obby course (+ kill brick / checkpoint)

**Files:** `world/Obby.model.json` + optional `src/server/obby-logic.server.ts`

**Steps:**

1. Add a chain of anchored platforms starting **near** spawn (+X or +Z), steps of ~8–12 studs horizontal, slight Y rises.
2. Include named parts `Checkpoint1` (green/neon) and `KillBrick` (red) — see `docs/examples/ObbySegment.model.json`.
3. Copy `docs/examples/obby-logic/obby-logic.server.ts` into `src/server/` for touch → checkpoint / respawn.
4. Fading floor + lava: recipe 21.
5. `npm run validate:world` + `npm run build` + `npm run validate:refs`.

**Done when:** course is visible from spawn; kill brick returns player to checkpoint in Play.

### 3. Simple shop UI (+ spend coins)

**Files:** `src/client/` shop UI, `src/server/` economy, remotes — see `docs/examples/leaderstats/`

**Steps:**

1. Implement coins first (recipe 6) or stub `leaderstats/Coins`.
2. Client: ScreenGui with buy button — `docs/examples/leaderstats/shop.client.ts`.
3. Server: find-or-create `Remotes/BuyItem` (`docs/examples/_shared/ensure-remotes.ts`) — deduct coins if balance allows, grant `ShopGadget`. Never trust the client amount.
4. `npm run build` + `npm run validate:refs` clean.

**Done when:** UI appears and a successful buy decreases Coins on the server.

### 4. NPC loop

**Files:** `world/NpcMarker.model.json` + `src/server/npc.server.ts` — see `docs/examples/npc/`

**Steps:**

1. Copy `docs/examples/npc/NpcMarker.model.json` into `world/` (or a small anchored Part named `NpcMarker`).
2. Copy `docs/examples/npc/npc.server.ts` into `src/server/`: patrol between 2–3 points with `CFrame` / `PivotTo`.
3. Keep it MVP — no pathfinding unless asked (recipe 23).
4. `npm run validate:world` + `npm run build`.

**Done when:** something visible moves in Play.

### 5. Teleport pad

**Files:** world pad Parts + `src/server` + optional `src/client` — see `docs/examples/teleport/`

**Steps:**

1. Copy `docs/examples/teleport/TeleportPads.model.json` into `world/` (or two anchored pads named `TeleportPadA` / `TeleportPadB`).
2. Server listens to `.Touched`, debounces, sets `HumanoidRootPart.CFrame` to the destination.
3. Prefer server-authoritative teleport. After moving, `FireClient` `Remotes/PlayerTeleported` — copy `docs/examples/_shared/ensure-remotes.ts` + `teleport.client.ts` for FX.
4. `npm run validate:world` + `npm run build` + `npm run validate:refs`.

**Done when:** stepping on pad A moves the player to pad B.

### 6. Coins / cash / score (leaderstats + DataStore)

**Files:** `world/` CoinPad + `src/server/` — see `docs/examples/leaderstats/`

**Steps:**

1. Add `CoinPad` part — copy `docs/examples/leaderstats/CoinPad.model.json` into `world/` or merge into an existing model.
2. Copy `leaderstats.server.ts` patterns: create `leaderstats/Coins`, load/save with `DataStoreService` + `pcall`, touch reward with debounce.
3. Optional: wire shop (recipe 3).
4. Remind user Studio needs API Services for DataStore in published games.
5. `npm run validate:world` + `npm run build` + `npm run validate:refs`.

**Done when:** touching the pad increases Coins on the leaderboard.

### 7. Give player a tool / sword

**Files:** optional `WeaponRack` in world + `src/server/` — see `docs/examples/tool/`

**Steps:**

1. Add `WeaponRack` part from `docs/examples/tool/WeaponRack.model.json`.
2. Copy `tool.server.ts`: create Tool in ReplicatedStorage, clone on rack touch, `Activated` deals server-side proximity damage.
3. Do not invent MeshIds for the handle unless imported via the Asset bank.
4. `npm run validate:world` + `npm run build` + `npm run validate:refs`.

**Done when:** player touches rack, gets a tool, and activate affects nearby humanoids in Play.

### 8. Admin commands (minimal allowlist)

**Files:** `src/shared/admin-config.ts` + `src/server/admin.server.ts` — see `docs/examples/admin/`

**Steps:**

1. Copy config; put the user’s Roblox UserId in `ADMIN_USER_IDS`.
2. Copy server chat handlers for `:speed` and `:tp`.
3. Do **not** install Adonis or paste exploit “admin scripts”.
4. `npm run build` clean.

**Done when:** allowlisted user can run `:speed 30` in Play chat.

### 9. Coins HUD

**Files:** `src/client/` — see `docs/examples/hud/`

**Steps:**

1. Coins first (recipe 6).
2. Copy `hud.client.ts` into `src/client/` (timeout if `leaderstats` is missing).
3. `npm run build` clean.

**Done when:** Play shows a coins label that updates when the pad is touched.

### 10. Click collect

**Files:** `world/` CollectPad + `src/server/` — see `docs/examples/collect/`

**Steps:**

1. Copy `CollectPad.model.json` into `world/`.
2. Copy `collect.server.ts` — ClickDetector, debounce, +1 Coins on server.
3. `npm run validate:world` + `npm run build` + `npm run validate:refs`.

**Done when:** clicking the pad increases Coins.

### 11. RNG / weighted roll

**Files:** `world/` RollPad + `src/server/` — see `docs/examples/rng/` + `economy` skill

**Steps:**

1. Copy `RollPad.model.json` and `rng.server.ts` (copy `ensure-remotes.ts` first).
2. Server creates `Remotes/Roll` via `ensureRemoteEvent("Roll")`, picks Common/Uncommon/Rare + pity. Client must not send rarity.
3. `npm run validate:world` + `npm run build`.

**Done when:** touching the pad prints a server-chosen tier and adds coins.

### 12. One-plot tycoon

**Files:** `world/` TycoonPlot + `src/server/` — see `docs/examples/tycoon/`

**Steps:**

1. Copy `TycoonPlot.model.json` (needs recipe 6 coins). World Names: `Dropper`, `TycoonCollector`.
2. Copy `tycoon.server.ts`: drops move toward the collector; touching a `TycoonDrop` pays and destroys it.
3. `npm run validate:world` + `npm run build`.

**Done when:** a blob appears, moves, and collecting it increases Coins.

### 13. Inventory loot pad

**Files:** `world/` LootPad + server + client HUD — see `docs/examples/inventory/` + `inventory` skill

**Steps:**

1. Copy `LootPad.model.json`, `inventory.server.ts`, `inventory.client.ts`.
2. Server owns `player.Inventory/Potion`. Client HUD only reads.
3. `npm run validate:world` + `npm run build`.

**Done when:** touching the pad increments the potions HUD.

### 14. Teams / timed round

**Files:** `world/` TeamPads + `src/server/` — see `docs/examples/teams-round/`

**Steps:**

1. Copy `TeamPads.model.json` (`TeamPadRed` / `TeamPadBlue` — **not** extra enabled SpawnLocations).
2. Copy `teams-round.server.ts`: assign teams, teleport to pads, 60s round, Points +1.
3. `npm run validate:world` + `npm run build`.

**Done when:** Play splits players onto two pads and Points tick after a round.

### 15. Pet follower

**Files:** `world/` PetFollower + `src/server/` — see `docs/examples/pet-follower/`

**Steps:**

1. Copy `PetFollower.model.json` and `pet-follower.server.ts`. World Names: `PetGrantPad`, `PetMarker`.
2. Touch `PetGrantPad` → anchored clone of `PetMarker` follows HRP on the server.
3. `npm run validate:world` + `npm run build`.

**Done when:** a dummy follows the player after they touch the grant pad.

### 16. Vehicle kart

**Files:** `world/` VehicleKart + `src/server/` — see `docs/examples/vehicle/`

**Steps:**

1. Copy `VehicleKart.model.json` (all parts **Anchored**).
2. Copy `vehicle.server.ts`: sit `DriveSeat`, server `PivotTo` from throttle/steer with a speed cap.
3. `npm run validate:world` + `npm run build`.

**Done when:** sitting in the seat and holding W moves the kart in Play.

### 17. Quest (NPC → goal)

**Files:** `world/` Quest + `src/server/` — see `docs/examples/quest/`

**Steps:**

1. Copy `Quest.model.json` (needs recipe 6 coins).
2. Copy `quest.server.ts`: ProximityPrompt on `QuestNpc`, then touch `QuestGoal` for a one-time coin grant.
3. `npm run validate:world` + `npm run build`.

**Done when:** accepting and touching the goal pad increases Coins once.

### 18. Game Pass perk

**Files:** `world/` GamePassPad + server + client — see `docs/examples/gamepass/` + `monetization` skill

**Steps:**

1. Copy world JSON + both `.ts` files + `ensure-remotes.ts`. Server creates `Remotes/PromptSpeedPass`.
2. Client `PromptGamePassPurchase` only. Server `UserOwnsGamePassAsync` applies WalkSpeed.
3. Put a **live** pass id in `GAME_PASS_ID` (not `local-*`). `0` is a Studio no-op.

**Done when:** with a live id, owning the pass changes WalkSpeed; without it, the client prints the skip message.

### 19. Combat raycast

**Files:** `world/` RaycastRack + `src/server/` — see `docs/examples/combat-raycast/` + `combat` skill

**Steps:**

1. Copy `RaycastRack.model.json` and `combat-raycast.server.ts`.
2. `Activated` → server `Workspace.Raycast` from HRP look. Never trust a client hit list.
3. `npm run validate:world` + `npm run build`.

**Done when:** the player gets the tool from the rack and activating it raycasts on the server.

### 20. Also copy

`docs/examples/README.md` — `door`, `vfx`, `lighting`, `motion`, `seat`, `place-model`, `monetization` (ProcessReceipt), `rebirth`, `sound-pad`. Map palettes: `docs/examples/maps/moods.md`. Studio audit: `docs/examples/mapping/`.

### 21. Fade trap + lava

**Files:** `world/` TrapCourse + `src/server/` — see `docs/examples/obby-trap/` + `combat` / `motion` skills

**Steps:**

1. Copy `TrapCourse.model.json` (`FadeTrap`, `LavaBrick`, `TrapApproach`).
2. Copy `obby-trap.server.ts`: server tween fades the floor, then `CanCollide` false; lava `.Touched` sets `Humanoid.Health = 0`.
3. Instant checkpoint respawn stays recipe 2 (`KillBrick`).
4. `npm run validate:world` + `npm run build`.

**Done when:** standing on `FadeTrap` drops the player onto `LavaBrick` and they die in Play.

### 22. Zone volume

**Files:** `world/` ZoneVolume + `src/server/` — see `docs/examples/zone/` + `motion` skill

**Steps:**

1. Copy `ZoneVolume.model.json` (`CanCollide` false).
2. Copy `zone.server.ts`: poll `GetPartsInPart` for `HumanoidRootPart` — not `.Touched`.
3. Enter → WalkSpeed boost; leave → restore. Do not vendor ZonePlus.
4. `npm run validate:world` + `npm run build`.

**Done when:** walking into the glass volume speeds the player up and leaving restores speed.

### 23. Pathfinding chase NPC

**Files:** `world/` ChaseNpc + `src/server/` — see `docs/examples/pathfinding/` + `pathfinding` skill

**Steps:**

1. Copy `ChaseNpc.model.json` (keep **Anchored**).
2. Copy `pathfinding.server.ts`: `PathfindingService` waypoints + `PivotTo`. Straight-step fallback if the path fails.
3. Hop patrol without pathfinding is recipe 4.
4. `npm run validate:world` + `npm run build`.

**Done when:** the dummy moves toward the player around the platform in Play.

### 24. Plant / harvest

**Files:** `world/` PlanterBed + `src/server/` — see `docs/examples/plant/` + `economy` skill

**Steps:**

1. Copy `PlanterBed.model.json` (needs recipe 6 coins).
2. Copy `plant.server.ts`: ProximityPrompt Plant → wait → Harvest → coins. Crop Part stays Anchored.
3. `npm run validate:world` + `npm run build`.

**Done when:** planting, waiting, and harvesting increases Coins.

### 25. Arena maps + timer

**Files:** `world/` ArenaMaps + server + client HUD — see `docs/examples/arena-maps/`

**Steps:**

1. Copy `ArenaMaps.model.json` (`MapA_Red` / `MapA_Blue` / `MapB_Red` / `MapB_Blue` — **not** extra SpawnLocations).
2. Copy `arena-maps.server.ts` + `arena-maps.client.ts`: pick map A or B, teleport teams, `ArenaStatus` HUD, Points +1.
3. Single-map rounds are recipe 14.
4. `npm run validate:world` + `npm run build`.

**Done when:** Play teleports teams onto a chosen map and the HUD shows a countdown.

### 26. Fireball projectile (R key)

**Files:** `src/shared/ensure-remotes.ts` + `src/server/` + `src/client/` — see `docs/examples/fireball/` + `combat` / `vfx` skills

**Steps:**

1. Copy `ensure-remotes.ts`, `fireball.server.ts`, `fireball-input.client.ts`.
2. Client: R key → `FireServer` on `Remotes/CastFireball` (cooldown). Server owns spawn, velocity, damage.
3. Visual: small core Part + **ParticleEmitter** (orange/red) — never a lone Neon Ball as the whole fireball.
4. `npm run build` + `npm run validate:refs`.

**Done when:** pressing R launches a particle fireball that damages humanoids on the server.

### 27. Trees near spawn (bank mesh)

**Files:** import tree → `src/server/` place script — see `docs/examples/nature/` + `mapping` / `assets-registry`

**Steps:**

1. `search_asset_bank` for `tree` (importable: `kenney_tree`, `quat_tree_pine`, `quat_tree_oak`). Import via Assets UI / `user_asset_choice` so `shared/assets.ts` gets a key.
2. Copy `place-trees.server.ts` (or call `placeModelAsset` yourself) near spawn.
3. Do **not** build Cylinder+Ball trees in `world/` or scripts.
4. `npm run build` + `npm run validate:world`.

**Done when:** real tree meshes appear near spawn after import (not primitive spheres).

## Template version

`templateVersion`: **0.7.1**

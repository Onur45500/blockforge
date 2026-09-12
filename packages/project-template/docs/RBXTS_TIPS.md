# roblox-ts tips (Blockforge)

Short pitfalls checklist so agents do not invent browser/Node APIs or Luau-only patterns.

## CFrame / Vector3 (roblox-ts, not Luau)

```ts
// Correct (TypeScript / roblox-ts):
const pos = new Vector3(0, 12.5, 0);
root.CFrame = new CFrame(pos.add(new Vector3(0, 3, 0)));
// or: root.CFrame = new CFrame(pos.add(Vector3.yAxis.mul(3)));

// WRONG (Luau APIs — will fail rbxtsc):
// CFrame.new(pos)
// pos * 3
// Vector3.yAxis * 3
```

Prefer `new CFrame(...)`, `new Vector3(...)`, and `.add` / `.mul` / `.sub` methods.

## Services

```ts
import { Players, Workspace, ReplicatedStorage } from "@rbxts/services";
```

Do **not** use `game.GetService` stringly typed without need — prefer `@rbxts/services`.

## Types that do not exist here

- No DOM (`document`, `window`, `fetch` to arbitrary URLs from client without HttpService rules).
- No Node (`fs`, `path`, `require("...")` of npm packages at runtime in-game).
- Game code is under `src/` and compiles with `rbxtsc` → Luau.

## Instances

- Static scenery → `world/*.model.json` (see `docs/MODEL_JSON.md`).
- Dynamic / reactive → `src/` with `new Instance("Part")` only when it must move or be cloned at runtime.
- Every procedural `BasePart`: `Anchored = true` unless it is a Tool handle that must be held.

## WaitForChild

```ts
const world = Workspace.WaitForChild("World");
const pad = world.WaitForChild("CoinPad") as BasePart;
```

Cast after wait. Prefer exact `Name` strings that match world JSON.

## Values and leaderstats

```ts
const coins = new Instance("IntValue");
coins.Name = "Coins";
coins.Value = 0;
coins.Parent = leaderstats;
```

Use `IntValue` / `NumberValue` / `StringValue` — not plain JS objects on `Player` if you want the default Roblox leaderboard UI.

## Strings

Luau string patterns use `%d+` not JS regex in `string.match`. Prefer TypeScript `string` methods when processing in TS before emit, or the Luau `string` library APIs as typed by `@rbxts/types`.

## Remotes

See `docs/REMOTE_EVENTS.md`. Create on server; wait on client; never trust client for economy/combat.

## Character / camera

- Server owns authoritative CFrame / Humanoid health changes.
- Camera and local input stay on the client.
- Do not copy archived Roblox Core-Scripts into the project — implement the small feature you need.

## Build

```bash
npm run build
npm run validate:world
npm run validate:refs
```

Fix all errors before calling the task done.

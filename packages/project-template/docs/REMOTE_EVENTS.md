# RemoteEvents (roblox-ts)



Remotes move signals between server and client. **Never trust the client** for coins, damage, inventory, or admin — validate on the server.



## Official remote registry



| Name | Direction | Args (client → server) | Example |

|------|-----------|------------------------|---------|

| `BuyItem` | client → server | none (server owns price) | `docs/examples/leaderstats/` |

| `PlayerTeleported` | server → client | none (FX only) | `docs/examples/teleport/` |

| `Roll` | client → server | none (server picks rarity) | `docs/examples/rng/` |

| `PromptSpeedPass` | server → client | none (client prompts purchase) | `docs/examples/gamepass/` |

| `CastFireball` | client → server | none (server uses HRP look) | `docs/examples/fireball/` |



Prefer these Names when matching a recipe. New remotes: find-or-create with `ensureRemoteEvent`, document in the Play-trace.



## Folder convention



Find-or-create **once** on the **server**. Copy `docs/examples/_shared/ensure-remotes.ts` into `src/shared/` so combining examples does not duplicate `ReplicatedStorage.Remotes`.



```ts

import { ensureRemoteEvent } from "shared/ensure-remotes";



const buyItem = ensureRemoteEvent("BuyItem");

```



Inline equivalent (only if you have a single server script):



```ts

import { ReplicatedStorage } from "@rbxts/services";



const existing = ReplicatedStorage.FindFirstChild("Remotes");

const remotes =

	existing !== undefined && existing.IsA("Folder") ? existing : new Instance("Folder");

remotes.Name = "Remotes";

remotes.Parent = ReplicatedStorage;



const existingBuy = remotes.FindFirstChild("BuyItem");

const buyItem =

	existingBuy !== undefined && existingBuy.IsA("RemoteEvent")

		? existingBuy

		: new Instance("RemoteEvent");

buyItem.Name = "BuyItem";

buyItem.Parent = remotes;

```



On the **client**, wait — do not recreate:



```ts

import { ReplicatedStorage } from "@rbxts/services";



const remotes = ReplicatedStorage.WaitForChild("Remotes");

const buyItem = remotes.WaitForChild("BuyItem") as RemoteEvent;

```



## Direction



| Call | Who runs it | Use for |

|------|-------------|---------|

| `remote.FireServer(...)` | client → server | requests (buy, open door) |

| `remote.OnServerEvent` | server handler | validate, then mutate state |

| `remote.FireClient(player, ...)` / `FireAllClients` | server → client | FX, UI refresh |

| `remote.OnClientEvent` | client handler | visuals only |



## Checklist



1. Create remotes in `src/server` (or `ensureRemoteEvent` imported from `src/shared`, called only from server).

2. Client uses `WaitForChild` + cast to `RemoteEvent`.

3. Server checks player, `typeof` arguments, debounce, and game rules before changing leaderstats / tools / CFrame.

4. Prefer server-only `.Touched` for pads when no client input is needed (see `docs/examples/teleport/`).

5. Never `new Instance("Folder")` named `Remotes` if the folder might already exist. Same for each RemoteEvent Name — find-or-create.



## Optional FX remote (teleport)



After a server teleport, fire a FX-only event:



```ts

const playerTeleported = ensureRemoteEvent("PlayerTeleported");

// server, after moving HumanoidRootPart

playerTeleported.FireClient(player);

```



```ts

// client

playerTeleported.OnClientEvent.Connect(() => {

	// flash ScreenGui / play Sound — no gameplay authority

});

```



See also: `docs/examples/teleport/`, `docs/RBXTS_TIPS.md`.


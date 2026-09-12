---
name: game-design
description: Use when scoping a feature, writing a GDD slice, or choosing a loop (obby, simulator, RNG, tycoon, arena).
---

# Game design

Use **one** game-design skill — not a folder per genre. Freeze the loop so the next task does not invent a new architecture.

## Loop

Every MVP needs: **spawn → verb → reward → repeat** in under 30 seconds. Cut systems that are not on that path.

Write the verb into `notes/design/loop.md` before building a second system.

Loop fields (one line each): **verb**, **reward**, **fail state**.

After the loop is frozen, open `backend` + `economy` (and `combat` / `inventory` when those verbs exist) before writing more systems.

## Genre MVPs (copy these examples, don’t port a live title)

| Genre | 30-second verb | Copy |
|-------|----------------|------|
| Obby | jump → checkpoint / kill brick | `docs/examples/obby-logic/` + `ObbySegment.model.json` |
| Obby trap | stand → floor fades → lava kills | `docs/examples/obby-trap/` |
| Simulator | click / touch → coins | `docs/examples/collect/` + `leaderstats/` + `hud/` |
| Plant | prompt plant → wait → harvest coins | `docs/examples/plant/` |
| RNG / gacha | click roll → weighted drop (server) | `docs/examples/rng/` |
| Tycoon | stand near moving drop → collect coins | `docs/examples/tycoon/` |
| Lobby + pads | touch teleport / door / shop | `Lobby.model.json`, `teleport/`, `door/`, `leaderstats/shop` |
| Tool / PvP pad | pick up tool, proximity or raycast damage | `docs/examples/tool/`, `combat-raycast/` |
| Arena | two teams, timed round, score | `docs/examples/teams-round/` |
| Arena maps | pick map A/B, timer HUD, score | `docs/examples/arena-maps/` |
| Zone | walk into volume → speed / flag | `docs/examples/zone/` |
| Chase NPC | path around obstacles toward player | `docs/examples/pathfinding/` |
| Fireball | press R → particle projectile damage | `docs/examples/fireball/` |
| Nature trees | import bank mesh → placeModelAsset | `docs/examples/nature/` |
| Pet / follower | grant dummy that follows HRP | `docs/examples/pet-follower/` |
| Quest | prompt NPC → touch goal → coins once | `docs/examples/quest/` |

Do **not** clone a live Roblox experience (12 currencies, trading, limiteds). Same genre, original loop, one currency.

## Notes are memory

```bash
npm run notes -- list
```

Update `notes/design/<topic>.md` when you ship a system. Next session must not contradict it.
If notes and code disagree, update the note in the same change.

## Do not

- Hide the spawn with sealed walls or void.
- Add a second currency before the first loop is playable in Studio.
- Invent lore that is not in `notes/`.

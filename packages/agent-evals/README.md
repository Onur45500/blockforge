# Agent evals (`@blockforge/agent-evals`)

Headless first-try accuracy harness for Blockforge Claude Code game generation.

## Prerequisites

- Template deps installed: `cd packages/project-template && npm install`
- `claude` CLI logged in (for live runs)
- Optional runtime tier: `rojo` + [`run-in-roblox`](https://github.com/rojo-rbx/run-in-roblox) on PATH

## Commands

From repo root:

```bash
# Dry-run: assert fresh-template gates and scenario contracts (no Claude)
npx pnpm evals:dry

# Full headless Claude runs (costs API / subscription usage)
npx pnpm evals:run

# Single scenario
npx pnpm --filter @blockforge/agent-evals start -- --scenario spawn-lobby

# With in-engine probes (local Studio)
npx pnpm evals:runtime

# Tag as baseline for A/B
npx pnpm --filter @blockforge/agent-evals start -- --baseline
```

Results land in `packages/agent-evals/results/` (`*.json` + `*.md`). Keep `BF_EVAL_KEEP=1` to leave temp workdirs for inspection.

## Scenarios

One JSON file per recipe under `scenarios/` (recipes 1–8 plus HUD, tycoon, inventory, teams, fade trap, zone, pathfinding, plant, arena maps). Shop eval expects remote **`BuyItem`**. Assertions cover `build` / `validate:world` / `validate:refs`, expected world `Name`s, named client/server remotes, file presence, and `src` regexes. Optional `runtimeProbe` points at a Luau script under `probes/`.

## Studio MCP (optional)

When Roblox Studio MCP is enabled and connected to the eval environment, prefer playtest/console via MCP for runtime confidence. The default `evals:runtime` path still uses `run-in-roblox` / bridge-style probes when MCP is unavailable — skip MCP-only assertions rather than failing the suite offline.


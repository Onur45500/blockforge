# Architecture

This file describes **Blockforge as implemented**.

## Overview

Blockforge is a pnpm monorepo. The desktop app orchestrates local tools; it does not host AI models or proxy prompts.

```
Renderer (React workspace shell)
    ↓ typed IPC (preload allowlist)
Main process
    ├── ProjectManager (multi-open projects + active switcher)
    ├── PtyManager (multi-session PTY; many sessions per adapter with labels)
    ├── PtyControlWatcher (`.blockforge/agent-ui-commands.jsonl` → spawn/focus/close)
    ├── StudioLocks (studio turn + global playtest mutex)
    ├── BlockforgeMcpGateway (HTTP :34874 — bank / locks / choice / notify_desktop; token auth)
    ├── RojoSupervisor (per open project; rbxtsc -w + rojo serve)
    ├── StudioBridge (active project observability)
    ├── GitService / BackupService
    ├── OpenCloudStore (safeStorage: Open Cloud + asset upload + generation keys)
    ├── PublishService / MonetizationService / AssetService
    └── PackDownload / Attribution / Syncback / CloudSync helpers
```

See also [WORKSPACE.md](./WORKSPACE.md) for the desktop shell, docks, and agent-ui-commands contract.
## Source of truth

The **filesystem project** is authoritative. Rojo sync is **one-way** (disk → Studio) by default.

- Enable **experimental syncback** in Settings to surface Studio export conflicts under `.blockforge/studio-exports/` with explicit Keep disk / Take Studio / Open diff — never silent overwrite.
- **Static scenery** lives under `world/` (`.model.json`, `.rbxm`, `.rbxmx`) and/or as Asset-bank meshes placed via `placeModelAsset`.
- **Gameplay** lives in TypeScript under `src/`. Avoid Studio-only permanent edits.
- **Style packs** live under `packages/asset-bank/style-packs/`; activate via `.blockforge/style-pack.json`.

## Template versioning

Each created project gets `blockforge.json` with `templateVersion`. Agent instructions live in `CLAUDE.md` / `AGENTS.md` inside the template and are copied into projects. Migrations key off `templateVersion` via `template-upgrade.ts`.

## Open Cloud

Shared client: `@blockforge/open-cloud`.

| Operation | Endpoint |
|-----------|----------|
| Upload asset | `POST https://apis.roblox.com/assets/v1/assets` (multipart) |
| Poll operation | `GET https://apis.roblox.com/assets/v1/operations/{id}` |
| Publish place | `POST https://apis.roblox.com/universes/v1/{universeId}/places/{placeId}/versions?versionType=Published` |
| Developer products / game passes | Scaffolding helpers on `OpenCloudClient` (local `monetization.json` fallback) |

Constraints:

- Model uploads: fbx (gltf/glb also accepted by API; OBJ requires conversion at ingest)
- Audio/HDRI: preview-oriented in the app
- Decal asset id ≠ Image id — bank records the correct type

## Agent adapter

`AgentAdapter` covers: launch command, install detection, login detection, instructions filename, resume support.

Shipped adapters: Claude Code, Codex, OpenCode, Antigravity (experimental). The desktop workspace is terminal-centric: a lead PTY plus optional worker tabs/splits. Multiple live sessions per adapter are allowed; each may carry a `label` / `role` (e.g. `world-builder`). Optional WSL2 launch wraps the command via `wsl.exe`.

Live session status is pushed on `pty:status-changed` and mirrored to `.blockforge/terminals.json`. Lead agents can spawn UI terminals by appending JSONL commands to `.blockforge/agent-ui-commands.jsonl` (helper: `node scripts/blockforge-ui-terminal.mjs`). Spawns do not steal focus unless `focus: true`.

### Swarm Mode (Lead Claude + Agent Teams)

Blockforge’s answer to a “main Claude that coordinates the others” is **Claude Code Agent Teams** (not a second home-grown PTY orchestrator):

1. Project `.claude/settings.json` sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (also injected at launch).
2. The Claude Code tab is the **lead** — plans, assigns, verifies.
3. Reusable teammate roles live in `.claude/agents/` (`world-builder`, `gameplay-coder`, `qa-verifier`).
4. `TaskCompleted` / `TeammateIdle` hooks run `scripts/swarm-gate-hook.mjs` (build + validate:world + validate:refs) so workers cannot claim done on broken Play.
5. Settings → Swarm Mode toggles the feature; UI offers a quiet swarm starter action.

**Both** paths are supported: Agent Teams (in-process Claude workers) and Blockforge UI multi-terminal (Electron PTYs for any adapter). Prefer Agent Teams for Claude↔Claude swarm; use UI terminals for other adapters or visible side-by-side sessions. Filesystem + Rojo remain source of truth either way.

Vendor multi-tabs (Codex / OpenCode / …) remain available; swarm coordination for Claude-to-Claude is Agent Teams.

### Studio MCP (hybrid)

**Primary live Studio channel** for agents is Roblox’s built-in Studio MCP (project `.mcp.json` → `Roblox_Studio`). Use it to inspect the DataModel, playtest, and read console with explicit `studio_id`.

**Filesystem remains source of truth**; Rojo stays one-way disk→Studio by default. MCP must not become a permanent Studio-only edit store for scenery/gameplay.

**Fallback:** Blockforge HTTP bridge (`studio-bridge.ts` + plugin) still writes `.blockforge/studio-output.jsonl` and `studio-state.json` when MCP is offline. Doctor surfaces both MCP launcher and bridge install.

### Host Blockforge MCP + Studio locks

A second MCP server (`blockforge`) in project `.mcp.json` points at a stdio launcher that proxies to the desktop HTTP gateway. Tools cover:

- `studio_wait_for_turn` / `studio_release` — exclusive Studio drive lock per session
- Global playtest mutex — acquired inside `playtest_check` (one measurement at a time)
- `search_asset_bank`, `generate_icon`, `user_asset_choice` (human pick cards in the UI)
- `notify_desktop` + Settings focus for Roblox credentials

Locks auto-release when a PTY exits. Status is mirrored to `.blockforge/studio-locks.json`.
The gateway binds `127.0.0.1` only and requires `BLOCKFORGE_MCP_TOKEN` (Bearer or `X-Blockforge-Token`) on `/tools` and `/tools/call`; the token is injected into agent PTY env.

### Git dock + backups

In-app Git panel (status / stage / commit / branch / pull / push) via `simple-git`. Destructive git ops are blocked while a playtest lock is held. Project zip backups live under Electron `userData/backups/` (independent of remotes).

## Process lifecycle

All child processes (PTY, rojo, rbxtsc) are tracked. Closing an active project stops that project's Rojo + its PTY sessions; other open projects keep running. On app quit, Windows uses `taskkill /T /F /PID` to reap trees.
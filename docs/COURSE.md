# Blockforge course & community

Curriculum labs built on [`packages/project-template/docs/examples`](../packages/project-template/docs/examples).

## Track A — First playable

0. **Studio MCP** — Enable Studio as MCP server + Quick Connect Claude Code; confirm Doctor MCP launcher OK
1. **Swarm Mode** — In the Claude Code tab, paste the Swarm starter prompt; lead spawns world-builder + gameplay-coder + qa-verifier (MCP playtest when available)
2. **Spawn & floor** — `world/SpawnPlatform.model.json`, validate:world
3. **Obby segment** — `docs/examples/ObbySegment.model.json` + `obby-logic`
4. **Leaderstats + shop pad** — `docs/examples/leaderstats`
5. **HUD** — `docs/examples/hud` (needs coins from step 4)
6. **Tool grant** — `docs/examples/tool`
7. **Teleport pads** — `docs/examples/teleport`
8. **Publish** — Open Cloud place publish from the desktop app

More few-shots (NPC, door, VFX, inventory, teams, vehicle, quest, map moods): [`docs/examples/README.md`](../packages/project-template/docs/examples/README.md).

## Track B — Assets & polish

> **Prerequisite:** Download an asset pack with real binaries (Assets → Download pack) so catalog entries have on-disk files. Metadata-only catalog rows cannot be imported.

1. Import a curated CC0 model via Assets (fixture or pack entry with a `file` field)
2. Confirm `ATTRIBUTION.md` / Credits tab records the insert
3. Activate style pack `lowpoly-nature` from Assets (writes `.blockforge/style-pack.json`)
4. Optional: Gemini image gen with a user API key (Meshy/ElevenLabs are coming soon)

## Track C — Monetization scaffolding

1. Create a developer product in the Monetization tab
2. Wire `MarketplaceService.PromptProductPurchase` using `monetization.json` ids — `docs/examples/monetization/process-receipt.server.ts`
3. Read `docs/monetization.md` in the project
4. If the UI shows a `local-*` id, Open Cloud did not create a live product — fix credentials before publishing purchases

## Community

- Contribute examples via [CONTRIBUTING.md](CONTRIBUTING.md)
- Prefer Discord/forum links in release notes
- In-app “community share” / “cloud sync” today write **local** snapshots only (not a remote CDN)
- Never share scraped proprietary assets

## Non-goals reminder

Blockforge does not resell coding-agent access and does not use Roblox trademarks in the product name.

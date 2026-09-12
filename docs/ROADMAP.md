# Roadmap (v-next)

MVP is intentionally slim. This document tracks remaining product work.
Checkmarks mean **shipped and usable**; partial items are called out explicitly.

## Agents

- [x] Multi-agent tabs: Codex, OpenCode in parallel (Antigravity tab is experimental placeholder)
- [x] Session resume flag per adapter (session picker UX still thin)
- [x] Sandbox tier 1: WSL2 launch + Doctor
- [ ] Sandbox tier 2: embedded Linux VM (`spikes/sandbox-vm` — spike only, not wired)
- [x] **Swarm Mode** — Lead Claude coordinates workers via Claude Code Agent Teams + Blockforge gate hooks (`world-builder` / `gameplay-coder` / `qa-verifier`)
- [x] **Studio MCP (hybrid)** — official Roblox Studio MCP config + Doctor; Blockforge bridge fallback; disk/Rojo remain source of truth
- [x] **Terminal-centric workspace** — docks / header tools / Cmd+K / Quiet / Split; layout persistence per project ([WORKSPACE.md](./WORKSPACE.md))
- [x] **Agent UI terminals** — `.blockforge/agent-ui-commands.jsonl` + `terminals.json` + `blockforge-ui-terminal.mjs`
- [x] **Studio turn lock + playtest mutex via `playtest_check`** + host `blockforge` MCP gateway (bank / generate_icon / choice / notify_desktop)
- [x] **Topic skills + MapToolkit** — original `.claude/skills/*` + `studio-tools/MapToolkit.luau` in the project template (0.5.0)
- [ ] Roblox OAuth PKCE for asset upload (Open Cloud key split shipped; OAuth deferred)

## Assets

- [x] Metadata catalog (unique CC0 entries: Kenney / Quaternius / Poly Haven packs)
- [x] Curated importable binaries (~25 fixture-backed FBX/PNG under `pack/curated/`) + style-pack activate UI
- [ ] Full Kenney/Quaternius remote mesh CDN on GitHub Releases (manifest URL ready; ship release artifacts)
- [ ] Real Kenney/Quaternius zip ingest with OBJ→fbx in default CI (opt-in today via `BLOCKFORGE_INGEST_DOWNLOAD=1`)
- [ ] Poly Haven textures/HDRI downloaded into pack (metadata seeded; preview-only for HDRI/audio)
- [x] Credits tab + `ATTRIBUTION.md` for CC0 inserts (**CC0-only**; CC-BY packs remain out of scope until attribution always records source URLs)
- [x] Gemini image generation with user API key
- [x] Icon post-process (chroma-key + outline) + human asset choice cards + catalog search
- [ ] Meshy (3D) + ElevenLabs (audio) — scaffolds / coming soon (keys stored; no binary pipeline yet)
- [ ] Optional shared-credits “Plus” style service (never resell the coding agent)

## Studio / sync

- [x] Rojo syncback experimental path (Studio `/export` → `.blockforge/studio-exports/` + conflict UI)
- [x] Style pack JSON + one-click activate (`lowpoly-nature`)
- [x] Monetization scaffolding: gamepasses / developer products via Open Cloud (local fallback when API fails — surfaced in UI)
- [x] Foreign Rojo port warning when `:34872` is occupied by another process

## App platform

- [x] Multi-project Rojo slots + PTY retain across project switch
- [x] In-app Git panel + project zip backups under `userData/backups/`
- [x] Separate Open Cloud (publish/monetization) vs asset-upload API key fields
- [x] macOS installer on GitHub Releases (DMG + zip, x64 and arm64; unsigned until notarization secrets exist)
- [ ] macOS notarization / Developer ID signing (`APPLE_ID` + team secrets not wired)
- [x] electron-updater: launch check + Update banner; merge to `main` publishes GitHub Releases (`latest.yml`)
- [ ] Cloud project sync (local snapshot metadata only today)
- [ ] Community asset sharing (local opt-in manifest only)
- [ ] Code signing for Windows installers (release workflow supports CSC_* secrets; unsigned until certs exist)
## Product surface

- [x] Marketing website (`apps/web`)
- [x] Course / community structure (`docs/COURSE.md`)
- [ ] Electron e2e (Playwright static smoke + optional `BLOCKFORGE_E2E_APP` packaged launch; release workflow builds Windows artifacts)

## Non-goals for Blockforge

- Reselling AI model access
- Shipping proprietary asset banks scraped from commercial products
- Using Roblox trademarks in the product name

# Agent Instructions (generic)

See [CLAUDE.md](./CLAUDE.md) for the full Blockforge roblox-ts conventions, task recipes, Definition of Done, and **Swarm Mode** (Lead Claude + Agent Teams).

Also read:

- [docs/ALLOWED_SOURCES.md](./docs/ALLOWED_SOURCES.md) — refuse exploit / backdoor / script-hub code
- [docs/MODEL_JSON.md](./docs/MODEL_JSON.md) — `world/*.model.json` schema and coordinates
- [docs/REMOTE_EVENTS.md](./docs/REMOTE_EVENTS.md) — remotes and trust boundaries
- [docs/RBXTS_TIPS.md](./docs/RBXTS_TIPS.md) — common roblox-ts pitfalls
- [docs/examples/](./docs/examples/) — few-shot index (scripts + world JSON + GDD + map moods)
- `.claude/skills/` — domain skills (mapping, icons, backend, …). `npm run skills`

Before finishing any world edit, run `npm run validate:world`. Optional place audit: `npm run audit-scenery` and Studio `MapToolkit`. Before finishing TypeScript work, run `npm run build` (or rely on watch) and `npm run validate:refs`. Fix errors.

Studio Play errors (when the Blockforge bridge is installed) land in `.blockforge/studio-output.jsonl`.

If your CLI supports multi-agent / teammate modes, prefer the Swarm roles in CLAUDE.md (`world-builder`, `gameplay-coder`, `qa-verifier`) with the lead verifying gates before claiming done.

To open a **visible Blockforge desktop PTY tab** (any adapter) from the project folder:

```bash
node scripts/blockforge-ui-terminal.mjs spawn --adapter codex --label scratch
node scripts/blockforge-ui-terminal.mjs status
```

See CLAUDE.md § UI multi-terminal. Prefer Agent Teams for in-process Claude workers; use the UI script for extra adapters / side-by-side PTYs. Status mirror: `.blockforge/terminals.json`.

This file exists so non-Claude agents (Codex, OpenCode, etc.) discover the same rules.

`templateVersion`: **0.7.0**

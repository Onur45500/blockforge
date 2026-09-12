# Contributing

## Setup

```bash
npx pnpm install
npx pnpm --filter @blockforge/open-cloud build
npx pnpm typecheck
npx pnpm test
```

## Project rules

- TypeScript strict — no `any` (use `unknown` + guards)
- Named exports in services and hooks; React page components may default-export
- Never commit API keys; Open Cloud and generation keys live in app Settings or env vars
- Agent adapters must never add `--dangerously-skip-permissions`

## Agent accuracy / evals

First-try game generation quality is measured with `@blockforge/agent-evals`:

```bash
# Gates-only smoke (no Claude) — should always pass on a clean template
npx pnpm evals:dry

# Full headless Claude runs (requires `claude` logged in; uses subscription/API)
npx pnpm evals:run

# Tag a baseline before prompt changes, then compare latest-run.md
npx pnpm --filter @blockforge/agent-evals start -- --baseline
npx pnpm evals:run

# Optional in-engine probes (needs `rojo` + `run-in-roblox`)
npx pnpm evals:runtime
```

Results: `packages/agent-evals/results/latest-*.md` (gitignored). Track **pass rate** and **first-try** (passed without STOP GATE / validate retries in the transcript). See [MEASUREMENT.md](../packages/agent-evals/MEASUREMENT.md).

When changing `packages/project-template/CLAUDE.md`, `.claude/settings.json`, hooks, or `apps/desktop/src/shared/agent-bootstrap.ts`, run `evals:dry` at minimum and prefer a before/after `evals:run` pair.

## Course labs

See [COURSE.md](COURSE.md) for the community curriculum built on template examples.

### Expected improvement loop

1. Record baseline: `evals:run -- --baseline` → `results/latest-baseline.md`
2. Change prompts / hooks / validators
3. Re-run: `evals:run` → `results/latest-run.md`
4. Compare pass % and first-try %; keep changes that improve both without inflating turn count too much

## PRs

1. Run typecheck + tests
2. If you touch `packages/project-template`, ensure `rbxtsc` still compiles and `npm run validate:world` / `validate:refs` pass
3. If you touch Open Cloud client, add/adjust mocked unit tests for 401/429/operation polling
4. If you touch agent prompts/hooks, note eval dry-run (and full run if available) in the PR

## Releases

Merging to `main` runs [`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. Patch-bumps `apps/desktop/package.json` and the root `package.json` (or keeps a version you already raised above the latest `v*` tag)
2. Tags `vX.Y.Z` and publishes **Windows NSIS** plus **macOS DMG/zip** (Intel and Apple Silicon) to [GitHub Releases](https://github.com/Onur45500/blockforge/releases)
3. Packaged Blockforge checks that feed on launch; **Update** downloads and restarts

There is no iPhone/iPad build (Electron + Roblox Studio are desktop-only).

Skip a release with `[skip release]` in the merge commit message. Auto-update only runs in packaged builds, not `pnpm dev`.

Mac builds are **unsigned** until Apple Developer certs / notarization secrets are added (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Users can still install via Right-click → Open.

To ship a minor/major, bump `apps/desktop` (and root) `version` in the PR, e.g. `0.2.0`. CI will use that number if it is newer than the latest tag.

## License

MIT. By contributing, you agree your contributions are licensed under MIT.

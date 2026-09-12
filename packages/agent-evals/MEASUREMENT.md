# Agent eval measurement

First-try game generation quality is measured with `@blockforge/agent-evals`.

## Dry-run (no Claude, required in CI-adjacent work)

```bash
npx pnpm evals:dry
```

Reports:

- `template-health` — fresh-template `build`, `validate:world`, `validate:refs`
- `scenario-contracts` — each selected scenario requires the three gates plus feature assertions

Machine summary: `packages/agent-evals/results/latest-dry-run.md` (gitignored).

## Full Claude runs (uses subscription / API quota)

```bash
# Before prompt or bootstrap changes
npx pnpm --filter @blockforge/agent-evals start -- --baseline

# After changes
npx pnpm evals:run
```

Compare `results/latest-baseline.md` with `results/latest-run.md` for pass rate and first-try rate.

Optional in-engine probes (`rojo` + `run-in-roblox`):

```bash
npx pnpm evals:runtime
```

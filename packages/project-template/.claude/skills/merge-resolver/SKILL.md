---
name: merge-resolver
description: Use only when git conflict markers or a blocked cloud/sync merge must be resolved. Coding agents must not merge.
---

# Merge resolver

Normal agents: make **small commits** of your own work. Do **not** `git merge`, `git rebase`, or hand-edit conflict markers.

If you see `<<<<<<<`:

1. Stop implementing features.
2. Tell the user Blockforge Git dock / this skill must resolve it.
3. Prefer **keep disk** (filesystem is source of truth) unless the user asked to take the other side.

When you **are** resolving:

- Keep `world/` and `src/` compiling: `npm run build && npm run validate:world && npm run validate:refs`.
- Do not delete `CLAUDE.md`, `default.project.json`, or `tsconfig.json` “to end the conflict.”
- After resolve: one commit, then continue the original task.

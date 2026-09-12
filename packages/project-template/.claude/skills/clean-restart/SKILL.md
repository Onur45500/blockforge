---
name: clean-restart
description: Use when Rojo, Studio, rbxtsc, or the agent PTY is wedged (stale World, port busy, hung playtest).
---

# Clean restart

```bash
npm run clean-restart
```

That script prints checks; it does not kill the user’s Studio.

## Order

1. Stop Play in Studio (identity probes fail during playtest).
2. Blockforge Sync: Restart Rojo if `World` is missing while `world/` has files.
3. If port 34872 is owned by a **foreign** process, do not steal it — tell the user.
4. Release Studio locks: MCP `studio_release` if you held `studio_wait_for_turn`.
5. Do **not** rebuild `world/` as Part scripts to “fix” a missing World.

Never `--dangerously-skip-permissions`.

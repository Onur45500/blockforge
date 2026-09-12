---
name: notes
description: Use when reading or updating the project GDD / persistent markdown notes across sessions.
---

# Notes (persistent memory)

```
notes/
  README.md
  general/
  design/
```

```bash
npm run notes -- list
npm run notes -- init
```

- **Read** relevant notes before inventing names, economy, or lore.
- **Write** a short markdown slice when you add a system (`notes/design/<slug>.md`).
- Do not dump secrets or API keys into notes.
- Do not overwrite the whole tree; append/edit one file.

Starters: `notes/general/session-zero.md`, `notes/design/loop.md`, `notes/design/economy.md`, `notes/design/progression.md`.

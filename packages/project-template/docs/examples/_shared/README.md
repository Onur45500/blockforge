# Shared helpers (reference only)

Copy into `src/shared/` before combining examples that use remotes.

| File | Copy into | When |
|------|-----------|------|
| [ensure-remotes.ts](./ensure-remotes.ts) | `src/shared/ensure-remotes.ts` | Shop, RNG, teleport FX, or any second RemoteEvent |

Call `ensureRemoteEvent` from **server** scripts only. Clients `WaitForChild("Remotes")`.

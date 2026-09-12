# Security

## Trust boundaries

1. **Renderer** is untrusted. It only talks through the preload IPC allowlist.
2. **Main process** owns filesystem, PTY, network to Roblox Open Cloud / user-key AI providers, and secrets.
3. **AI agent** runs as a local subprocess with the user's privileges by default.

## Sandboxing tiers

- **Tier 0 (default):** agent as user subprocess (interactive CLI permission prompts remain the trust boundary).
- **Tier 1 (shipped):** optional **WSL2** launch — Settings → “Run agents in WSL2”. Doctor reports WSL availability. Project path is translated to `/mnt/...`.
- **Tier 2 (spike):** embedded Linux VM — see `spikes/sandbox-vm/`. Not wired into the app yet.

## Agent guardrails

- Never launch Claude Code with `--dangerously-skip-permissions` (or equivalent).
- PTY working directory is the project directory.
- Claude Code's interactive permission prompts must remain visible in the terminal.
- Users should treat agent sessions like running an unsupervised IDE assistant on their machine.

## Secrets

- Roblox Open Cloud API keys and optional Gemini / Meshy / ElevenLabs keys are encrypted with Electron `safeStorage` under the app userData directory.
- Keys are never sent to Blockforge servers.
- Do not commit `.env` files with live keys.
- Generation providers use **user-owned** keys only. A future Plus credits service (if any) must not resell coding-agent access.

## Privacy

- Agent prompts/completions travel from the CLI agent to its provider (e.g. Anthropic) directly.
- **Studio MCP** is a local Studio↔agent channel (Roblox’s built-in server). Blockforge does not proxy MCP traffic.
- Blockforge contacts Roblox Open Cloud for operations you trigger (asset upload, place publish, monetization scaffolding).
- Optional cloud-sync MVP stores snapshot metadata under local userData unless a remote bucket is configured later.
- **No telemetry by default.**

## Reporting issues

Open a GitHub issue for security bugs. Avoid posting live API keys.

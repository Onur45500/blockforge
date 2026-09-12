# Sandbox tier 2 — embedded Linux VM

Tier 1 (WSL2) ships in the desktop Settings toggle.

Tier 2 explores stronger isolation for agent subprocesses:

- Spike candidates: Lima (macOS/Linux), Firecracker (Linux hosts), or a
  minimal QEMU appliance with a shared project mount.
- Threat model: limit filesystem blast radius outside the project directory
  while preserving interactive permission prompts in the terminal.
- Non-goal: hosting or proxying model traffic.

Status: deferred spike folder — implement after WSL2 path is stable in prod.

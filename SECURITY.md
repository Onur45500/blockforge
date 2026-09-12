# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` / 0.1.x | Yes |

## Reporting a vulnerability

If the issue could leak **API keys**, allow **remote code execution**, or break
**tenant/project isolation** on a contributor machine:

1. Prefer **GitHub Private Vulnerability Reporting** on this repository (Security → Advisories).
2. Do **not** attach live Open Cloud, Anthropic, Gemini, or other keys to a public issue.

For lower-risk bugs (UI, docs, Doctor false positives), a normal GitHub issue is fine — still redact secrets.

Trust boundaries, sandbox tiers, and secret storage: [docs/SECURITY.md](docs/SECURITY.md).

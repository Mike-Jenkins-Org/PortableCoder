---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Design

## UX Principles
- Single entrypoint command (`pcoder`) for all providers.
- Explicit profile selection (`pcoder --profile <name> <tool> ...`).
- Deterministic local paths so USB portability works.
- Linux-runtime-first execution with explicit fallback to host-native mode.
- WSL may be used if present but must not be required.

## Configuration Model
- `profiles/profiles.json` for profile requirements and non-secret runtime options.
- `state/settings.json` for persisted onboarding settings (auth mode per tool, default runtime mode).
- Runtime secrets are injected from host environment variables per session.
- OAuth session/cache state is kept under `state/auth/` in the portable folder.
- No API key files are stored by default in MVP.

## Command Surface (v0.1)
- `pcoder doctor` — verify runtime and provider readiness
- `pcoder list-tools` — show installed/available adapters
- `pcoder runtime probe` — detect available Linux runtime backends on host
- `pcoder runtime bootstrap` — download/install Windows VM runtime payload
- `pcoder setup --init` — first-run onboarding settings
- `pcoder setup --codex-auth <oauth|api> --claude-auth <oauth|api>` — configure auth modes
- `pcoder auth status|login|logout <tool>` — manage auth sessions
- `pcoder run <tool>` — launch selected CLI with normalized env
- `pcoder profile use <name>` — switch active profile
- `pcoder run <tool> --mode linux-portable|host-native`
- `pcoder run <tool> --mode linux-portable --no-sync-back` (skip VM-to-host sync after run)

## MVP Tool Scope
- `codex`
- `claude`

## Windows Integration (optional)
- Context-menu bootstrap script
- Portable launch `.cmd` wrappers

## Non-goals (v0.1)
- Building a new coding model runtime from scratch
- Replacing provider CLIs
- Multi-user credential management server

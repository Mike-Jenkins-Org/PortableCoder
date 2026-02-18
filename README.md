# Portable Coder

Portable multi-provider coding CLI launcher with harness-first planning.

## Current Status
- Planning control-plane is established (`AGENTS.md`, `HARNESS_CHECKLIST.md`, `docs/*`).
- Active plan: `docs/exec-plans/active/EP-001-portable-coder-foundation-and-multi-provider-mvp.md`.
- MVP launcher exists: `scripts/pcoder` / `scripts/pcoder.cmd`.
- MVP platform scope is currently Windows-first.
- Windows target hosts: Windows 11, Server 2016, Server 2022, Server 2025.
- MVP tool scope is Codex + Claude only.
- WSL is optional when present, but not required.
- Primary Linux backend for Windows MVP is bundled QEMU VM.
- VM policy is try hardware acceleration first, then auto fallback to portable software mode.

## Quick Start
1. Run onboarding once: `scripts/pcoder setup --init`.
2. Choose auth modes as needed:
   - OAuth: `scripts/pcoder setup --codex-auth oauth --claude-auth oauth`
   - API keys: `scripts/pcoder setup --codex-auth api --claude-auth api`
3. Inject required env vars only for API mode (`OPENAI_API_KEY` and/or `ANTHROPIC_AUTH_TOKEN`).
4. Run `scripts/pcoder doctor`.
5. Launch in VM mode (Windows): `scripts/pcoder run <tool> --mode linux-portable`.
6. Use `--no-sync-back` if you do not want VM changes copied back automatically.

On Windows, `pcoder run` defaults to `--mode linux-portable`.

Auth management:
- `scripts/pcoder auth status`
- `scripts/pcoder auth login codex`
- `scripts/pcoder auth login claude`
- `scripts/pcoder auth logout codex`
- `scripts/pcoder auth logout claude`

Windows smoke test:
- `scripts/runtime/windows/smoke-check.cmd`

## CI
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Runner target: Depot-hosted runner label `depot-ubuntu-24.04`

## Claude PR Runner
- Workflow: `.github/workflows/claude-pr-runner.yml`
- Trigger: mention `@claude` in PR comments/reviews (or run manually via `workflow_dispatch`)
- Runner target: Depot-hosted runner label `depot-ubuntu-24.04`
- Configure one auth secret:
  - `ANTHROPIC_API_KEY` (API key mode), or
  - `CLAUDE_CODE_OAUTH_TOKEN` (OAuth mode)

Supported tool IDs:
- `codex`
- `claude`

## Planning Workflow
Read in order:
1. `AGENTS.md`
2. `HARNESS_CHECKLIST.md`
3. `docs/PLANS.md`
4. active ExecPlan in `docs/exec-plans/active/`

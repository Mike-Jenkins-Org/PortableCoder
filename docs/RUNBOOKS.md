---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Runbooks

## Project Bootstrap
1. Clone/copy repository to target machine.
2. Run bootstrap script to populate `runtime/` and `apps/`.
3. Run first-time onboarding: `pcoder setup --init`.
4. Set auth mode per tool:
   - `pcoder setup --codex-auth oauth --claude-auth oauth`
   - or `pcoder setup --codex-auth api --claude-auth api`
5. Inject credentials only when needed from shell/session environment for API-mode tools.
6. Run `pcoder doctor`.
7. Run `pcoder runtime probe` to see Linux runtime backend options on this host.

Example env injection:
```bash
export OPENAI_API_KEY=replace_me
export ANTHROPIC_AUTH_TOKEN=replace_me
```

## Runtime Modes
- `linux-portable` (primary on Windows): launch tools inside bundled Linux runtime.
- `linux-wsl` (optional): use host WSL when present.
- `host-native` (dev fallback): launch available local tool binaries.

Current implementation note:
- `linux-portable` execution path is currently implemented for Windows hosts.
- Non-Windows hosts should use `--mode host-native` for now.
- `linux-wsl` mode is planned but not yet implemented in `pcoder run`.

Backend spec:
- `docs/RUNTIME_WINDOWS_VM_BACKEND.md`
- VM acceleration policy: try hardware acceleration first, auto fallback to portable software mode.

## Windows Host Matrix (MVP)
- Windows 11: primary target
- Windows Server 2022: target
- Windows Server 2025: target
- Windows Server 2016: target (with software virtualization fallback accepted)

## VM Lifecycle Scripts
- Start VM: `scripts/runtime/windows/start-vm.cmd`
- Start VM implementation: `scripts/runtime/windows/start-vm.ps1`
- Stop VM: `scripts/runtime/windows/stop-vm.cmd`
- Smoke checklist: `scripts/runtime/windows/smoke-check.cmd`

## Linux-Portable Run Flow
1. `pcoder` starts/ensures VM via `start-vm.cmd`.
2. VM launcher attempts WHPX acceleration, then auto-fallback to TCG.
3. Project is copied into guest over SCP.
4. Tool command runs over SSH in guest project directory.
5. Project is copied back to host after run (unless `--no-sync-back`).

## Auth Operations
- Show auth modes and portable auth paths: `pcoder auth status`
- Login with OAuth in current default mode: `pcoder auth login codex`, `pcoder auth login claude`
- Logout in current default mode: `pcoder auth logout codex`, `pcoder auth logout claude`
- In API mode, auth login is optional and API keys are injected from the shell environment.

## First-Run Validation (Target)
- Windows VM smoke check: `scripts/runtime/windows/smoke-check.cmd`
- Windows: launch via `.cmd` wrapper and from terminal.
- macOS/Linux: launch via shell wrapper.
- Validate project path argument handling with spaces.
- Validate selected runtime mode is reflected in diagnostics output.

## Incident Recovery
- If runtime corruption is detected, clear `runtime/` and rerun bootstrap.
- If profile corruption is detected, restore `profiles/profiles.json` from version control.
- If provider auth fails, rotate and re-inject keys.

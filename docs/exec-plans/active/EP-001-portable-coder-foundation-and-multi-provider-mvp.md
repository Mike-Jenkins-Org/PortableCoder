---
owner: Mike Jenkins
last_verified: 2026-02-20
---

# EP-001 - Portable Coder Foundation and Multi-Provider MVP

## Purpose / Big Picture
Stand up a harness-first foundation and deliver a portable coder MVP that can run multiple coding CLIs from a machine-local folder (or removable media) without host-level installation steps.
Primary runtime direction: portable Linux (Ubuntu-like) execution where feasible, with host-native fallback.
Target Windows hosts for MVP: Windows 11, Server 2016, Server 2022, Server 2025.

Initial user target providers/tools:
- Codex
- Claude Code
- Deferred post-MVP: Kimi, GLM, MiniMax and others

## Progress
- [x] (2026-02-18) Created planning control-plane docs and governance artifacts
- [x] (2026-02-18) Create repository runtime skeleton (`runtime/`, `apps/`, `profiles/`, `state/`, `scripts/`)
- [x] (2026-02-18) Implement `pcoder` launcher and adapter contract
- [x] (2026-02-18) Implement `pcoder doctor` checks and provider profile loading
- [x] (2026-02-18) Add Windows `.cmd` and POSIX shell entrypoints
- [x] (2026-02-18) Seed profile and adapter catalog scaffolding, then narrow MVP scope to Codex/Claude
- [x] (2026-02-18) Validate launcher commands (`--help`, `list-tools`, `doctor`) on current host
- [x] (2026-02-18) Add runtime capability probing (`pcoder runtime probe`) and `runtime/linux/` placeholder layout
- [x] (2026-02-18) Decide MVP platform scope: Windows-first
- [x] (2026-02-18) Decide MVP tool scope: Codex + Claude only
- [x] (2026-02-18) Decide secrets policy: external injection only
- [x] (2026-02-18) Decide distribution policy: pre-bundled portable artifact
- [x] (2026-02-18) Decide WSL policy: optional only, never required
- [x] (2026-02-18) Decide no-install Windows Linux backend: bundled QEMU VM
- [x] (2026-02-18) Decide Ubuntu baseline: 24.04 LTS
- [x] (2026-02-18) Accept Server 2016 software virtualization fallback when acceleration is unavailable
- [x] (2026-02-18) Add Windows VM backend blueprint and script scaffolding
- [x] (2026-02-18) Finalize remaining MVP scope decisions (Q7, Q9)
- [x] (2026-02-18) Design Linux runtime backend contract and host fallback policy
- [x] (2026-02-18) Implement `pcoder run --mode linux-portable` flow (VM start, SSH execution, SCP sync)
- [x] (2026-02-18) Implement onboarding/settings and dual auth mode support (`pcoder setup`, `pcoder auth`, persistent portable state)
- [x] (2026-02-18) Add Windows smoke checklist scripts for VM boot/SSH/guest tool validation
- [x] (2026-02-18) Add Windows runtime bootstrap installer (`bootstrap-runtime`) to fetch QEMU/image and generate SSH keys
- [x] (2026-02-20) Validate Codex + Claude launches in one portable layout
- [x] (2026-02-20) Fix Windows bootstrap `ssh-keygen` argument handling for empty-passphrase key generation
- [x] (2026-02-20) Fix Windows VM start cloud-init port selection to fallback when default range is exhausted
- [x] (2026-02-20) Add Windows helper script to patch legacy `start-vm.ps1` cloud-init port fallback on existing local clones
- [x] (2026-02-20) Make Windows smoke SSH probe tolerate transient native-command connection errors during VM boot
- [ ] (2026-02-18) Document setup/runbook and close out EP-001

## Context and Orientation
Control docs and planning model:
- `AGENTS.md`
- `HARNESS_CHECKLIST.md`
- `docs/PLANS.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`

Primary build targets for EP-001:
- `scripts/pcoder` (main entrypoint)
- `scripts/pcoder.cmd` (Windows launcher)
- `scripts/pcoder.cjs` (launcher runtime)
- `scripts/runtime/windows/start-vm.cmd`
- `scripts/runtime/windows/start-vm.ps1`
- `scripts/runtime/windows/stop-vm.cmd`
- `scripts/adapters/*`
- `profiles/defaults/*`
- `runtime/linux/*` (planned)
- `runtime/linux/vm-manifest.json`
- `docs/RUNTIME_WINDOWS_VM_BACKEND.md`
- `docs/RUNBOOKS.md`

## Plan of Work
### A) Lock scope and safety constraints
Scope decisions complete for EP-001. Maintain decision artifacts as implementation evolves.

### B) Build runtime and adapter framework
Create deterministic portable directory structure and launcher contract with provider-specific env translation.

### C) Implement MVP tool paths
Enable Codex + Claude as required first-class launchers.

### D) Validate and harden
Run smoke validations, document recovery steps, and capture follow-up tech debt.

### E) Linux runtime strategy
Define and prototype first Linux runtime backend with deterministic fallback behavior.

## Concrete Steps
1. Keep decision records synchronized with runtime implementation updates.
2. Scaffold runtime directories and placeholder manifests.
3. Implement `pcoder` command surface:
   - `doctor`
   - `list-tools`
   - `run <tool>`
   - `profile use <name>`
4. Implement adapter modules for Codex and Claude.
5. Add Windows + POSIX wrappers and project-path argument handling.
6. Design and prototype Linux runtime mode (`linux-portable`) with no hard WSL dependency.
7. Add initial smoke scripts and update `docs/RUNBOOKS.md`.

## Validation and Acceptance
Acceptance criteria for EP-001:
- Planning system is in place and usable for future EPs.
- Portable launcher can invoke at least Codex and Claude using runtime env injection.
- `pcoder doctor` identifies missing runtime/tools/config with actionable errors.
- Windows and POSIX wrappers handle project paths that include spaces.
- Linux runtime architecture decision is captured with clear implementation path.
- Linux backend path works without requiring WSL preinstallation.

## Idempotence and Recovery
- Re-running scaffolding should not duplicate or corrupt existing profile files.
- Missing or bad profile files should produce deterministic diagnostics.
- Runtime can be rebuilt by clearing `runtime/` and rerunning bootstrap.

## Surprises & Discoveries
- 2026-02-18: Product direction expanded to prefer portable Linux runtime (Ubuntu-like) with host-native fallback.
- 2026-02-18: Host-level Node module type (`type: module`) from parent directory required launcher migration from `pcoder.js` to `pcoder.cjs`.
- 2026-02-18: User requires portable operation on Windows hosts without making WSL a prerequisite.
- 2026-02-18: MVP project handoff uses SCP sync in/out of VM instead of shared-folder mounts to reduce host dependency assumptions.
- 2026-02-18: OAuth + API dual-mode support required explicit onboarding state and per-tool auth-mode persistence.
- 2026-02-18: Profile resolution needed per-tool default fallback to avoid cross-provider env validation errors in API mode.
- 2026-02-20: Host-native and stubbed CI-equivalent validation passed on Linux host for Codex + Claude launch flows.
- 2026-02-20: Windows VM smoke validation remains target-specific and is still tracked separately from Linux-host checks.
- 2026-02-20: PowerShell `Start-Process -ArgumentList` rejected empty elements, so `ssh-keygen -N` required explicit empty-string handling.
- 2026-02-20: Some Windows hosts had no free ports in `38080-38120`; cloud-init server startup now needs fallback port allocation.
- 2026-02-20: On some PowerShell environments, transient `ssh` connection failures surfaced as exceptions; smoke probing must retry instead of aborting early.

## Decision Log
- 2026-02-18: Adopt harness-first planning model before implementation.
- 2026-02-18: Treat portable Linux runtime as preferred execution target for the product.
- 2026-02-18: Lock MVP scope to Windows only; macOS/Linux support deferred to follow-up EP.
- 2026-02-18: Lock MVP providers to Codex + Claude; defer others.
- 2026-02-18: Enforce external secret injection only (no stored secrets in portable artifact).
- 2026-02-18: Use pre-bundled distribution artifacts for machine-to-machine portability.
- 2026-02-18: WSL may be used if present but cannot be a runtime requirement.
- 2026-02-18: Primary Windows backend will be bundled QEMU VM for no-install Linux execution.
- 2026-02-18: Ubuntu 24.04 LTS selected as guest baseline.
- 2026-02-18: Runtime should try hardware acceleration first, then auto-fallback to portable software mode.

## Outcomes & Retrospective
- Pending.

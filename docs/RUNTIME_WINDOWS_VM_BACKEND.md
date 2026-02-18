---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Windows VM Backend (Portable Linux Runtime)

This document defines the MVP backend for Windows-hosted portable Linux execution.

## Goal
Run Codex and Claude Code inside a Linux guest from a portable folder/zip, with no WSL requirement.

## Backend Choice
- Primary backend: bundled QEMU VM
- Guest OS: Ubuntu 24.04 LTS
- WSL usage: optional only, never required

## Portable Folder Layout (Planned)
```text
PortableCoder/
  scripts/
    pcoder.cmd
    pcoder
    pcoder.cjs
    runtime/windows/start-vm.cmd
    runtime/windows/stop-vm.cmd
  runtime/
    qemu/
      qemu-system-x86_64.exe
      qemu-img.exe
      *.dll
    linux/
      images/
        ubuntu.qcow2
      cloud-init/
        user-data
        meta-data
      ssh/
        id_ed25519
        id_ed25519.pub
      vm-manifest.json
  apps/
    codex/
    claude/
  state/
    vm/
      qemu.pid
      qemu.log
      ssh-port.txt
```

## Launch Model
1. Host launcher checks runtime assets (`runtime/qemu/*`, `runtime/linux/images/*`).
2. Launcher starts QEMU guest with:
   - acceleration attempt: `whpx` first
   - automatic fallback: `tcg` if acceleration is unavailable/fails
   - fixed SSH forwarding from random available local port
   - state/log outputs under `state/vm/`
3. `pcoder run codex|claude --mode linux-portable` syncs project to guest via SCP, executes via SSH, then syncs back.
4. Stop flow gracefully shuts down guest and cleans stale PID metadata.
5. `scripts/runtime/windows/smoke-check.cmd` validates artifacts, VM boot mode, SSH readiness, and guest tool availability.

## Host Compatibility Notes
- Windows 11 / Server 2022 / Server 2025: target hosts.
- Server 2016: supported with software virtualization fallback accepted.
- Missing hardware acceleration should degrade to slower software mode, not hard fail.

## Security Notes
- Secrets are externally injected into host session at launch time.
- Do not persist provider secrets in VM disk image defaults.
- VM image updates should be versioned and checksummed.
- OAuth state is scoped to portable paths (`state/auth/*` on host and `/home/portable/.pcoder-auth/*` in guest).

## Acceptance Targets (MVP)
- Boot Linux guest from portable folder on supported Windows hosts.
- Run `codex` and `claude` from inside guest.
- No dependency on host WSL installation.
- Deterministic diagnostics for missing VM assets or launch failures.

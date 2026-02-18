---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Architecture

High-level boundaries and portability strategy for Portable Coder.

## Product Objective
A portable, machine-to-machine coder toolkit that runs multiple coding CLIs without requiring host-level system install.
Primary goal: run tools inside a portable Linux (Ubuntu-like) runtime whenever possible.

## Platform Support
- MVP target platform: Windows 11
- Additional target hosts: Windows Server 2016, 2022, 2025
- Post-MVP target platforms: macOS, Linux
- Preferred execution environment (long-term): bundled Linux runtime
- WSL can be used when available, but it is not a requirement

## Windows Backend Strategy (MVP)
- Primary backend: bundled QEMU VM running an Ubuntu-based Linux guest.
- Optional backend: host WSL runtime when available and explicitly selected.
- Non-goal: requiring WSL or preinstalled virtualization toolchains on host.
- Acceleration policy: try hardware acceleration first, auto fallback to portable software virtualization.

## Core Layers
1. `runtime/` — bundled dependencies and Linux runtime assets (rootfs, helper binaries)
2. `apps/` — provider tool wrappers and adapter configs
3. `profiles/` — user/provider profiles, endpoints, and model routing templates
4. `state/` — local cache, logs, and session state
5. `scripts/` — launchers, bootstrap/update scripts, diagnostics
6. `docs/` — planning and governance artifacts

## Boundary Rules
- Launcher scripts may read `profiles/` and `state/`, never hardcode secrets.
- Provider adapters should normalize env var contracts and CLI arguments.
- Secrets must be injected from host environment at runtime (no secret files in bundle).
- Onboarding preferences live in `state/settings.json`; OAuth cache is isolated under `state/auth/`.
- Runtime executor should not assume hypervisor/container tools are preinstalled.

## Runtime Modes
- `linux-portable` (preferred): launch CLIs inside bundled QEMU Ubuntu guest.
- `linux-wsl` (optional): use host WSL runtime if present.
- `host-native` (dev fallback): launch locally available binaries directly from host shell.

The launcher should support explicit mode selection and deterministic fallback rules.
No production path should require preinstalled WSL.

## Host Requirements (Expected)
- Ability to execute bundled binaries from portable folder.
- Sufficient CPU and memory for VM runtime.
- Sufficient disk space for VM image and workspace data.
- Administrator rights may improve acceleration options on some hosts, but are not assumed for baseline portability.

## Initial Provider Scope
- MVP: Codex and Claude Code only
- Deferred post-MVP: Kimi, GLM, MiniMax, and other provider adapters

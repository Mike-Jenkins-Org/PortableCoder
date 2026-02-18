# Windows Runtime Scripts

These scripts manage the portable Linux VM backend.

Current status:
- QEMU launch policy is implemented (WHPX first, TCG fallback).
- VM metadata files are written for launcher orchestration.

Scripts:
- `start-vm.cmd`
- `start-vm.ps1` (tries WHPX acceleration first, then falls back to TCG)
- `stop-vm.cmd`
- `smoke-check.cmd`
- `smoke-check.ps1` (artifact + VM + SSH + guest tool checks)

State files produced:
- `state/vm/qemu.pid`
- `state/vm/qemu-mode.txt`
- `state/vm/ssh-port.txt`
- `state/vm/qemu.log`
- `state/vm/qemu.err.log`

Smoke command:
- `scripts\runtime\windows\smoke-check.cmd`
- Optional: `scripts\runtime\windows\smoke-check.cmd -SkipToolChecks`

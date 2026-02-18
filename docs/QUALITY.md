---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Quality

## Quality Principles
- Portable-first: no host dependency assumptions.
- Reproducible setup: bootstrap steps produce same layout every time.
- Auditability: config + state layout is understandable and inspectable.

## v0.1 Quality Gates
- Bootstrap script creates complete expected directory tree.
- `pcoder doctor` detects missing runtime binaries and credentials cleanly.
- Tool launch works for at least Codex and Claude in same bundle.
- Windows launcher path handling works with spaces in project paths.
- Windows VM smoke check passes: `scripts/runtime/windows/smoke-check.cmd`.
- GitHub Actions CI executes on Depot runner `depot-ubuntu-24.04`.

## Future Automation Targets
- Add harness lint for required docs metadata and plan presence.
- Add macOS/Linux smoke scripts to mirror Windows checks.

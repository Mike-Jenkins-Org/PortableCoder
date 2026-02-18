---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Risk Register

Scales: Probability 1-5, Impact 1-5

| Risk | Prob | Impact | Mitigation | Owner | Review Cadence |
|---|---:|---:|---|---|---|
| Provider CLI changes break wrappers | 4 | 4 | Pin versions, add doctor checks, smoke tests | Mike | Biweekly |
| Credential leakage from portable media | 3 | 5 | External API key injection policy, OAuth state isolated under `state/auth`, clear operator guidance for removable-media handling | Mike | Weekly |
| Windows path/quoting breakage | 4 | 4 | argv spawning, path tests with spaces | Mike | Weekly |
| Runtime bundle size becomes unmanageable | 3 | 3 | staged downloads and selective tool install | Mike | Biweekly |
| Scope creep across too many tools in MVP | 4 | 4 | lock v0.1 tools and defer optional native adapters | Mike | Weekly |
| Windows Server 2016 performance may be reduced under software virtualization fallback | 4 | 3 | try hardware acceleration first, auto-fallback to software mode, document expected tradeoff | Mike | Weekly |

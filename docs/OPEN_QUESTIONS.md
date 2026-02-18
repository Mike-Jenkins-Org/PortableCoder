---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Open Questions

| QID | Status | Question | Why It Matters | Decision ID | Owner | Needed By |
|---|---|---|---|---|---|---|
| Q1 | Resolved (2026-02-18) | Should v0.1 ship Windows-only first, or Windows+macOS+Linux together? | Scope and delivery risk | D-001 | Mike | EP-001 kickoff |
| Q2 | Resolved (2026-02-18) | For GLM and MiniMax, do we require native CLIs in MVP or allow provider compatibility routing first? | Impacts adapter and test scope | D-002 | Mike | EP-001 kickoff |
| Q3 | Resolved (2026-02-18) | How should secrets be handled on removable storage (plain env file, encrypted file, or external injection only)? | Security and UX tradeoff | D-003 | Mike | EP-001 build step 1 |
| Q4 | Resolved (2026-02-18) | Do you want repo-distributed runtime binaries, or download/bootstrap on first run? | Repo size and compliance impact | D-004 | Mike | EP-001 build step 1 |
| Q5 | Open | What update policy should we target in MVP? | Operability across machines | D-005 | Mike | EP-002 planning |
| Q6 | Resolved (2026-02-18) | What Linux runtime backend policy should we enforce regarding WSL? | Determines portability and host prerequisites | D-006 | Mike | EP-001 kickoff |
| Q7 | Resolved (2026-02-18, 24.04 LTS) | Which Ubuntu baseline should we target first (22.04 LTS vs 24.04 LTS)? | Affects package compatibility and support window | D-007 | Mike | EP-001 kickoff |
| Q8 | Resolved (2026-02-18) | Which no-install Linux backend should be primary on Windows hosts (bundled QEMU VM vs alternative)? | Defines implementation path for Windows 11 + Server hosts | D-008 | Mike | EP-001 runtime design |
| Q9 | Resolved (2026-02-18, yes) | For Windows Server 2016, is reduced-performance software virtualization acceptable when hardware acceleration is unavailable? | Determines support expectations and acceptance criteria | D-009 | Mike | EP-001 runtime design |
| Q10 | Resolved (2026-02-18, dual mode) | Should MVP auth support OAuth only, API only, or both with persisted onboarding settings? | Determines onboarding UX and secret handling boundaries | D-010 | Mike | EP-001 implementation |

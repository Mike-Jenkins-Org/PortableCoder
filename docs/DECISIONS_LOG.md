---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# Decision Log

Status meanings:
- Open: not decided
- Proposed: options documented
- Decided: selected with rationale
- Implemented: shipped and verified
- Deprecated: replaced

| ID | Title | Status | Owner | Target Milestone | Evidence/Links |
|---|---|---|---|---|---|
| D-001 | Windows-first vs multi-OS simultaneous MVP | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-002 | MVP tool scope (Codex/Claude only vs wider provider set) | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-003 | Secret storage model for portable media | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-004 | Runtime distribution model (pre-bundled vs bootstrap-download) | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-005 | Update strategy (manual, scripted, auto-check) | Open | Mike | EP-002 | OPEN_QUESTIONS Q5 |
| D-006 | WSL policy for Windows hosts | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-007 | Linux base image strategy (Ubuntu LTS version and packaging format) | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-008 | Primary no-install Linux backend for Windows hosts | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-009 | Windows Server 2016 backend performance/support posture | Decided | Mike | EP-001 | EP-001 Decision Log (2026-02-18) |
| D-010 | Auth mode model (OAuth + API support with portable onboarding settings) | Decided | Mike | EP-001 | EP-001 implementation notes (2026-02-18) |

### D-001: Windows-first vs multi-OS simultaneous MVP
- Status: Decided
- Problem: Scope for initial delivery was split between Windows-only and cross-platform MVP.
- Options:
  - Windows-first MVP
  - Simultaneous Windows + macOS + Linux MVP
- Recommendation: Windows-first MVP.
- Rationale: Reduces execution risk and allows faster validation of portability model before broad platform support.
- Acceptance Criteria:
  - EP-001 scope and runbooks prioritize Windows flow.
  - Non-Windows support is explicitly marked post-MVP.
- Consequences:
  - Faster path to first usable release.
  - Cross-platform parity work deferred to a follow-up EP.
- Links: `docs/OPEN_QUESTIONS.md` (Q1), `docs/exec-plans/active/EP-001-portable-coder-foundation-and-multi-provider-mvp.md`

### D-002: MVP tool scope (Codex/Claude only vs wider provider set)
- Status: Decided
- Problem: Early plan included broader provider adapters that increased MVP scope.
- Options:
  - Codex + Claude only
  - Codex + Claude + additional provider adapters in MVP
- Recommendation: Codex + Claude only.
- Rationale: Narrowest path to deliver a stable portable MVP quickly.
- Acceptance Criteria:
  - Adapter catalog and docs list only Codex and Claude for MVP.
  - Other providers are explicitly deferred.
- Consequences:
  - Faster MVP delivery.
  - Additional provider adapters move to follow-up EP.
- Links: `docs/OPEN_QUESTIONS.md` (Q2), `scripts/adapters/catalog.json`

### D-003: Secret storage model for portable media
- Status: Decided
- Problem: Storing secrets on removable media increases leakage risk.
- Options:
  - Plain local env files
  - Encrypted local secret store
  - External injection only
- Recommendation: External injection only.
- Rationale: Avoids at-rest secrets on portable artifact.
- Acceptance Criteria:
  - MVP docs and config require shell/session env injection.
  - No default workflow writes secrets under repo paths.
- Consequences:
  - Safer default posture.
  - Slightly more manual launch process when secret-backed providers are used.
- Links: `docs/OPEN_QUESTIONS.md` (Q3), `profiles/profiles.json`, `profiles/defaults/README.md`

### D-004: Runtime distribution model (pre-bundled vs bootstrap-download)
- Status: Decided
- Problem: User wants machine-to-machine portability from a copied folder/zip.
- Options:
  - Bootstrap-download on first run
  - Pre-bundled binaries in distribution artifact
- Recommendation: Pre-bundled distribution artifact.
- Rationale: Guarantees offline portability and reduces setup friction on arbitrary hosts.
- Acceptance Criteria:
  - Release artifact can be copied to removable media and launched directly.
  - No mandatory first-run download for core runtime/tooling.
- Consequences:
  - Larger artifact size.
  - Stronger release packaging discipline required.
- Links: `docs/OPEN_QUESTIONS.md` (Q4), `docs/exec-plans/active/EP-001-portable-coder-foundation-and-multi-provider-mvp.md`

### D-006: WSL policy for Windows hosts
- Status: Decided
- Problem: Windows hosts may or may not have WSL installed.
- Options:
  - Require WSL
  - Disallow WSL entirely
  - WSL optional but never required
- Recommendation: WSL optional but never required.
- Rationale: Preserves portability requirement while allowing opportunistic use of existing WSL installations.
- Acceptance Criteria:
  - Portable runtime has a no-WSL-required execution path.
  - Runtime probe reports WSL availability but does not treat missing WSL as blocker.
- Consequences:
  - Need a bundled no-install Linux backend path for guaranteed portability.
  - Additional runtime implementation complexity.
- Links: `docs/OPEN_QUESTIONS.md` (Q6), `scripts/pcoder.cjs`

### D-008: Primary no-install Linux backend for Windows hosts
- Status: Decided
- Problem: MVP requires Linux backend portability across Windows 11 and Windows Server without requiring WSL.
- Options:
  - Bundled QEMU VM backend
  - Alternate backend that depends on host-installed components
- Recommendation: Bundled QEMU VM backend.
- Rationale: Best match for folder-level portability with no hard dependency on host WSL presence.
- Acceptance Criteria:
  - Portable artifact includes VM runtime components and launch scripts.
  - Linux backend launch path works even when WSL is absent.
- Consequences:
  - Artifact size increases.
  - Need explicit handling for slower software virtualization on some hosts.
- Links: `docs/OPEN_QUESTIONS.md` (Q8), `docs/RUNTIME_WINDOWS_VM_BACKEND.md`

### D-007: Linux base image strategy (Ubuntu LTS version and packaging format)
- Status: Decided
- Problem: Need a stable Ubuntu baseline for VM packaging and compatibility.
- Options:
  - Ubuntu 22.04 LTS
  - Ubuntu 24.04 LTS
- Recommendation: Ubuntu 24.04 LTS.
- Rationale: Selected as current baseline for MVP runtime image.
- Acceptance Criteria:
  - Runtime manifest and backend docs reference Ubuntu 24.04 LTS.
  - VM build/packaging assets align with chosen baseline.
- Consequences:
  - Future image updates track Ubuntu 24.04 patch lifecycle.
- Links: `docs/OPEN_QUESTIONS.md` (Q7), `runtime/linux/vm-manifest.json`, `docs/RUNTIME_WINDOWS_VM_BACKEND.md`

### D-009: Windows Server 2016 backend performance/support posture
- Status: Decided
- Problem: Some Server 2016 hosts may not provide hardware acceleration for virtualization.
- Options:
  - Require acceleration and drop unsupported hosts
  - Accept software virtualization fallback
- Recommendation: Accept software virtualization fallback.
- Rationale: Preserves no-install portability across target host set.
- Acceptance Criteria:
  - VM launcher attempts hardware acceleration first.
  - Launcher auto-fallbacks to portable software virtualization when needed.
  - Server 2016 remains a supported target with documented performance caveat.
- Consequences:
  - Potentially slower performance on some hosts.
  - Better portability coverage for mixed Windows environments.
- Links: `docs/OPEN_QUESTIONS.md` (Q9), `scripts/runtime/windows/start-vm.ps1`, `docs/RUNTIME_WINDOWS_VM_BACKEND.md`

### D-010: Auth mode model (OAuth + API support with portable onboarding settings)
- Status: Decided
- Problem: Portable runtime needs to support subscription OAuth users and API-key users without storing API secrets at rest.
- Options:
  - API-only mode
  - OAuth-only mode
  - Dual-mode support with per-tool configuration
- Recommendation: Dual-mode support with per-tool persisted settings.
- Rationale: Meets both subscription and API-key workflows while keeping API key handling external-injection only.
- Acceptance Criteria:
  - `pcoder setup` can persist auth mode per tool (`oauth|api`) and runtime defaults.
  - `pcoder auth status|login|logout` is available for Codex and Claude.
  - API mode keeps env-key injection requirements; OAuth mode persists session state to portable state paths.
- Consequences:
  - Additional operator setup step (`pcoder setup --init`).
  - OAuth cache lives on portable storage and must be treated as sensitive.
- Links: `scripts/pcoder.cjs`, `README.md`, `docs/SECURITY.md`, `docs/RUNBOOKS.md`

## Decision Record Template
### D-###: <Title>
- Status:
- Problem:
- Options:
- Recommendation:
- Rationale:
- Acceptance Criteria:
- Consequences:
- Links:

# Portable Coder — Agent Map (AGENTS.md)

This repository is run with harness-first planning. Treat `docs/` as the system of record.

## Read order (always)
1. This file
2. HARNESS_CHECKLIST.md
3. docs/SECURITY.md
4. docs/ARCHITECTURE.md
5. docs/PLANS.md
6. Active ExecPlan in docs/exec-plans/active/

## Non-negotiable rules
- No implementation work starts without an ExecPlan in `docs/exec-plans/active/`.
- Keep plan artifacts updated during execution, not after.
- Required control docs include `owner:` and `last_verified:` metadata.

## Work style
- Keep PRs small and reviewable.
- Prefer deterministic, cross-platform tooling.
- If blocked, improve docs/harness/tools instead of guessing.

# Codex Execution Guide (Harness-First Workflow)

Date: 2026-02-18

This repository uses harness-first execution. Repo docs + active plan are the source of truth.

## Operator Role
You prioritize work, approve plan scope, and validate outcomes.

## Standard Execution Loop
1. Confirm an ExecPlan exists in `docs/exec-plans/active/`.
2. Execute that plan end-to-end.
3. Update plan live while executing:
   - Progress checkboxes with dates
   - Decision log entries
   - Surprises/discoveries notes
4. Validate acceptance criteria.
5. Close out and move plan to `docs/exec-plans/completed/`.

## Prompt Template
```text
Read AGENTS.md and HARNESS_CHECKLIST.md first.
Then read docs/PLANS.md.

Execute the ExecPlan at:
docs/exec-plans/active/<EP-FILE>.md

Rules:
- Follow plan steps and required validations.
- Keep the plan updated as you work.
- Keep changes small and reviewable.
- If blocked, improve docs/harness/tools instead of guessing.

Output:
- Summary of changes
- Validation results
- Remaining risks and follow-up tasks
```

## Build-Required Intake
Idea intake files live in:
- `docs/exec-plans/build_required/`

Workflow:
1. Convert intake notes into full ExecPlans.
2. Move new plan into `docs/exec-plans/active/`.
3. Move processed intake notes into `docs/exec-plans/completed/` archive.

## Guardrails
- No implementation work without an active plan.
- Keep Windows compatibility from day 0.
- Prefer cross-platform scripts and deterministic runtime setup.

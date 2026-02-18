---
owner: Mike Jenkins
last_verified: 2026-02-18
---

# ExecPlans

ExecPlans are mandatory, living execution contracts for implementation work.

## Plan Directories
- Active: `docs/exec-plans/active/`
- Intake: `docs/exec-plans/build_required/`
- Completed: `docs/exec-plans/completed/`
- Debt tracker: `docs/exec-plans/tech-debt-tracker.md`

## Non-Negotiable Requirements
- Self-contained: a new contributor can execute with only repo + plan.
- Living state: update plan during execution, not after.
- Behavior-first: acceptance criteria must be observable.
- Safety-first: include idempotence and recovery notes.

## Required Sections in Every ExecPlan
- Purpose / Big Picture
- Progress
- Context and Orientation
- Plan of Work
- Concrete Steps
- Validation and Acceptance
- Idempotence and Recovery
- Surprises & Discoveries
- Decision Log
- Outcomes & Retrospective

## Execution Discipline
1. No implementation without a plan in `active/`.
2. Add timestamps on progress updates.
3. Record decisions and surprises as they happen.
4. Move completed plans to `completed/` after closeout.
5. Convert intake notes to full plans before implementation.

# Harness Engineering Checklist

## 1. Repository as System of Record
- [ ] `AGENTS.md` is concise and links to deeper docs
- [ ] Core docs exist: `ARCHITECTURE.md`, `DESIGN.md`, `QUALITY.md`, `PLANS.md`, `SECURITY.md`, `RUNBOOKS.md`
- [ ] Plan directories exist: `exec-plans/active`, `exec-plans/build_required`, `exec-plans/completed`
- [ ] Decisions are captured in repo artifacts, not only in chat
- [ ] Execution plans are first-class, versioned artifacts

## 2. Agent Legibility
- [ ] A fresh agent session can understand the system from repo docs alone
- [ ] Prompts start from `AGENTS.md`, checklist, and active plan
- [ ] Hidden tribal knowledge is promoted into docs or checks

## 3. Architecture Enforcement
- [ ] Layer boundaries are documented and enforced
- [ ] Security and portability constraints are explicit
- [ ] Runtime dependencies are deterministic and reproducible

## 4. Documentation Hygiene
- [ ] Key docs have owner + `last_verified`
- [ ] Docs are cross-linked through `docs/DOCS_INDEX.md`
- [ ] Stale docs are regularly reviewed and pruned

## 5. Quality and Recovery
- [ ] Acceptance criteria are behavior-first and testable
- [ ] Idempotence and rollback paths exist for each execution plan
- [ ] Risks, open questions, and decisions are tracked separately

## 6. Agent Workflow
- [ ] Every material task starts from an active ExecPlan
- [ ] Progress, decisions, and surprises are logged during execution
- [ ] Plan is moved to completed after closeout

## 7. Feedback Loops
- [ ] Validation commands are documented and repeatable
- [ ] Operator can quickly see state, risk, and next actions

## 8. Merge Philosophy
- [ ] Small changes and short-lived branches are preferred
- [ ] Corrections are cheap; waiting is expensive

## 9. Human Leverage
- [ ] Human focus is on intent, constraints, and acceptance
- [ ] Repeated review feedback is promoted into tooling/docs

# AF-INC-005: Workflow Intent Guardrails (CLI + Dashboard)

## Metadata
- Priority: P2
- Type: UX/Correctness
- Owner: CLI + Dashboard UX
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
The run was initiated with `idea-to-project` for a gap-analysis request, increasing risk of stalls and irrelevant work.

## Goal
Reduce workflow/task mismatch at launch time.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/cli/cli.ts`
- `/Users/Shared/Projects/shippulse/src/server/index.html`
- `/Users/Shared/Projects/shippulse/src/server/dashboard.ts`

## Scope
- Add lightweight intent classifier/rules:
  - Example: text patterns like `analyze repo ... missing epics/features` map to `project-gap-analysis`.
- In CLI:
  - Warn and suggest exact command for better workflow.
- In dashboard composer:
  - Show recommendation banner/default workflow selection.
- Add opt-out flag for power users.

## Out of Scope
- ML-based classifier.

## Acceptance Criteria
1. Given a clear gap-analysis task, CLI/dashboard recommends `project-gap-analysis`.
2. Given explicit user override, run continues with selected workflow.
3. Recommendation logic is deterministic and test-covered.

## Test Plan
- Unit tests for intent rule mapping.
- UI test for recommendation rendering in dashboard composer.

## Dependencies
- None.

## Rollout Notes
- Start as warn-only mode; evaluate false-positive rate before stricter enforcement.


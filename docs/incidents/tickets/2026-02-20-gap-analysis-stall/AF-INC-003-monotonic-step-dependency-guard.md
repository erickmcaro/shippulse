# AF-INC-003: Monotonic Step Dependency Guard

## Metadata
- Priority: P1
- Type: Data Integrity
- Owner: Step State Machine
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
During retries/recovery, upstream steps can be reclaimed while downstream steps are already running, causing out-of-order execution and inconsistent context handoff.

## Goal
Enforce strict step-order monotonicity for a run.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts`
- `/Users/Shared/Projects/shippulse/src/installer/status.ts`
- `/Users/Shared/Projects/shippulse/src/server/dashboard.ts`

## Scope
- Add claim-time guard:
  - Before claiming step `N`, verify all prior non-optional steps are `done`.
  - If violated, reject claim and emit explicit integrity event.
- Add fail/retry guard:
  - Prevent reopening an upstream step if any downstream step is `running` or `done`, unless explicit run-reset path is used.
- Add invariant telemetry for integrity violations.

## Out of Scope
- Redesign of loop-story semantics for `type: loop`.

## Acceptance Criteria
1. Given upstream step is reopened while downstream is running, claim is blocked and integrity event is emitted.
2. Given a normal linear pipeline, claims proceed unchanged.
3. Given manual recovery path, operator must explicitly reset downstream before reopening upstream.

## Test Plan
- Integration test reproducing out-of-order scenario from incident and asserting claim rejection.
- Regression test for standard `pending -> running -> done -> next` flow.

## Dependencies
- AF-INC-004 (placeholder rejection) recommended but not required.

## Rollout Notes
- Add audit log field `integrityGuard=true/false` for quick production diagnosis.


# AF-INC-001: Fail Fast on `sessions_spawn` Errors

## Metadata
- Priority: P1
- Type: Reliability
- Owner: Workflow Runtime
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
When `sessions_spawn` fails (for example `pairing required`), the claimed step may remain `running` until manual recovery.

## Goal
Ensure every spawn failure transitions to an explicit step failure in the same cron turn.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/installer/agent-cron.ts`
- `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts`
- `/Users/Shared/Projects/shippulse/src/cli/cli.ts`

## Scope
- Add deterministic fallback behavior in the polling/claim execution path:
  - If spawn call returns error, immediately execute `step fail <stepId> "<reason>"`.
- Emit explicit event trail (`step.failed` with spawn error detail).
- Prevent silent/implicit recovery-only behavior for this class of error.

## Out of Scope
- Model/provider rate-limit strategy.
- Dashboard UX changes (covered by AF-INC-006).

## Acceptance Criteria
1. Given `sessions_spawn` returns any non-success result, when cron turn continues, then `step.failed` is emitted and step status is updated in DB within the same turn.
2. Given a spawn failure, when querying logs, then error cause and related `stepId` are visible without manual transcript inspection.
3. Given this failure mode, no step remains `running` solely because spawn failed.

## Test Plan
- Add unit test for spawn-error branch (mock spawn error).
- Add integration test simulating spawn failure and asserting step transitions to failed/pending per retry policy.

## Dependencies
- None.

## Rollout Notes
- Behind feature flag optional (`SHIPPULSE_FAILFAST_SPAWN_ERROR=1`) for staged rollout.


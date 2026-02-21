# AF-INC-002: Adaptive Polling Timeout for Heavy Workflows

## Metadata
- Priority: P1
- Type: Performance/Reliability
- Owner: Workflow Runtime
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
Current polling timeout (`120s`) is too tight for heavy prompt + claim + spawn paths under degraded conditions.

## Goal
Increase resilience by sizing timeout to workflow/step complexity while preserving responsiveness.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/installer/agent-cron.ts`
- `/Users/Shared/Projects/shippulse/workflows/idea-to-project/workflow.yml`
- `/Users/Shared/Projects/shippulse/workflows/project-gap-analysis/workflow.yml`

## Scope
- Introduce adaptive timeout policy:
  - Baseline timeout by workflow class.
  - Optional per-agent/per-step override.
  - Safe upper bound to avoid runaway sessions.
- Keep backward compatibility with current `polling.timeoutSeconds`.

## Out of Scope
- Model provider-level retry policy tuning.

## Acceptance Criteria
1. Given a heavy workflow, when cron payload is generated, then timeout is >120s per policy.
2. Given a lightweight workflow, timeout remains near current baseline.
3. Given timeout override in workflow config, runtime honors override deterministically.

## Test Plan
- Unit tests for timeout resolution precedence.
- Snapshot test for generated cron payload with expected timeout values.

## Dependencies
- None.

## Rollout Notes
- Start with opt-in policy in selected workflows, then make default.


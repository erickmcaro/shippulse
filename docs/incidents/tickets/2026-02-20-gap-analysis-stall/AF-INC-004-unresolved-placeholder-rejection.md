# AF-INC-004: Unresolved Template Placeholder Rejection

## Metadata
- Priority: P1
- Type: Validation
- Owner: Step Resolution Layer
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
Downstream step input can contain unresolved placeholders like `[missing: missing_epics_json]`, allowing invalid work execution.

## Goal
Fail fast whenever resolved step input contains unresolved template tokens.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts`
- `/Users/Shared/Projects/shippulse/src/installer/output-validation.ts`

## Scope
- Add input integrity check after `resolveTemplate(...)` and before returning claim result:
  - Detect patterns: `[missing: ...]`, unresolved `{{...}}`, and empty required context placeholders.
- On detection:
  - Mark current step failed (retry-able per policy).
  - Emit structured event with missing keys.
- Add optional strict mode for all workflows, enabled by default for planning/gap workflows.

## Out of Scope
- Authoring-time lint for workflow YAML files.

## Acceptance Criteria
1. Given unresolved placeholder in resolved input, claim does not return executable input and step transitions through fail/retry policy.
2. Missing-key diagnostics include placeholder key names.
3. Valid resolved input is unaffected.

## Test Plan
- Unit tests for placeholder detector (positive/negative cases).
- Integration test for `project-gap-analysis` where `missing_epics_json` is absent.

## Dependencies
- None.

## Rollout Notes
- Emit remediation hint in step output: expected upstream key and source step.


# AF-INC-006: Stuck-Step Detection and Dashboard Alerts

## Metadata
- Priority: P2
- Type: Observability
- Owner: Dashboard + Events
- Source RCA: `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Problem
Operators could see `Claimed step` but had no immediate signal about why progress stopped.

## Goal
Surface likely-stuck states and probable causes in near real time.

## Target Areas
- `/Users/Shared/Projects/shippulse/src/server/dashboard.ts`
- `/Users/Shared/Projects/shippulse/src/server/index.html`
- `/Users/Shared/Projects/shippulse/src/medic/checks.ts`
- `/Users/Shared/Projects/shippulse/src/medic/medic.ts`

## Scope
- Add stuck-step heuristic:
  - Step in `running` beyond threshold (for example 3m warning, 10m critical).
- Correlate with recent known causes:
  - Timeout events.
  - Spawn errors.
  - Missing-placeholder validation failures.
- Display warning badge and root-cause hint in run detail panel.
- Emit dedicated event type for stuck detection.

## Out of Scope
- Auto-remediation that changes step state (informational only in this ticket).

## Acceptance Criteria
1. Given a running step exceeds warning threshold, dashboard shows warning with elapsed duration.
2. Given relevant error events exist, dashboard surfaces likely cause hint.
3. Given step recovers/completes, warning clears automatically.

## Test Plan
- Unit tests for stuck heuristic and cause correlation.
- UI test for warning rendering and clearance behavior.

## Dependencies
- AF-INC-001 and AF-INC-004 improve cause quality but are not blockers.

## Rollout Notes
- Thresholds configurable via env vars for tuning without code change.


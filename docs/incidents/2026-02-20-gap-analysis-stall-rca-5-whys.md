# RCA (Lean 5 Whys): Gap Analysis Run Stalled

## Incident Summary
- Incident window: February 20, 2026, 9:59 PM to 10:17 PM (America/New_York)
- User symptom: Dashboard showed `idea-to-project_planner Claimed step` with no visible progress for ~12+ minutes.
- Affected run: `7b339609-b12a-47aa-8a05-06dd001baae3` (`idea-to-project`)
- Related recovery run: `fc8d7c83-2cf8-4954-b5c4-acb6e6b471a9` (`project-gap-analysis`)

## Problem Statement
A workflow run appeared stuck after a step was claimed, and the dashboard did not show meaningful progression until manual intervention.

## Business Impact
- Delayed analysis delivery.
- Reduced trust in run-state visibility.
- Required manual operator recovery (`step fail`, re-claim, and manual completion).

## Timeline (America/New_York)
1. 9:59 PM: Run `7b339609...` started and advanced past `kb-scan`.
2. 10:00 PM: `ideate` claimed; no further completion events appeared.
3. 10:17 PM: Run was canceled by operator.
4. 10:17 PM: Correct workflow run `fc8d7c83...` started.
5. 10:21 PM to 10:22 PM: During recovery, `repo-scan` was reclaimed and completed again while `generate-missing-epics` was already running.
6. 10:22 PM: Pipeline advanced `generate-missing-features` before a stable `missing_epics_json` handoff.
7. 10:25 PM: Run completed after manual correction.

## Lean 5 Whys
1. Why did the run look stuck?
Because the claimed step did not produce a successful completion/failure transition visible to the pipeline.

2. Why did the claimed step not transition cleanly?
Because cron/session execution hit failure modes (timeout/aborted spawn/pairing failure), so the step was left in inconsistent running state.

3. Why were timeout and aborted spawn likely?
Because polling cron jobs are configured at `timeoutSeconds: 120`, which is tight for peek+claim+spawn+model+report in unstable conditions.

4. Why did this become an operator-visible stall rather than self-heal quickly?
Because recovery depends on periodic cleanup/retry and cooperative agent reporting; there is no immediate hard failure path when spawn fails before `step complete`/`step fail`.

5. Why did downstream data become inconsistent during recovery?
Because retries/manual fail-reclaim can reopen earlier steps, and pipeline advancement is not guarded by a monotonic dependency check that blocks downstream steps when upstream steps are re-entered.

## Root Cause
Primary root cause:
- Reliability gap in step lifecycle around spawn failure/timeout handling under a short cron timeout budget.

Contributing causes:
- Workflow selection mismatch at start (`idea-to-project` was used for a gap-analysis intent).
- Insufficient guardrails for step-state integrity during manual/automatic retries.
- Missing placeholder guard for unresolved template variables in downstream inputs.

## Evidence
- Run stalled after claim, then canceled:
  - `/Users/erickcaro/.openclaw/shippulse/events.jsonl:45`
  - `/Users/erickcaro/.openclaw/shippulse/events.jsonl:50`
  - `/Users/erickcaro/.openclaw/shippulse/shippulse.db` (runs/steps rows for `7b339609...`)
- Wrong workflow type for requested outcome:
  - `/Users/Shared/Projects/shippulse/workflows/idea-to-project/workflow.yml:1`
  - `/Users/Shared/Projects/shippulse/workflows/project-gap-analysis/workflow.yml:1`
- Timeout evidence:
  - `/Users/erickcaro/.openclaw/cron/runs/be4aa12e-c243-482b-a260-00f5af6525dd.jsonl:1`
- Spawn/pairing failure evidence:
  - `/Users/erickcaro/.openclaw/agents/project-gap-analysis_repo-analyst/sessions/d50aac1f-8874-44e9-b4c3-cd04dededcee.jsonl:11`
- Aborted/missing-tool-result evidence:
  - `/Users/erickcaro/.openclaw/agents/project-gap-analysis_repo-analyst/sessions/d50aac1f-8874-44e9-b4c3-cd04dededcee.jsonl:42`
  - `/Users/erickcaro/.openclaw/agents/project-gap-analysis_repo-analyst/sessions/d50aac1f-8874-44e9-b4c3-cd04dededcee.jsonl:43`
- Downstream unresolved placeholder evidence:
  - `/Users/erickcaro/.openclaw/agents/project-gap-analysis_feature-gap-designer/sessions/afbc322d-a1ef-40bc-b551-a82e227e7585.jsonl:9`
- Out-of-order recovery evidence (upstream step re-entered while downstream already running):
  - `/Users/erickcaro/.openclaw/shippulse/events.jsonl:56`
  - `/Users/erickcaro/.openclaw/shippulse/events.jsonl:57`
  - `/Users/erickcaro/.openclaw/shippulse/events.jsonl:59`
- Current timeout wiring from workflow config into cron payload:
  - `/Users/Shared/Projects/shippulse/src/installer/agent-cron.ts:90`
  - `/Users/Shared/Projects/shippulse/src/installer/agent-cron.ts:141`
  - `/Users/Shared/Projects/shippulse/src/installer/agent-cron.ts:153`
- Recovery/claim behavior and cleanup throttle:
  - `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts:415`
  - `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts:439`
  - `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts:463`
- Fail operation can reset step to pending without status guard:
  - `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts:1001`
  - `/Users/Shared/Projects/shippulse/src/installer/step-ops.ts:1056`

## Corrective Actions (Lean CAPA)
1. Add spawn-failure hard fail path.
- If `sessions_spawn` returns error, immediately call `step fail` in the same turn.
- Owner: ShipPulse workflow runtime.
- Priority: P1.

2. Increase or adapt polling timeout for heavy planner flows.
- Raise timeout above 120s for workflows that spawn sub-agents or use multi-step planning.
- Owner: Workflow maintainers.
- Priority: P1.

3. Add dependency integrity checks before claim.
- Block claiming step N if any step < N is not `done`.
- Owner: Step state machine.
- Priority: P1.

4. Reject unresolved template tokens before execution.
- If resolved input contains `[missing:` placeholders, auto-fail with actionable reason.
- Owner: Step resolution layer.
- Priority: P1.

5. Add workflow intent guardrails in CLI/dashboard.
- Detect mismatch between requested task intent and selected workflow; suggest/auto-switch to best match.
- Owner: CLI + dashboard UX.
- Priority: P2.

6. Improve stuck-step observability.
- Surface `running > N minutes` warnings in dashboard and include reason hints (timeout, spawn error, pairing required).
- Owner: Dashboard/server events.
- Priority: P2.

## Actionable Tickets
- Ticket pack: `/Users/Shared/Projects/shippulse/docs/incidents/tickets/2026-02-20-gap-analysis-stall/README.md`

## Verification Plan
- Run 20 back-to-back gap-analysis executions.
- Success criteria:
  - 0 runs stuck in `running` with no event progression for >3 minutes.
  - 0 downstream steps executed with unresolved placeholders.
  - 100% spawn failures immediately convert to explicit `step failed` events.

# CAPA Ticket Pack: Gap Analysis Stall (2026-02-20)

Source RCA:
- `/Users/Shared/Projects/shippulse/docs/incidents/2026-02-20-gap-analysis-stall-rca-5-whys.md`

## Ticket Index

| Ticket | Priority | Title | Owner |
|---|---|---|---|
| AF-INC-001 | P1 | Fail Fast on `sessions_spawn` Errors | Workflow Runtime |
| AF-INC-002 | P1 | Adaptive Polling Timeout for Heavy Workflows | Workflow Runtime |
| AF-INC-003 | P1 | Monotonic Step Dependency Guard | Step State Machine |
| AF-INC-004 | P1 | Unresolved Template Placeholder Rejection | Step Resolution Layer |
| AF-INC-005 | P2 | Workflow Intent Guardrails (CLI + Dashboard) | CLI + Dashboard UX |
| AF-INC-006 | P2 | Stuck-Step Detection and Dashboard Alerts | Dashboard + Events |

## Recommended Delivery Order
1. AF-INC-003
2. AF-INC-004
3. AF-INC-001
4. AF-INC-002
5. AF-INC-006
6. AF-INC-005

## Exit Criteria (Pack Level)
- No run executes downstream step N when upstream step < N is not definitively `done`.
- No run starts a step with unresolved `[missing:` placeholders.
- `sessions_spawn` errors produce explicit `step.failed` within the same cron turn.
- Long-running stuck steps surface warning state in dashboard within configured SLA.


# Definition of Ready (DoR)

A shared agreement that defines when a Product Backlog Item (PBI) is prepared enough to be pulled into a sprint.

## Purpose

The Definition of Ready ensures that:
- Teams don't commit to work that isn't understood
- Sprint planning is efficient and effective
- Surprises and blocked work during sprints are minimized
- Product Owners prepare items with sufficient detail
- Everyone has a shared understanding of "ready"

## Standard Definition of Ready

A PBI is ready for sprint planning when:

### 1. Clear Description
- [ ] User story follows standard format: "As a [user], I want [goal], so that [benefit]"
- [ ] The "why" (business value) is articulated
- [ ] The scope is clear and bounded

### 2. Acceptance Criteria Defined
- [ ] At least 3-5 acceptance criteria written
- [ ] Criteria are specific and testable
- [ ] Happy path and error scenarios covered
- [ ] Given-When-Then format used (or equivalent)

### 3. Estimated by Team
- [ ] Story points assigned through team estimation
- [ ] Estimate is within sprint capacity (typically ≤ 8 points)
- [ ] If larger, item has been discussed for splitting

### 4. Dependencies Identified
- [ ] External dependencies documented
- [ ] Cross-team dependencies communicated
- [ ] Technical dependencies understood
- [ ] No unresolved blocking dependencies

### 5. Small Enough
- [ ] Can be completed within one sprint
- [ ] Ideally 1-3 days of effort
- [ ] If uncertain, spike has been completed

### 6. Valuable
- [ ] Delivers demonstrable user value
- [ ] Contributes to sprint/release goal
- [ ] Priority is understood relative to other items

## DoR Checklist by Item Type

### User Stories

| Criteria | Required |
|----------|----------|
| User story format | ✓ |
| Business value stated | ✓ |
| Acceptance criteria (3-5) | ✓ |
| Estimated in story points | ✓ |
| Dependencies identified | ✓ |
| UX designs available (if UI) | ✓ |
| Fits in one sprint | ✓ |

### Bugs

| Criteria | Required |
|----------|----------|
| Clear reproduction steps | ✓ |
| Expected vs actual behavior | ✓ |
| Environment/version specified | ✓ |
| Severity/priority assigned | ✓ |
| Screenshots/logs attached | If applicable |
| Root cause identified | Preferred |

### Technical Tasks / Enablers

| Criteria | Required |
|----------|----------|
| Technical approach documented | ✓ |
| Success criteria defined | ✓ |
| Impact on other systems noted | ✓ |
| Estimated effort | ✓ |
| Rollback plan considered | If applicable |

### Spikes / Research

| Criteria | Required |
|----------|----------|
| Clear questions to answer | ✓ |
| Time-box defined | ✓ |
| Expected output specified | ✓ |
| Success criteria for answers | ✓ |

## DoR Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Product Backlog                          │
│  ┌─────────┐                                                │
│  │ New Item│                                                │
│  └────┬────┘                                                │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ Backlog         │◄── PO adds description, value          │
│  │ Refinement      │◄── Team asks questions                 │
│  │                 │◄── Acceptance criteria written          │
│  │                 │◄── Dependencies identified              │
│  └────┬────────────┘                                        │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ DoR Checklist   │                                        │
│  │ Review          │                                        │
│  └────┬────────────┘                                        │
│       │                                                     │
│       ├──── Not Ready ──► Return to Refinement              │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ ✓ READY         │──► Eligible for Sprint Planning        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Applying the DoR

### During Refinement

1. Review each candidate item against DoR
2. Identify gaps openly
3. Assign action items to close gaps
4. Mark items as Ready when criteria met

### During Sprint Planning

1. Only pull items marked as Ready
2. Quick DoR verification before commitment
3. If gaps found, return to backlog or address immediately
4. Document any DoR exceptions (rare)

### Handling Exceptions

Sometimes items enter a sprint without full DoR compliance:

**Acceptable exceptions**:
- Critical production issues
- Time-sensitive opportunities
- Items with well-understood risk

**Required for exceptions**:
- Team agrees to accept the risk
- Risk is documented
- Extra capacity buffered for unknowns

## Common DoR Failures

| Failure | Symptom | Prevention |
|---------|---------|------------|
| Vague acceptance criteria | "Make it user-friendly" | Use Given-When-Then |
| Missing dependencies | Blocked work mid-sprint | Explicit dependency review |
| Too large | Can't finish in sprint | Enforce size limit |
| No UX design | Delays waiting for mockups | Include UX in refinement |
| Unclear value | Team lacks motivation | PO explains "why" |

## DoR vs DoD

| Definition of Ready | Definition of Done |
|--------------------|-------------------|
| Before sprint starts | Before sprint ends |
| Is item ready to work on? | Is work truly complete? |
| Owned by Product Owner | Owned by Development Team |
| Input quality gate | Output quality gate |
| Enables planning | Enables release |

## Evolving Your DoR

The DoR should evolve with your team:

### Review Triggers
- Frequent blocked work due to unready items
- Sprint planning taking too long
- Team frustrated with unclear requirements
- New team members joining

### Evolution Process
1. Discuss in retrospective
2. Propose additions/removals
3. Trial for 2-3 sprints
4. Formalize if effective

### Sample Evolution

**Initial DoR** (new team):
- Clear description
- At least one acceptance criterion
- Estimated

**Mature DoR** (experienced team):
- Complete user story
- 3-5 acceptance criteria with scenarios
- Dependencies mapped
- UX designs attached
- API contracts defined
- Estimated and sized appropriately
- Security considerations noted

## Templates

### DoR Checklist Card

```
═══════════════════════════════════════
DEFINITION OF READY CHECKLIST
═══════════════════════════════════════
Item: _________________________________

[ ] Description clear and complete
[ ] User value articulated
[ ] Acceptance criteria (min 3)
[ ] Estimated by team (≤ 8 pts)
[ ] Dependencies identified
[ ] Fits in one sprint
[ ] [Team-specific criterion]
[ ] [Team-specific criterion]

Ready: [ ] Yes  [ ] No

If No, what's missing:
_______________________________________
_______________________________________

Action items to make ready:
_______________________________________
_______________________________________

Reviewed by: _____________ Date: _______
═══════════════════════════════════════
```

## Related Definitions

- Definition of Done
- Acceptance Criteria Standards
- Story Point Guidelines

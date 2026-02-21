# Story Point Guidelines

Guidelines for consistent story point estimation that enables predictable planning and team velocity tracking.

## Purpose

Story point guidelines help teams:
- Estimate consistently across different work items
- Build reliable velocity metrics
- Plan sprints and releases accurately
- Communicate effort expectations
- Avoid common estimation pitfalls

## What Story Points Measure

Story points represent the **relative effort** to complete a user story, combining:

| Factor | Description | Example Impact |
|--------|-------------|----------------|
| **Complexity** | Technical difficulty, unknowns | Complex algorithm vs simple CRUD |
| **Effort** | Amount of work involved | 10 fields vs 2 fields |
| **Risk** | Uncertainty, potential issues | New technology vs familiar patterns |

### Story Points Are NOT

- Hours or days of work
- A measure of individual productivity
- Comparable between teams
- Precise predictions

## Standard Point Scale

### Fibonacci Sequence

Most teams use Fibonacci numbers: **1, 2, 3, 5, 8, 13, 21**

The gaps grow larger because humans estimate better in relative buckets than precise numbers.

### Point Definitions

| Points | Complexity | Typical Characteristics |
|--------|------------|------------------------|
| **1** | Trivial | Well-understood, minimal code change, no unknowns |
| **2** | Simple | Straightforward, single component, clear approach |
| **3** | Moderate | Some complexity, multiple components, known patterns |
| **5** | Significant | Notable complexity, some unknowns, multiple integrations |
| **8** | Complex | High complexity, significant unknowns, cross-system impact |
| **13** | Very Complex | Major effort, many unknowns, consider splitting |
| **21** | Epic-sized | Too large for a sprint, must be split |

### Reference Examples

Establish team-specific reference stories:

| Points | Reference Story | Why This Size |
|--------|-----------------|---------------|
| 1 | Change button label | Config change, no logic |
| 2 | Add form field with validation | Single field, known pattern |
| 3 | Build simple CRUD page | Multiple parts, familiar tech |
| 5 | Integrate third-party API | Unknowns, error handling |
| 8 | Build reporting dashboard | Multiple components, data aggregation |
| 13 | Implement payment processing | Complex, security requirements, testing |

## Estimation Process

### Planning Poker Steps

1. **Present**: Scrum Master reads the user story
2. **Discuss**: Team asks clarifying questions (5 min max)
3. **Estimate**: Each member privately selects a card
4. **Reveal**: All cards shown simultaneously
5. **Discuss differences**: High and low explain reasoning
6. **Re-estimate**: Vote again if needed
7. **Record**: Document the agreed estimate

### Handling Disagreements

When estimates diverge significantly:

| Scenario | Action |
|----------|--------|
| 1 vs 3 | Quick discussion, usually converges |
| 2 vs 8 | Deeper discussion, different assumptions |
| 1 vs 13 | Stop - someone has information others lack |

**Resolution steps**:
1. High estimator explains concerns
2. Low estimator explains assumptions
3. Identify what's different
4. Align on scope and approach
5. Re-vote

### Special Cards

| Card | Meaning | Action |
|------|---------|--------|
| **?** | Need more information | PO clarifies, then re-estimate |
| **∞** | Too big to estimate | Must split before estimating |
| **☕** | Need a break | Take 5 minutes |

## Size Guidelines

### Ideal Story Size

- **Target**: 1-5 story points
- **Maximum**: 8 points (can complete in one sprint)
- **Minimum**: 1 point (meaningful work unit)

### When to Split

Consider splitting when:
- Estimate exceeds 8 points
- Contains multiple "and" clauses
- Team can't agree on estimate
- More than 3 acceptance criteria sections
- Work spans multiple systems/components

### Splitting Strategies

| Strategy | When to Use |
|----------|-------------|
| **By workflow** | Multi-step user journeys |
| **By data** | Multiple data types or sources |
| **By operation** | CRUD (create, read, update, delete) |
| **By complexity** | Simple case first, then edge cases |
| **By platform** | Web, mobile, API separately |

## Estimation by Work Type

### User Stories

Standard estimation based on:
- UI complexity
- Business logic
- Data operations
- Integration needs
- Testing effort

### Bugs

| Bug Type | Points Guidance |
|----------|-----------------|
| Cosmetic | 1 point |
| Simple fix | 1-2 points |
| Moderate investigation needed | 2-3 points |
| Complex root cause | 3-5 points |
| Unknown cause | Create spike first |

### Technical Tasks

| Task Type | Points Guidance |
|-----------|-----------------|
| Config change | 1 point |
| Minor refactor | 1-2 points |
| Add monitoring/logging | 2-3 points |
| Infrastructure update | 3-5 points |
| Major refactor | 5-8 points (or split) |

### Spikes (Research)

Spikes are time-boxed, not point-estimated:
- Small spike: 1-2 days → 2-3 points
- Medium spike: 3-4 days → 5 points
- Large spike: 1 week → 8 points (rare, usually split)

## Common Estimation Mistakes

### Mistake 1: Estimating Hours

❌ **Wrong**: "This is 8 hours, so 8 points"
✓ **Right**: "This is similar in complexity to our 3-point reference story"

### Mistake 2: Individual Estimation

❌ **Wrong**: "I could do this in 1 day"
✓ **Right**: "This is 3 points regardless of who does it"

### Mistake 3: Anchoring

❌ **Wrong**: Senior says "2" first, everyone agrees
✓ **Right**: Silent selection, simultaneous reveal

### Mistake 4: Precision Illusion

❌ **Wrong**: "This is exactly 4.5 points"
✓ **Right**: "This is between a 3 and 5, so it's a 5"

### Mistake 5: Excluding Testing

❌ **Wrong**: "The coding is 3 points" (ignoring tests)
✓ **Right**: Include all work: code, tests, review, documentation

### Mistake 6: Forgetting Integration

❌ **Wrong**: Estimate component in isolation
✓ **Right**: Include integration effort

## Velocity and Planning

### Calculating Velocity

```
Velocity = Story Points Completed per Sprint
```

Use rolling average of last 3 sprints:

| Sprint | Points Completed |
|--------|-----------------|
| Sprint 1 | 35 |
| Sprint 2 | 42 |
| Sprint 3 | 38 |
| **Average** | **38.3** |

### Planning with Velocity

```
Sprint Capacity = Average Velocity × Focus Factor

Example:
- Average velocity: 38 points
- Focus factor: 85% (accounting for meetings, support)
- Sprint capacity: 38 × 0.85 = ~32 points
```

### Velocity Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Inflating points | Artificial velocity increase | Focus on consistency |
| Velocity targets | Pressure corrupts estimates | Use as forecast, not target |
| Comparing teams | Different calibrations | Each team is unique |
| Ignoring trends | Missing warning signs | Review velocity retrospectively |

## Calibration Techniques

### Reference Story Baseline

Maintain a calibration document:

```markdown
## Team Reference Stories

### 1 Point
- US-45: Add tooltip to dashboard button
- US-78: Update error message text

### 2 Points
- US-23: Add email validation to form
- US-89: Create simple API endpoint

### 3 Points
- US-12: Build user profile page
- US-56: Implement password reset flow

### 5 Points
- US-34: Integrate Stripe payment
- US-67: Build search with filters

### 8 Points
- US-90: Multi-step onboarding wizard
- US-123: Real-time notification system
```

### Estimation Review

In retrospectives, review:
- Stories that took longer than expected
- Stories that were easier than expected
- What was missed in the estimate?
- Update reference stories if needed

## Quick Reference

### Estimation Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                STORY POINT QUICK GUIDE                       │
├─────────────────────────────────────────────────────────────┤
│  1 pt  │ Trivial: config change, text update                │
│  2 pts │ Simple: single component, clear approach           │
│  3 pts │ Moderate: some complexity, known patterns          │
│  5 pts │ Significant: multiple parts, some unknowns         │
│  8 pts │ Complex: many unknowns, cross-system               │
│  13 pts│ Very complex: consider splitting                   │
│  21+ pts│ Too large: MUST split                              │
├─────────────────────────────────────────────────────────────┤
│  REMEMBER:                                                   │
│  • Points = Complexity + Effort + Risk                       │
│  • Points ≠ Hours                                            │
│  • Team consensus required                                   │
│  • When in doubt, go higher                                  │
└─────────────────────────────────────────────────────────────┘
```

## Related Guidelines

- Estimation Techniques Playbook
- Sprint Planning Playbook
- Definition of Ready

# Estimation Techniques Playbook

A comprehensive guide to agile estimation methods, helping teams predict effort and plan effectively while acknowledging inherent uncertainty.

## Purpose

Estimation helps teams plan work, set expectations, and improve predictability. Good estimates are:
- **Collaborative**: Based on team discussion and consensus
- **Relative**: Comparing items to each other, not absolute time
- **Iterative**: Refined as understanding improves
- **Honest**: Acknowledging uncertainty

## Estimation Philosophy

### Why We Estimate

1. **Planning**: Determine what fits in a sprint or release
2. **Prioritization**: Help PO make trade-off decisions
3. **Forecasting**: Predict delivery timelines
4. **Team health**: Identify overcommitment risks

### What Estimates Are NOT

- Commitments or contracts
- Targets to be punished for missing
- Individual performance metrics
- Precise predictions

## Estimation Methods

### 1. Story Points

**Best for**: Sprint-level work, relative sizing

Story points measure the relative effort of work items, combining:
- **Complexity**: How hard is this technically?
- **Uncertainty**: How much is unknown?
- **Volume**: How much work is involved?

#### Fibonacci Sequence

Most teams use Fibonacci numbers: 1, 2, 3, 5, 8, 13, 21

| Points | Description | Example |
|--------|-------------|---------|
| 1 | Trivial, minimal effort | Config change, text update |
| 2 | Simple, well-understood | Basic CRUD operation |
| 3 | Moderate complexity | Feature with known patterns |
| 5 | Significant work | New component with some unknowns |
| 8 | Complex work | Integration with external system |
| 13 | Very complex | Major feature with many unknowns |
| 21 | Epic-sized | Should probably be split |

#### Using Reference Stories

Maintain calibration stories:
```
1 point  = "Change button color" (LoginPage update, 2 hours)
3 points = "Add form validation" (RegistrationForm, 1 day)
5 points = "Build settings page" (UserSettings, 2-3 days)
8 points = "Integrate payment API" (PaymentService, 1 week)
```

### 2. Planning Poker

**Best for**: Building team consensus

#### How to Run Planning Poker

1. **Present**: Scrum Master reads the item
2. **Discuss**: Team asks clarifying questions (2-5 min)
3. **Estimate**: Each member privately selects a card
4. **Reveal**: All cards shown simultaneously
5. **Discuss Outliers**: High and low estimators explain reasoning
6. **Re-vote**: If needed, vote again after discussion
7. **Record**: Document the agreed estimate

#### Tips for Effective Planning Poker

- Don't anchor (hide estimates until reveal)
- Time-box discussions
- Focus on why estimates differ, not who is "right"
- Use "?" card for items needing more info
- Use "∞" or "Too Big" for items to split

### 3. T-Shirt Sizing

**Best for**: High-level roadmap planning, initial backlog triage

| Size | Relative Effort | Story Points Equivalent |
|------|-----------------|------------------------|
| XS | Hours | 1 |
| S | Days | 2-3 |
| M | ~1 week | 5 |
| L | ~2 weeks | 8-13 |
| XL | 2+ weeks | 13+ (split it) |

### 4. The Elatta Method

**Best for**: Detailed technical estimation

The Elatta method breaks work into four categories:

| Category | What It Covers | Estimation Factors |
|----------|----------------|-------------------|
| **UI** | User interface | Components, screens, interactions, accessibility |
| **Logic** | Business rules | Algorithms, validations, integrations |
| **Data** | Persistence | Queries, migrations, caching, API calls |
| **Test** | Quality assurance | Unit tests, integration tests, E2E |

#### Elatta Estimation Process

1. Break the item into UI, Logic, Data, Test components
2. Estimate each category separately (1-5 scale)
3. Sum for total complexity score
4. Map to story points using team's calibration

**Example**:
```
Feature: Export user data to CSV

UI:     2 (button, progress indicator, download)
Logic:  3 (format data, handle large datasets)
Data:   2 (query user records, pagination)
Test:   2 (unit tests, integration test)
-------------------
Total: 9 → Maps to 8 story points
```

### 5. Affinity Estimation

**Best for**: Quickly estimating many items

1. Write each item on a card/sticky
2. Team silently arranges items in columns (S, M, L, XL)
3. Discuss items that seem misplaced
4. Convert columns to story points

## Handling Estimation Challenges

### Unknown Complexity

When facing significant unknowns:

1. **Create a spike**: Time-boxed research to reduce uncertainty
2. **Estimate with range**: "This is 5-13 points depending on API complexity"
3. **Split and defer**: Estimate the known part, create a separate item for unknowns

### Large Items

Items larger than 13 points should be split:

1. Identify the INVEST criteria violation
2. Use splitting patterns (workflow, data, operations)
3. Re-estimate each resulting item

### Team Disagreement

When estimates diverge significantly:

1. Have outliers explain their reasoning
2. Identify hidden assumptions
3. Look for missing information
4. Re-vote with new understanding
5. If still diverging, go with higher estimate + create risk item

### New Team Members

Help new members calibrate:

1. Share reference story list
2. Have them estimate privately first
3. Explain team's reasoning process
4. Review historical estimates vs actuals

## Improving Estimates Over Time

### Track Accuracy

Calculate estimation accuracy:
```
Accuracy = Completed Points / Committed Points × 100
```

Aim for 80-90% accuracy (not 100% - that suggests padding).

### Retrospective Review

In sprint retrospectives:
- Which items were significantly over/under estimated?
- What did we miss?
- Should reference stories be updated?
- Are certain types of work consistently mis-estimated?

### Velocity Tracking

Track velocity (points completed per sprint):
- Use 3-sprint rolling average
- Note factors affecting velocity
- Don't game the metric

## Estimation Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Anchoring** | First estimate biases others | Hide estimates until reveal |
| **Pressure to reduce** | Estimates become targets | Protect team from external pressure |
| **Individual estimates** | Miss team knowledge | Always estimate as a team |
| **Precision illusion** | "12.5 story points" | Use discrete scales |
| **Estimate = time** | Story points become hours | Keep them relative |
| **Not re-estimating** | Stale estimates | Update when scope changes |

## Quick Reference

### When to Use Each Method

| Situation | Recommended Method |
|-----------|-------------------|
| Sprint planning | Planning Poker with Story Points |
| Release planning | T-Shirt Sizing or Affinity |
| Technical breakdown | Elatta Method |
| Quick triage | Affinity Estimation |
| Single item | Planning Poker |

### Estimation Meeting Template

```
1. Review reference stories (2 min)
2. Present item (2 min)
3. Questions and clarification (3 min)
4. Initial estimate (1 min)
5. Discussion of outliers (3 min)
6. Final estimate (1 min)
---
Total per item: ~12 minutes
```

## Related Playbooks

- Sprint Planning Playbook
- Backlog Refinement Playbook
- Definition of Ready

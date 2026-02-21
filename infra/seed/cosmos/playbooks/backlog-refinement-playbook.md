# Backlog Refinement Playbook

A guide to conducting effective backlog refinement sessions that prepare items for sprint planning and maintain a healthy, prioritized backlog.

## Purpose

Backlog refinement (formerly "grooming") is the ongoing process of reviewing, clarifying, and preparing product backlog items. The goal is to ensure items near the top of the backlog are ready to be pulled into a sprint.

## Refinement Principles

1. **Continuous, not event-driven**: Refinement happens throughout the sprint, not just in meetings
2. **Collaborative**: Involves PO, development team, and sometimes stakeholders
3. **Just-in-time**: Refine items 1-2 sprints ahead, not the entire backlog
4. **Value-focused**: Always connect work back to business outcomes

## When to Refine

### Recommended Cadence

- **Weekly sessions**: 1-2 hours per week (or 10% of sprint capacity)
- **Ad-hoc**: As new items emerge or priorities shift
- **Pre-planning**: Quick review 1-2 days before sprint planning

### Signs You Need More Refinement

- Sprint planning takes too long
- Many items fail to meet Definition of Ready
- Team frequently discovers surprises during sprints
- Estimates vary wildly for similar work

## The Refinement Process

### Step 1: Review and Prioritize (PO-led)

1. Present upcoming items in priority order
2. Explain business context and value
3. Share any new information or constraints
4. Answer initial questions

### Step 2: Clarify and Discuss (Team-led)

1. Ask clarifying questions
2. Identify technical considerations
3. Surface dependencies and risks
4. Discuss potential approaches

### Step 3: Define Acceptance Criteria

1. Collaboratively write acceptance criteria
2. Use Given/When/Then format for clarity
3. Include edge cases and error scenarios
4. Ensure criteria are testable

### Step 4: Estimate (Team-led)

1. Use planning poker or similar technique
2. Discuss outliers to build shared understanding
3. Re-estimate if new information emerges
4. Consider using relative sizing (story points)

### Step 5: Validate Readiness

Check against Definition of Ready:
- [ ] Clear description and acceptance criteria
- [ ] Estimated by the team
- [ ] Dependencies identified
- [ ] Small enough for one sprint
- [ ] Value articulated

## Breaking Down Large Items

### Splitting Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **Workflow steps** | Multi-step processes | Split "checkout" into cart, payment, confirmation |
| **Business rules** | Complex logic | Split by rule: "basic validation" vs "advanced rules" |
| **Data variations** | Multiple data types | Split by format: "import CSV" vs "import JSON" |
| **Operations** | CRUD functionality | Split into create, read, update, delete |
| **User types** | Role-based features | Split by role: "admin view" vs "user view" |
| **Platform** | Cross-platform work | Split by platform: web, mobile, API |

### INVEST Criteria for Split Items

After splitting, each item should still be:
- **I**ndependent: Can be developed separately
- **N**egotiable: Details can be discussed
- **V**aluable: Delivers user value
- **E**stimable: Team can estimate it
- **S**mall: Fits in a sprint
- **T**estable: Has clear acceptance criteria

## Estimation Techniques

### Planning Poker

1. Present the item
2. Each team member selects a card privately
3. Reveal cards simultaneously
4. Discuss differences (especially outliers)
5. Re-vote if needed

### T-Shirt Sizing

For early-stage items or roadmap planning:
- **XS**: Few hours
- **S**: 1-2 days
- **M**: 3-5 days
- **L**: 1-2 weeks
- **XL**: Needs splitting

### Reference Stories

Maintain a set of reference stories at each point value:
- "This feels like our login feature (3 points)"
- "This is similar to the report export (5 points)"

## Handling Different Item Types

### Features

- Focus on user value and outcomes
- Include UI/UX considerations
- Consider accessibility requirements

### Technical Debt

- Explain the risk of not addressing
- Quantify impact where possible
- Link to affected features

### Bugs

- Include reproduction steps
- Define expected vs actual behavior
- Prioritize based on severity and frequency

### Spikes (Research)

- Time-box the investigation
- Define specific questions to answer
- Plan for follow-up items

## Meeting Facilitation

### Before the Meeting

1. PO identifies items to refine (2-3 sprints ahead)
2. Share items with team 24 hours in advance
3. Prepare any supporting materials (mockups, data)

### During the Meeting

1. Time-box each item (10-15 minutes)
2. Use a visible timer
3. Park detailed technical discussions
4. Capture action items and questions

### After the Meeting

1. Update items with new information
2. Follow up on open questions
3. Share summary with stakeholders if needed

## Common Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Refining too far ahead** | Waste effort on items that change | Focus on 1-2 sprints ahead |
| **No PO involvement** | Team lacks business context | Require PO attendance |
| **Design by committee** | Endless discussions | Time-box, defer to experts |
| **Skipping estimation** | Surprises in sprint planning | Always estimate |
| **Not writing things down** | Knowledge lost | Update items in real-time |

## Quality Indicators

Track these metrics to measure refinement effectiveness:

- **Ready rate**: % of items meeting DoR at planning
- **Refinement velocity**: Items refined per session
- **Carryover rate**: Items not completed due to poor refinement
- **Re-estimation rate**: How often estimates change significantly

## Templates

### Refinement Meeting Agenda

```
1. Review action items from last session (5 min)
2. Item 1: [Title] - Discussion and estimation (15 min)
3. Item 2: [Title] - Discussion and estimation (15 min)
4. Item 3: [Title] - Discussion and estimation (15 min)
5. Item 4: [Title] - Discussion and estimation (15 min)
6. Wrap-up and action items (5 min)
```

### Item Refinement Checklist

- [ ] Description is clear and complete
- [ ] Acceptance criteria defined
- [ ] Dependencies identified
- [ ] Risks documented
- [ ] Estimated by team
- [ ] Meets Definition of Ready

## Related Playbooks

- Sprint Planning Playbook
- User Story Writing Playbook
- Estimation Techniques Playbook

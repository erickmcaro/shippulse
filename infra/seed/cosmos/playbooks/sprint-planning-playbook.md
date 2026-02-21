# Sprint Planning Playbook

A comprehensive guide to facilitating effective sprint planning sessions that result in realistic commitments and clear team alignment.

## Purpose

Sprint planning establishes the sprint goal and determines which backlog items the team will commit to delivering. A well-run sprint planning session creates shared understanding, identifies risks early, and sets the team up for success.

## Pre-Planning Checklist

Before the sprint planning meeting:

- [ ] Product Backlog is refined and prioritized
- [ ] Top items meet Definition of Ready (DoR)
- [ ] Team capacity is calculated (accounting for PTO, holidays, meetings)
- [ ] Previous sprint velocity is available for reference
- [ ] Any technical debt or carryover items are identified
- [ ] Stakeholders have been consulted on priorities

## Meeting Structure

### Part 1: The "What" (1-2 hours)

**Objective**: Establish the Sprint Goal and select PBIs

1. **Product Owner presents the Sprint Goal**
   - What business value are we delivering?
   - Why is this sprint important?
   - What does success look like?

2. **Review top backlog items**
   - PO explains each item's value and acceptance criteria
   - Team asks clarifying questions
   - Identify dependencies and risks

3. **Team selects items**
   - Reference historical velocity
   - Consider team capacity
   - Include buffer for unknowns (typically 10-20%)

### Part 2: The "How" (2-4 hours)

**Objective**: Create a plan to deliver the selected items

1. **Break down PBIs into tasks**
   - Identify technical implementation steps
   - Estimate task effort (hours or relative)
   - Assign initial owners if appropriate

2. **Identify dependencies**
   - Within the team
   - External dependencies
   - Create mitigation plans

3. **Validate commitment**
   - Does the plan fit within capacity?
   - Are there any blockers?
   - Does the team have confidence in delivery?

## Facilitation Tips

### Keep Discussions Focused

- Use a parking lot for off-topic items
- Time-box discussions per PBI (10-15 minutes max)
- If a PBI generates too many questions, it may not be ready

### Encourage Participation

- Ask quieter team members directly for input
- Rotate who facilitates different sections
- Use techniques like fist-of-five for consensus

### Handle Common Issues

**Item not ready**: Return to backlog, do not force into sprint
**Disagreement on estimates**: Use planning poker, discuss outliers
**Overcommitment pressure**: Protect team from external pressure, reference data

## Capacity Planning

### Calculate Team Capacity

```
Team Capacity = (Team Members × Sprint Days × Hours/Day) - Known Absences - Meeting Overhead
```

**Example**:
- 5 developers × 10 days × 6 productive hours = 300 hours
- Minus 20 hours PTO, 30 hours meetings = 250 available hours

### Use Velocity as Guide

- Average last 3 sprints for baseline
- Adjust for known factors (new team members, holidays)
- Velocity is a guide, not a target

## Sprint Goal Best Practices

A good Sprint Goal is:

- **Specific**: Clear about what we're achieving
- **Measurable**: We know when it's done
- **Achievable**: Realistic given capacity
- **Relevant**: Aligned with product vision
- **Time-bound**: Completable within the sprint

**Good Example**: "Enable users to export their data in CSV format for compliance reporting"

**Poor Example**: "Work on export features and fix bugs"

## Output Artifacts

At the end of sprint planning, you should have:

1. **Sprint Goal**: Single sentence capturing the sprint's purpose
2. **Sprint Backlog**: Selected PBIs with tasks
3. **Capacity allocation**: How effort maps to items
4. **Risk register**: Known risks and mitigations
5. **Team commitment**: Verbal or written agreement

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Planning without PO | Missing context on value | Require PO attendance |
| No Sprint Goal | Sprint becomes a task list | Always define goal first |
| Cherry-picking | Team avoids difficult items | PO maintains priority |
| Over-planning | Tasks become requirements | Keep tasks as reminders |
| Under-planning | Hidden complexity emerges | Break down unknowns |

## Metrics to Track

- **Sprint Goal completion rate**: Did we achieve the goal?
- **Commitment vs. delivery**: Story points committed vs. completed
- **Carryover rate**: Items that roll to next sprint
- **Planning accuracy**: Estimated hours vs. actual

## Related Playbooks

- Backlog Refinement Playbook
- Estimation Techniques Playbook
- Definition of Ready

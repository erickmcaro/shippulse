# Release Planning Playbook

A guide to planning and coordinating releases that deliver value predictably while managing risk and stakeholder expectations.

## Purpose

Release planning bridges the gap between product strategy and sprint execution. Effective release planning:
- Provides a roadmap for multiple sprints
- Aligns team efforts with business goals
- Sets realistic expectations for stakeholders
- Identifies dependencies and risks early
- Enables coordination across teams

## Release Planning Levels

### Strategic (Quarterly/Annual)

- Themes and major initiatives
- High-level timeline and milestones
- Budget and resource allocation
- Market/regulatory deadlines

### Tactical (Release/PI)

- Features and epics for this release
- Sprint-level breakdown
- Dependency mapping
- Risk identification

### Operational (Sprint)

- Specific stories and tasks
- Daily execution
- Immediate blockers
- Incremental delivery

## Release Planning Process

### Step 1: Define Release Goals

Before planning, clarify:

- **Business objectives**: What are we trying to achieve?
- **Success metrics**: How will we measure success?
- **Constraints**: Deadlines, budget, resources, dependencies
- **Assumptions**: What are we taking for granted?

**Release Goal Template**:
```markdown
## Release: [Name/Version]

### Business Objective
[What business outcome are we targeting?]

### Success Metrics
- [Metric 1]: [Target]
- [Metric 2]: [Target]

### Target Date
[Date] (Fixed/Flexible?)

### Key Constraints
- [Constraint 1]
- [Constraint 2]

### Assumptions
- [Assumption 1]
- [Assumption 2]
```

### Step 2: Gather Input

**From Product Owner**:
- Prioritized backlog
- Stakeholder commitments
- Market deadlines

**From Development Team**:
- Technical dependencies
- Technical debt needs
- Capacity constraints

**From Other Teams**:
- Cross-team dependencies
- Shared resource needs
- Integration requirements

### Step 3: Scope the Release

#### Capacity Calculation

```
Release Capacity = Sprints × Average Velocity × Focus Factor

Example:
- 5 sprints in release
- Average velocity: 40 points/sprint
- Focus factor: 80% (accounting for unknowns)

Release Capacity = 5 × 40 × 0.8 = 160 story points
```

#### Scope Selection

1. Start with prioritized backlog
2. Pull items until capacity is filled
3. Leave 10-20% buffer for unknowns
4. Ensure vertical slices (not all backend first)

**Scope Bucket Approach**:
| Bucket | % of Capacity | Examples |
|--------|---------------|----------|
| Committed | 60-70% | Must-have features |
| Targeted | 20-30% | Should-have features |
| Stretch | 10% | Nice-to-have features |
| Buffer | 10-20% | Unknowns, bugs, support |

### Step 4: Map to Sprints

#### Sprint Allocation Principles

1. **Front-load risk**: Tackle uncertain items early
2. **Respect dependencies**: Sequence appropriately
3. **Balance workload**: Even distribution across sprints
4. **Include hardening**: Reserve time for stabilization

#### Release Plan Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│ Release 2.0 - Q2 2024                                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ Sprint 1 │ Sprint 2 │ Sprint 3 │ Sprint 4 │ Sprint 5 │ Sprint 6│
│ Mar 1-14 │ Mar 15-28│ Mar 29-  │ Apr 12-25│ Apr 26-  │ May 10- │
│          │          │ Apr 11   │          │ May 9    │ May 23  │
├──────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ Epic A   │ Epic A   │ Epic B   │ Epic B   │ Epic C   │ Harden  │
│ Feature 1│ Feature 2│ Feature 1│ Feature 2│ All feat │ Testing │
│          │          │ Epic A   │ Epic B   │          │ Bug fix │
│          │          │ Feature 3│ Feature 3│          │ Deploy  │
├──────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ 40 pts   │ 42 pts   │ 38 pts   │ 40 pts   │ 36 pts   │ 20 pts  │
└──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘
                                                    │
                                                    └── Buffer
```

### Step 5: Identify Dependencies and Risks

#### Dependency Mapping

For each epic/feature, identify:
- Technical dependencies
- Team dependencies
- External dependencies
- Timeline dependencies

#### Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk 1] | High | High | [Mitigation plan] |
| [Risk 2] | Medium | High | [Mitigation plan] |

### Step 6: Communicate and Align

#### Stakeholder Alignment Meeting

**Agenda**:
1. Release goals and success metrics (10 min)
2. Scope overview: Committed vs Targeted (15 min)
3. Timeline and milestones (10 min)
4. Dependencies and risks (10 min)
5. Questions and feedback (15 min)
6. Commitment confirmation (5 min)

#### Release Plan Documentation

```markdown
## Release Plan: [Version]

### Overview
- **Target Date**: [Date]
- **Sprints**: [X]
- **Total Capacity**: [Y] points
- **Confidence**: [High/Medium/Low]

### Goals
- [Goal 1]
- [Goal 2]

### Scope

#### Committed (Must Have)
| Epic/Feature | Points | Sprint | Owner |
|--------------|--------|--------|-------|
| [Item 1] | 30 | 1-2 | [Name] |

#### Targeted (Should Have)
| Epic/Feature | Points | Sprint | Owner |
|--------------|--------|--------|-------|
| [Item 2] | 20 | 3 | [Name] |

#### Stretch (Nice to Have)
| Epic/Feature | Points | Sprint | Owner |
|--------------|--------|--------|-------|
| [Item 3] | 15 | 4-5 | [Name] |

### Dependencies
- [Dependency 1]: [Status]

### Risks
- [Risk 1]: [Mitigation]

### Milestones
| Milestone | Date | Criteria |
|-----------|------|----------|
| Feature Complete | [Date] | All code merged |
| Code Freeze | [Date] | Only critical fixes |
| Release | [Date] | Deployed to production |
```

## Release Tracking

### Progress Metrics

#### Burndown Chart

Track remaining work over time:
- Ideal line: Straight from total to zero
- Actual line: Daily remaining points
- Watch for: Flat lines (blocked), upward (scope creep)

#### Release Burnup

Track completed vs total scope:
- Shows scope changes clearly
- Useful for stakeholder communication
- Includes: Done, In Progress, To Do, Total Scope

#### Feature Progress

| Feature | Stories | Done | In Progress | Blocked |
|---------|---------|------|-------------|---------|
| Login | 8 | 5 | 2 | 1 |
| Dashboard | 12 | 3 | 4 | 0 |
| Reports | 6 | 0 | 0 | 0 |

### Health Indicators

**Green**: On track
- Velocity stable or increasing
- Burndown following ideal
- No critical blockers
- Team morale good

**Yellow**: At risk
- Velocity declining
- Burndown plateauing
- Some blockers
- Scope creep starting

**Red**: Off track
- Velocity significantly down
- Burndown going up
- Critical blockers
- Major scope changes

## Scope Management

### Handling Scope Changes

When new requests come in:

1. **Document**: What's the request and why?
2. **Size**: How much effort is needed?
3. **Impact**: What does it displace?
4. **Options**: Present tradeoffs
5. **Decide**: Get stakeholder decision
6. **Communicate**: Update all parties

**Scope Change Request Template**:
```markdown
## Scope Change Request

### Request
[Description of new/changed item]

### Requester
[Name] - [Date]

### Business Justification
[Why is this needed?]

### Size Estimate
[Points/Days]

### Impact Analysis
- Displaces: [Items that would be removed]
- Delays: [Impact to timeline]
- Risk: [New risks introduced]

### Options
1. Add scope, extend timeline
2. Add scope, remove [X]
3. Defer to next release
4. Reject request

### Recommendation
[Option with rationale]

### Decision
[Approved/Rejected] by [Name] on [Date]
```

### Descoping Decisions

When capacity is insufficient:

1. Review with PO and stakeholders
2. Apply MoSCoW prioritization
3. Move items to Stretch or Next Release
4. Document reasons for descoping
5. Communicate changes broadly

## Release Readiness

### Feature Complete Checklist

- [ ] All committed features code complete
- [ ] Code reviewed and merged
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Performance tested

### Code Freeze Criteria

- [ ] Feature complete achieved
- [ ] No critical/high bugs open
- [ ] Security scan passed
- [ ] Accessibility tested
- [ ] Release notes drafted

### Go-Live Checklist

- [ ] Code freeze criteria met
- [ ] Deployment plan reviewed
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Support team briefed
- [ ] Communication sent to stakeholders
- [ ] Go/No-Go decision made

## Release Types

### Feature Release

- New functionality for users
- Planned well in advance
- Marketing/communication needed
- Training may be required

### Maintenance Release

- Bug fixes and minor improvements
- Less ceremony needed
- May be more frequent
- Still needs testing

### Hotfix Release

- Critical issue fix
- Expedited process
- Minimal testing (focused)
- Immediate deployment

### Release Cadence Comparison

| Type | Frequency | Planning | Testing | Communication |
|------|-----------|----------|---------|---------------|
| Feature | Monthly-Quarterly | Full | Comprehensive | Broad |
| Maintenance | Weekly-Biweekly | Light | Focused | Internal |
| Hotfix | As needed | Minimal | Critical path | Immediate |

## Continuous Delivery

For teams with mature CI/CD:

### Release on Demand

- Any commit can go to production
- Feature flags control visibility
- No code freeze needed
- Continuous small releases

### Feature Flag Management

```
Feature: Dark Mode
- Development: ON
- Staging: ON
- Production: OFF (launch date: April 1)
- Beta users: ON
```

### Decoupling Deploy from Release

| Deploy | Release |
|--------|---------|
| Code goes to production | Feature visible to users |
| Technical action | Business decision |
| Can happen any time | Coordinated with marketing |
| Feature flags control | Feature flag flipped |

## Templates

### Release Planning Meeting Agenda

```
Release Planning - [Version]
Duration: 2-4 hours

1. Context Setting (15 min)
   - Business objectives
   - Timeline and constraints
   - Velocity and capacity

2. Backlog Review (45 min)
   - PO presents prioritized items
   - Team asks clarifying questions
   - Initial sizing discussion

3. Dependency Identification (30 min)
   - Technical dependencies
   - Cross-team dependencies
   - External dependencies

4. Capacity Planning (20 min)
   - Team availability
   - Known interrupts
   - Focus factor

5. Sprint Mapping (45 min)
   - Allocate items to sprints
   - Balance workload
   - Identify risks

6. Risk Assessment (20 min)
   - Identify major risks
   - Discuss mitigations
   - Assign owners

7. Commitment (15 min)
   - Review committed scope
   - Identify stretch goals
   - Confirm team alignment

8. Next Steps (10 min)
   - Action items
   - Communication plan
```

### Release Retrospective Questions

After each release:
1. Did we achieve the release goal?
2. What went well in planning?
3. What should we improve?
4. Were our estimates accurate?
5. How was communication with stakeholders?
6. What risks materialized? Did we mitigate well?

## Related Playbooks

- Sprint Planning Playbook
- Epic Decomposition Playbook
- Dependency Management Playbook
- Stakeholder Communication Playbook

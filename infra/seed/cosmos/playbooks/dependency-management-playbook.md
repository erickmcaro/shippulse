# Dependency Management Playbook

A guide to identifying, tracking, and resolving dependencies that can block team progress and delay delivery.

## Purpose

Dependencies are relationships between work items, teams, or external factors where one item cannot start or complete without another. Effective dependency management:
- Prevents blocked work and delays
- Enables better sprint planning
- Reduces waste from waiting
- Improves cross-team coordination
- Makes risks visible earlier

## Types of Dependencies

### 1. Internal Dependencies

Within the team's control:

| Type | Example | Mitigation |
|------|---------|------------|
| **Technical** | Story B requires API from Story A | Sequence properly or parallelize |
| **Knowledge** | Only one person knows the system | Pair programming, documentation |
| **Resource** | Need specific environment/tool | Request early, have backups |

### 2. External Dependencies

Outside the team's direct control:

| Type | Example | Mitigation |
|------|---------|------------|
| **Team** | Need UI from Design team | Coordinate in Program Increment planning |
| **Vendor** | Waiting for third-party API access | Escalate early, use mocks |
| **Stakeholder** | Need approval from compliance | Schedule reviews ahead of time |
| **Infrastructure** | Need cloud resources provisioned | Request in advance, automate |

### 3. Temporal Dependencies

Time-based constraints:

| Type | Example | Mitigation |
|------|---------|------------|
| **Deadline** | Must launch before holiday | Work backward from date |
| **Availability** | SME on vacation during sprint | Plan around, get info early |
| **External event** | API deprecation date | Track and plan migration |

## Identifying Dependencies

### During Refinement

Questions to ask:
- "What needs to exist before we can start this?"
- "Who else needs to be involved?"
- "What data or systems do we need access to?"
- "Are there any approvals required?"
- "Does this touch code another team owns?"

### Dependency Indicators

Watch for these phrases:
- "We need X first..."
- "This depends on..."
- "We're waiting for..."
- "Once Y is done, we can..."
- "If team Z doesn't..."

### Common Hidden Dependencies

- Security/compliance reviews
- Database migrations
- Environment configuration
- Third-party contracts
- License approvals
- Training requirements

## Dependency Documentation

### Dependency Matrix

Track dependencies in a matrix:

| Story | Depends On | Owner | Status | Due Date | Risk |
|-------|-----------|-------|--------|----------|------|
| Build checkout page | Payment API (Team B) | Sarah | In Progress | Mar 15 | Medium |
| Send notifications | Email service config | IT | Blocked | Mar 10 | High |
| Export reports | Data warehouse access | DBA | Complete | N/A | Low |

### Dependency Card Template

```markdown
## Dependency: [Title]

**From**: [Item/Team that needs something]
**To**: [Item/Team that provides something]

**Description**:
[What is needed and why]

**Owner**: [Who is responsible for resolution]
**Due Date**: [When it must be resolved]
**Status**: [Identified | In Progress | Resolved | Blocked]

**Impact if Not Resolved**:
[What happens if this isn't addressed]

**Mitigation Plan**:
[Backup plan if dependency isn't resolved]

**Notes**:
[Communication history, blockers, etc.]
```

## Dependency Resolution Strategies

### Strategy 1: Eliminate

Remove the dependency entirely:
- Redesign to avoid the dependency
- Use different technology/approach
- Descope the dependent feature

**Example**: Instead of depending on a complex legacy API, build a simple new service.

### Strategy 2: Sequence

Order work to respect dependencies:
- Put prerequisite work first
- Adjust sprint planning
- Use dependency graphs

**Example**: Schedule Story A in Sprint 1, Story B in Sprint 2.

### Strategy 3: Parallelize

Work around the dependency:
- Use mocks or stubs
- Build to interfaces
- Create feature flags

**Example**: Build UI with mock API responses while API is being developed.

### Strategy 4: Negotiate

Work with the dependency owner:
- Request earlier delivery
- Offer to help/pair
- Agree on intermediate deliverables
- Get commitment in writing

**Example**: Ask Team B to deliver API contract (not implementation) by Sprint 1.

### Strategy 5: Escalate

When you can't resolve at your level:
- Raise to Scrum Master/Program Manager
- Document impact and urgency
- Propose solutions, not just problems
- Track escalation progress

**Example**: Escalate to VP when vendor contract is blocking critical feature.

## Cross-Team Coordination

### Scrum of Scrums

Regular sync meeting for dependent teams:

**Frequency**: 2-3 times per week
**Duration**: 15-30 minutes
**Attendees**: Representatives from each team

**Agenda**:
1. What did your team accomplish since last sync?
2. What will your team accomplish before next sync?
3. What dependencies need attention?
4. What risks or blockers exist?

### Dependency Boards

Visual board showing cross-team dependencies:

```
┌──────────────────────────────────────────────────────────────┐
│                    DEPENDENCY BOARD                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Identified  │  In Progress │   Blocked    │   Resolved     │
├──────────────┼──────────────┼──────────────┼────────────────┤
│  [Card]      │  [Card]      │  [Card]      │  [Card]        │
│  [Card]      │              │              │  [Card]        │
│              │              │              │  [Card]        │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

### Program Increment Planning

For SAFe teams, PI Planning addresses dependencies:

1. **Draft plans**: Teams create initial sprint plans
2. **Identify dependencies**: Teams mark external needs
3. **Dependency mapping**: Visualize on program board
4. **Resolution discussion**: Teams negotiate and adjust
5. **Final commitment**: Plans reflect resolved dependencies

## Risk Assessment

### Dependency Risk Matrix

Assess each dependency's risk:

| Probability | Low Impact | Medium Impact | High Impact |
|-------------|------------|---------------|-------------|
| **High** | Medium Risk | High Risk | Critical |
| **Medium** | Low Risk | Medium Risk | High Risk |
| **Low** | Low Risk | Low Risk | Medium Risk |

### Risk Factors

Consider these when assessing:
- **Complexity**: How hard is the dependency to fulfill?
- **Control**: How much influence do we have?
- **History**: Has this team/vendor delivered reliably?
- **Communication**: How responsive are they?
- **Alternatives**: Do we have a backup plan?

## Dependency Prevention

### Design Principles

1. **Loose coupling**: Design systems that minimize dependencies
2. **API-first**: Define interfaces before implementation
3. **Feature flags**: Deploy incomplete features safely
4. **Modular architecture**: Independent, deployable components

### Team Practices

1. **T-shaped skills**: Cross-train to reduce knowledge dependencies
2. **Documentation**: Reduce dependency on individuals
3. **Automation**: Reduce manual handoffs
4. **Early communication**: Identify dependencies in refinement

### Organizational Practices

1. **Stable teams**: Reduce coordination overhead
2. **Clear ownership**: Know who owns what
3. **Shared calendars**: Visibility into availability
4. **Escalation paths**: Clear process for blockers

## Communication Templates

### Dependency Request Email

```
Subject: [Team Name] - Dependency Request for [Item Name]

Hi [Owner],

Our team needs [specific deliverable] to complete [our work item].

Details:
- What we need: [specific requirement]
- When we need it: [date with reason]
- Impact if delayed: [consequences]

We're happy to:
- Discuss requirements in detail
- Pair on the work if helpful
- Adjust our timeline if needed

Could we schedule a quick call this week?

Thanks,
[Your name]
```

### Escalation Email

```
Subject: [ESCALATION] Blocked dependency - [Item Name]

Hi [Manager],

I'm escalating a blocked dependency that threatens our [sprint/release].

Situation:
- Our team needs [what]
- From [team/vendor/person]
- By [date]
- Current status: [blocked for X days]

Impact:
- [Feature/milestone] will be delayed by [estimate]
- [Downstream effects]

What we've tried:
- [Action 1]
- [Action 2]

Recommended action:
- [What you're asking the manager to do]

Please let me know how you'd like to proceed.

[Your name]
```

## Metrics

### Track These Metrics

- **Dependency count**: How many per sprint/release?
- **Blocked time**: Days waiting on dependencies
- **Resolution time**: Days from identified to resolved
- **Escaped dependencies**: Dependencies discovered during sprint
- **Dependency-related delays**: Stories missed due to dependencies

### Warning Signs

- Increasing dependency count over time
- Same dependencies recurring
- Long resolution times
- Dependencies discovered late
- Cross-team friction

## Checklist

### Pre-Sprint Planning

- [ ] All dependencies identified for planned items
- [ ] External dependencies communicated to other teams
- [ ] Risk assessment completed
- [ ] Mitigation plans in place for high-risk items
- [ ] Owners assigned for each dependency

### During Sprint

- [ ] Dependencies reviewed at daily standup
- [ ] Blocked items escalated within 24 hours
- [ ] Status updated on dependency board
- [ ] Cross-team sync attended
- [ ] Progress communicated to stakeholders

### Sprint Review

- [ ] Dependency impact on sprint assessed
- [ ] Lessons learned captured
- [ ] Process improvements identified
- [ ] Upcoming dependencies highlighted

## Related Playbooks

- Sprint Planning Playbook
- Release Planning Playbook
- Stakeholder Communication Playbook

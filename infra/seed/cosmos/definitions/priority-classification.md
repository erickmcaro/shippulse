# Priority Classification

Guidelines for classifying and managing priorities in the product backlog to ensure the team works on the most valuable items first.

## Purpose

Priority classification helps:
- Focus team effort on highest-value work
- Make trade-off decisions explicit
- Set stakeholder expectations
- Enable effective sprint planning
- Respond appropriately to new requests

## Priority Framework: MoSCoW

### Overview

MoSCoW is a prioritization technique that categorizes requirements into four groups:

| Priority | Description | Guidance |
|----------|-------------|----------|
| **Must Have** | Critical requirements, non-negotiable | Release fails without these |
| **Should Have** | Important but not vital | Would hurt the release if missing |
| **Could Have** | Desirable but not necessary | Nice to have if time permits |
| **Won't Have** | Explicitly excluded (for now) | Out of scope for this release |

### Priority Definitions

#### Must Have

**Definition**: Essential items without which the product/release fails.

**Characteristics**:
- Core functionality that cannot be worked around
- Compliance or regulatory requirements
- Contractual obligations
- Security/safety requirements
- Foundation for other features

**Questions to Identify**:
- Would the product be usable without this?
- Is there a legal/regulatory requirement?
- Would customers reject the product without it?

**Examples**:
- User authentication for a secure application
- Payment processing for an e-commerce site
- Data backup for a storage system
- HIPAA compliance for healthcare software

#### Should Have

**Definition**: Important features that add significant value but have workarounds.

**Characteristics**:
- High business value
- Painful to omit but survivable
- Workarounds exist (even if inconvenient)
- Strongly desired by key stakeholders

**Questions to Identify**:
- Is there a manual workaround?
- Would omission significantly impact user satisfaction?
- Is it needed for competitive parity?

**Examples**:
- Search functionality (users can browse)
- Email notifications (users can check dashboard)
- Mobile-responsive design (users can use desktop)
- Bulk operations (users can process one by one)

#### Could Have

**Definition**: Desirable features with smaller impact; included if time permits.

**Characteristics**:
- Nice to have enhancements
- Low business impact if omitted
- Often UX improvements or optimizations
- Can easily be deferred

**Questions to Identify**:
- Would users still be satisfied without it?
- Is this an enhancement to existing functionality?
- Is the impact relatively small?

**Examples**:
- Keyboard shortcuts
- Dashboard customization
- Dark mode
- Export to multiple formats
- Social media sharing

#### Won't Have (This Time)

**Definition**: Explicitly out of scope for current release, but may be considered later.

**Importance of Won't Have**:
- Makes exclusions explicit
- Prevents scope creep
- Sets clear expectations
- Documents future considerations

**Examples**:
- Multi-language support (version 2.0)
- Mobile app (next fiscal year)
- AI-powered features (pending budget)
- Advanced analytics (customer request backlog)

## Priority Levels

### Numeric Priority System

For more granular prioritization within MoSCoW categories:

| Level | MoSCoW | Description | Sprint Planning |
|-------|--------|-------------|-----------------|
| **P1** | Must Have | Critical, cannot release without | Always included |
| **P2** | Must Have | Required, but after P1s | Include if P1s fit |
| **P3** | Should Have | Important, high value | Include if capacity |
| **P4** | Should Have | Important, moderate value | Stretch goal |
| **P5** | Could Have | Nice to have | Only if extra capacity |
| **P6** | Won't Have | Out of scope | Not considered |

### Severity vs Priority (for Bugs)

| Severity | Impact Level | Priority Guidance |
|----------|--------------|-------------------|
| **Critical** | System down, data loss | Always P1 |
| **High** | Major feature broken, no workaround | Usually P1-P2 |
| **Medium** | Feature impaired, workaround exists | Usually P3-P4 |
| **Low** | Minor issue, cosmetic | Usually P4-P5 |

Priority can differ from severity based on:
- User impact (how many affected)
- Business impact (revenue, reputation)
- Workaround availability
- Release timing

## Prioritization Factors

### Value Dimensions

Consider multiple dimensions when prioritizing:

| Dimension | Questions to Ask |
|-----------|-----------------|
| **Business Value** | Revenue impact? Cost savings? Strategic alignment? |
| **User Value** | Solves user pain? Improves experience? Requested frequently? |
| **Risk Reduction** | Reduces technical risk? Validates assumptions? |
| **Time Sensitivity** | Market window? Regulatory deadline? Competitor threat? |
| **Dependencies** | Enables other work? Blocks other teams? |

### WSJF (Weighted Shortest Job First)

For economic prioritization:

```
WSJF = Cost of Delay / Job Duration

Cost of Delay = User Value + Time Criticality + Risk Reduction
Job Duration = Relative effort estimate
```

| Factor | Scale | Description |
|--------|-------|-------------|
| User/Business Value | 1-10 | How much value does this deliver? |
| Time Criticality | 1-10 | How urgent? Deadline-driven? |
| Risk/Opportunity | 1-10 | Risk if delayed? Opportunity if done? |
| Job Size | 1-10 | Relative effort (higher = smaller job) |

**Example Calculation**:

| Item | Value | Time | Risk | CoD | Size | WSJF |
|------|-------|------|------|-----|------|------|
| Feature A | 8 | 5 | 3 | 16 | 5 | 3.2 |
| Feature B | 5 | 8 | 4 | 17 | 8 | 2.1 |
| Feature C | 9 | 2 | 2 | 13 | 3 | 4.3 |

**Result**: Do Feature C first (highest WSJF)

## Prioritization Process

### Backlog Prioritization Steps

1. **Gather Input**
   - Stakeholder requests
   - Customer feedback
   - Technical debt assessment
   - Strategic goals

2. **Initial Classification**
   - Apply MoSCoW to each item
   - Assign numeric priority (P1-P5)
   - Document rationale

3. **Stack Rank**
   - Order items within each priority level
   - Consider dependencies
   - Balance effort and value

4. **Review and Validate**
   - Stakeholder review
   - Team feasibility check
   - Final prioritization

5. **Communicate**
   - Share prioritized backlog
   - Explain key decisions
   - Set expectations

### Prioritization Meeting

**Frequency**: Weekly or bi-weekly
**Attendees**: PO, key stakeholders, Scrum Master
**Duration**: 30-60 minutes

**Agenda**:
1. Review new items (10 min)
2. Prioritize new items (15 min)
3. Review upcoming sprint candidates (10 min)
4. Address priority disputes (15 min)
5. Communicate decisions (5 min)

## Handling Priority Changes

### When Priorities Change

Common triggers:
- New business opportunity
- Customer escalation
- Production incident
- Market change
- Stakeholder request

### Change Process

1. **Assess the Request**
   - What's the new item?
   - What's the business justification?
   - What's the urgency?

2. **Evaluate Impact**
   - What gets displaced?
   - What are the consequences?
   - What are the dependencies?

3. **Make Decision**
   - PO decides with stakeholder input
   - Document the decision and rationale

4. **Communicate**
   - Inform affected parties
   - Update documentation
   - Adjust sprint if mid-sprint

### Priority Change Template

```markdown
## Priority Change Request

**Date**: [Date]
**Requester**: [Name]

### New Item
[Description of new high-priority item]

### Business Justification
[Why is this urgent/important?]

### Proposed Priority
[P1/P2/etc. with MoSCoW category]

### Impact Analysis
Items to be displaced:
- [Item 1] - was P[X], becomes P[Y]
- [Item 2] - deferred to [when]

### Decision
[ ] Approved - [Decision maker]
[ ] Rejected - Reason: [reason]

### Communication Plan
- [Who needs to know]
- [How will they be informed]
```

## Priority Anti-Patterns

### Everything is P1

**Symptom**: All items marked as "Must Have" or P1
**Problem**: No meaningful prioritization
**Solution**: Force-rank; only 20-30% should be Must Have

### Squeaky Wheel Wins

**Symptom**: Loudest stakeholder always gets priority
**Problem**: Not value-based prioritization
**Solution**: Use objective criteria (WSJF, data)

### HIPPO (Highest Paid Person's Opinion)

**Symptom**: Exec overrides all prioritization
**Problem**: Not data-driven, team disengagement
**Solution**: Transparent criteria, facilitate discussions

### Ignoring Technical Debt

**Symptom**: Only features prioritized, no tech debt
**Problem**: Velocity degrades, system brittleness
**Solution**: Reserve 10-20% capacity for debt

### Priority Thrashing

**Symptom**: Priorities change constantly
**Problem**: Team can't focus, waste from context switching
**Solution**: Commit to sprint priorities, buffer for emergencies

## Templates

### Backlog Priority Table

| ID | Item | MoSCoW | Priority | Value | Effort | Notes |
|----|------|--------|----------|-------|--------|-------|
| PBI-1 | User Login | Must | P1 | High | 5 | Security requirement |
| PBI-2 | Dashboard | Should | P3 | High | 8 | Key user request |
| PBI-3 | Dark Mode | Could | P5 | Low | 3 | Enhancement |

### Priority Decision Log

```markdown
## Priority Decisions - [Date]

### Items Prioritized
| Item | Old Priority | New Priority | Rationale |
|------|--------------|--------------|-----------|
| [Item] | [P3] | [P1] | [Customer escalation] |

### Items Deferred
| Item | Was | Now | Reason |
|------|-----|-----|--------|
| [Item] | P2 | P4 | [Displaced by above] |

### Open Questions
- [Question needing resolution]

### Attendees
- [Names]
```

## Related Guidelines

- Backlog Refinement Playbook
- Sprint Planning Playbook
- Stakeholder Communication Playbook

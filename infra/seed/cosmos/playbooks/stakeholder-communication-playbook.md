# Stakeholder Communication Playbook

A guide to effectively communicating with stakeholders throughout the agile development lifecycle, building trust and ensuring alignment.

## Purpose

Effective stakeholder communication:
- Builds trust and transparency
- Sets realistic expectations
- Enables timely decisions
- Reduces surprises and conflicts
- Secures ongoing support and resources

## Stakeholder Identification

### Stakeholder Categories

| Category | Examples | Typical Interests |
|----------|----------|-------------------|
| **Sponsors** | Executives, budget owners | ROI, timeline, risk |
| **Users** | End users, customers | Usability, features, reliability |
| **Technical** | Architects, other teams | Integration, standards, dependencies |
| **Operations** | Support, DevOps | Maintainability, deployment, monitoring |
| **Compliance** | Legal, security, audit | Regulations, policies, risk |
| **Business** | Product managers, analysts | Requirements, market fit, metrics |

### Stakeholder Mapping

Create a stakeholder map using power/interest grid:

```
                    HIGH INTEREST
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     │   Keep Satisfied  │  Manage Closely   │
     │                   │                   │
 LOW ─────────────────────────────────────── HIGH
POWER│                   │                   │POWER
     │   Monitor         │  Keep Informed    │
     │   (Minimal effort)│                   │
     │                   │                   │
     └───────────────────┼───────────────────┘
                         │
                    LOW INTEREST
```

### Stakeholder Register Template

| Name | Role | Interest | Power | Engagement Level | Preferred Channel |
|------|------|----------|-------|------------------|-------------------|
| Jane Smith | VP Product | High | High | Manage Closely | Weekly 1:1 |
| IT Security | Compliance | Medium | High | Keep Satisfied | Monthly review |
| End Users | Users | High | Low | Keep Informed | Release notes |

## Communication Planning

### Communication Matrix

Define what, who, when, and how:

| Audience | Information | Frequency | Channel | Owner |
|----------|-------------|-----------|---------|-------|
| Sponsors | Progress summary, risks | Weekly | Email + meeting | PM |
| Users | New features, changes | Per release | In-app + email | PO |
| Dev teams | Technical updates | Daily | Slack | Tech Lead |
| Operations | Deployment info | Per deploy | Runbook + meeting | DevOps |

### Meeting Cadence

| Meeting | Stakeholders | Frequency | Duration | Purpose |
|---------|--------------|-----------|----------|---------|
| Sprint Review | All stakeholders | Bi-weekly | 1 hour | Demo work completed |
| Status Update | Sponsors | Weekly | 30 min | Progress, risks, decisions |
| Technical Sync | Technical teams | Weekly | 30 min | Dependencies, architecture |
| Steering Committee | Executives | Monthly | 1 hour | Strategic alignment |

## Communication by Agile Event

### Sprint Planning

**Who to involve**: Product Owner, optionally key stakeholders

**What to communicate**:
- Sprint goal and rationale
- High-priority items selected
- Capacity and constraints
- Dependencies on stakeholders

**Template**:
```
Sprint [X] Planning Summary

Sprint Goal: [One sentence describing the sprint's purpose]

Key Items:
- [Item 1] - [Brief description]
- [Item 2] - [Brief description]

Capacity: [X] story points (normal/reduced due to [reason])

Dependencies:
- [Dependency 1] - Need [what] from [who] by [when]

Next Sprint Review: [Date/Time]
```

### Daily Standup

**Who to involve**: Development team, Scrum Master, optionally PO

**What to communicate to stakeholders**: Nothing directly; summarize blockers if escalation needed

### Sprint Review

**Who to invite**: All interested stakeholders

**What to communicate**:
- Working software demonstration
- Sprint goal achievement
- Velocity and metrics
- Feedback collection
- Upcoming priorities

**Demo Tips**:
- Lead with the sprint goal
- Show real software, not slides
- Focus on user value, not technical details
- Acknowledge what wasn't completed
- Collect feedback actively

### Sprint Retrospective

**Who to involve**: Team only (stakeholder feedback gathered separately)

**What to communicate afterward**: Only action items that affect stakeholders

## Status Reporting

### Weekly Status Report Template

```markdown
# Project Status Report - Week of [Date]

## Summary
**Overall Status**: 🟢 Green / 🟡 Yellow / 🔴 Red
**Sprint**: [X] of [Y] | **Release**: [Version]

## Highlights
- [Achievement 1]
- [Achievement 2]

## Progress
| Epic | Progress | Target Date | Status |
|------|----------|-------------|--------|
| [Epic 1] | 75% | Mar 15 | 🟢 |
| [Epic 2] | 40% | Apr 1 | 🟡 |

## Risks and Issues
| Item | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| [Risk 1] | Medium | [Action] | [Name] |

## Decisions Needed
- [Decision 1]: [Options A/B/C] - Need by [date]

## Next Week
- [Planned item 1]
- [Planned item 2]

## Metrics
- Velocity: [X] points (avg: [Y])
- Defects: [X] open ([Y] critical)
```

### Executive Dashboard Elements

For sponsors who need high-level view:

1. **Progress to goal**: % complete, on track/delayed
2. **Key milestones**: Upcoming dates, at-risk items
3. **Budget status**: Spent vs planned
4. **Quality indicators**: Defect trends, customer feedback
5. **Risk summary**: Top 3 risks with mitigation status
6. **Decisions needed**: Any blockers requiring executive action

## Managing Expectations

### Setting Expectations Early

In project kickoff:
- Define what "done" looks like
- Explain agile process and ceremonies
- Set communication expectations
- Clarify roles and decision rights
- Discuss how priorities may change

### Managing Scope Changes

When new requests come in:
1. **Acknowledge**: "I understand you need X"
2. **Assess**: "Let me review the impact"
3. **Present options**: "We can do A, B, or C"
4. **Get decision**: "Which option works best?"
5. **Confirm**: "I'll update the plan and let you know"

**Never say**: "We can't do that"
**Instead say**: "We can do that. Here's what we'd need to adjust..."

### Delivering Bad News

Framework: **Situation → Impact → Options → Recommendation**

**Example**:
```
Situation: "The authentication API integration has technical issues we didn't anticipate."

Impact: "This will delay the user login feature by approximately one sprint."

Options:
"We have three options:
1. Delay the release by two weeks to complete all features
2. Release on time without social login, add it in the next release
3. Bring in contractor help to parallelize work"

Recommendation: "I recommend option 2 because it maintains our timeline and social login isn't a launch blocker."
```

## Difficult Conversations

### When Stakeholders Disagree with Priorities

1. **Listen first**: Understand their perspective
2. **Acknowledge**: "I understand X is important to you"
3. **Explain context**: Share the prioritization criteria
4. **Seek common ground**: "What outcome matters most?"
5. **Escalate if needed**: Involve PO or sponsor

### When Stakeholders Request the Impossible

1. **Don't say no immediately**: Ask clarifying questions
2. **Understand the why**: "What problem are you trying to solve?"
3. **Explore alternatives**: "What if we did X instead?"
4. **Be honest about tradeoffs**: "To do this, we'd need to..."
5. **Get commitment on tradeoffs**: Document the decision

### When Stakeholders Micromanage

1. **Increase transparency**: More frequent updates
2. **Invite to ceremonies**: Let them see the process
3. **Address root cause**: "Is there something specific you're concerned about?"
4. **Build trust gradually**: Deliver consistently
5. **Set boundaries kindly**: "I'll update you weekly. If urgent, reach out anytime"

## Feedback Collection

### Methods for Gathering Feedback

| Method | Best For | Frequency |
|--------|----------|-----------|
| Sprint Review | Demo feedback | Every sprint |
| Surveys | Broad input, metrics | Quarterly |
| Interviews | Deep understanding | As needed |
| Usage analytics | Behavior patterns | Continuous |
| Support tickets | Pain points | Continuous |

### Processing Feedback

1. **Collect**: Gather all feedback in one place
2. **Categorize**: Group by theme/feature area
3. **Analyze**: Identify patterns and priorities
4. **Share**: Report back to team and stakeholders
5. **Act**: Convert to backlog items
6. **Close loop**: Tell stakeholders what you did

### Closing the Feedback Loop

```
"Thank you for your feedback about [topic].

Based on your input and others, we:
- [Action 1]: Implemented in release [X]
- [Action 2]: Added to backlog for [timeframe]
- [Action 3]: Not planned because [reason]

We appreciate your continued input."
```

## Communication Tools

### Synchronous (Real-time)

- **Meetings**: For decisions, complex discussions
- **Video calls**: For remote teams, demos
- **Instant messaging**: For quick questions
- **Phone**: For urgent issues

### Asynchronous (Delayed)

- **Email**: For formal updates, documentation
- **Wiki/Confluence**: For reference documentation
- **Status dashboards**: For ongoing visibility
- **Recorded videos**: For demos, training

### Choosing the Right Channel

| Situation | Recommended Channel |
|-----------|-------------------|
| Urgent issue | Phone or instant message |
| Complex decision | Meeting |
| Regular update | Email or dashboard |
| Detailed information | Wiki/document |
| Feedback collection | Survey or interview |
| Demo | Meeting or recorded video |

## Templates

### Stakeholder Introduction Email

```
Subject: Welcome to [Project Name] - Your Guide to Staying Informed

Hi [Name],

Welcome to the [Project Name] stakeholder group. I wanted to share how we'll keep you informed and how you can engage with the project.

Regular Communications:
- Weekly status email (Mondays)
- Sprint Review demos (every 2 weeks, [day/time])
- Monthly steering meeting (first Tuesday)

Key Contacts:
- Product Owner: [Name] - Priority/scope questions
- Scrum Master: [Name] - Process questions
- Tech Lead: [Name] - Technical questions

Resources:
- Project dashboard: [link]
- Documentation: [link]
- Team chat channel: [link]

Your involvement matters. Please let me know:
1. What information is most important to you?
2. How often would you like updates?
3. Any specific concerns or questions?

Looking forward to working with you,
[Your name]
```

### Meeting Summary Template

```
Subject: [Meeting Name] Summary - [Date]

Attendees: [Names]

Decisions Made:
- [Decision 1]
- [Decision 2]

Action Items:
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action 1] | [Name] | [Date] |

Key Discussion Points:
- [Topic 1]: [Summary]
- [Topic 2]: [Summary]

Next Meeting: [Date/Time]
```

## Related Playbooks

- Sprint Planning Playbook
- Retrospective Facilitation Playbook
- Release Planning Playbook

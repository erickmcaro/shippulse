# Agile Anti-Patterns Guide

A comprehensive guide to recognizing and avoiding common anti-patterns that undermine agile effectiveness.

## What Are Anti-Patterns?

Anti-patterns are common responses to recurring problems that seem like solutions but are actually counterproductive. Recognizing these patterns helps teams avoid traps and maintain healthy agile practices.

## Sprint Anti-Patterns

### 1. Sprint Zero That Never Ends

**What it looks like:**
- Extended "setup" sprints with no shippable increment
- Architecture and infrastructure work continues indefinitely
- "We need more preparation before real sprints"

**Why it's problematic:**
- Delays value delivery
- Creates analysis paralysis
- Teams lose momentum
- Stakeholders lose patience

**Better approach:**
- Time-box Sprint Zero to 1-2 sprints maximum
- Deliver something usable, even if small
- Continue architecture work alongside feature development
- Embrace "walking skeleton" approach

---

### 2. Sprints Without Goals

**What it looks like:**
- Sprint is just a list of tasks
- No unifying theme or objective
- Team can't articulate what success looks like
- "We'll just work on whatever is next in the backlog"

**Why it's problematic:**
- Team lacks focus and motivation
- Hard to evaluate sprint success
- Missed opportunities for collaboration
- Stakeholders don't understand what to expect

**Better approach:**
- Always define a Sprint Goal
- Goal should be achievable and measurable
- Team rallies around the goal
- Evaluate success against goal, not just tasks

---

### 3. Carry-Over Culture

**What it looks like:**
- Work routinely carries over to next sprint
- "We'll just finish it in the next sprint"
- Burndown shows incomplete work
- Team normalizes not finishing what they commit

**Why it's problematic:**
- Velocity becomes meaningless
- Planning becomes unreliable
- Team loses accountability
- Hidden complexity isn't addressed

**Better approach:**
- Investigate root causes in retrospectives
- Improve estimation practices
- Break down work into smaller pieces
- Protect sprint commitments

---

### 4. Mid-Sprint Scope Changes

**What it looks like:**
- Product Owner adds items during sprint
- Priorities shift constantly
- "This is urgent, it can't wait"
- Team never finishes original commitment

**Why it's problematic:**
- Destroys predictability
- Increases context switching cost
- Team morale suffers
- Planning becomes pointless

**Better approach:**
- Protect sprint commitment
- Emergency changes require removing equal effort
- Urgent items go to next sprint by default
- Track interruptions to show impact

---

## Backlog Anti-Patterns

### 5. Iceberg Backlog

**What it looks like:**
- Backlog has hundreds of items
- Most items are vague and unrefined
- Bottom of backlog hasn't been reviewed in months
- "We'll get to those eventually"

**Why it's problematic:**
- Creates illusion of progress
- Maintenance overhead
- Old items become irrelevant
- Overwhelms stakeholders

**Better approach:**
- Regular backlog grooming/pruning
- Delete items untouched for 3+ months
- Keep backlog to 2-3 sprints of refined work
- Use roadmap for longer-term items

---

### 6. Technical Debt Denial

**What it looks like:**
- Only features on backlog
- "We don't have time for refactoring"
- Velocity decreasing over time
- Bugs taking longer to fix

**Why it's problematic:**
- Compounding interest on debt
- Slower and slower feature delivery
- Team frustration and turnover
- Eventual system rewrite

**Better approach:**
- Reserve 10-20% capacity for debt
- Make debt visible on backlog
- Track debt impact on velocity
- Pay off high-interest debt first

---

### 7. Proxy Product Owner

**What it looks like:**
- Real stakeholder delegates to intermediary
- Product Owner can't make decisions
- "I'll have to check with [actual decision maker]"
- Frequent priority reversals

**Why it's problematic:**
- Slow decision making
- Misaligned priorities
- Team lacks context
- Rework from miscommunication

**Better approach:**
- Empower Product Owner with decision authority
- Direct access to stakeholders
- Clear escalation path for exceptions
- PO attends all relevant meetings

---

## Team Anti-Patterns

### 8. Hero Culture

**What it looks like:**
- One person always saves the sprint
- "Only [name] can do that work"
- Bus factor of 1 on critical areas
- Others defer to the hero

**Why it's problematic:**
- Single point of failure
- Hero burns out
- Team doesn't grow
- Bottleneck on hero's availability

**Better approach:**
- Knowledge sharing sessions
- Pair programming on critical work
- Rotate responsibilities
- Document institutional knowledge

---

### 9. Siloed Specialists

**What it looks like:**
- "That's not my job"
- Frontend, backend, QA work in isolation
- Handoffs between specialists
- Work piles up waiting for specific person

**Why it's problematic:**
- Creates bottlenecks
- Reduces flexibility
- Longer cycle times
- Missed context and quality issues

**Better approach:**
- Encourage T-shaped skills
- Mob or pair on unfamiliar work
- Everyone owns quality
- Cross-functional collaboration

---

### 10. Silent Standup

**What it looks like:**
- Team members report to Scrum Master
- No peer-to-peer conversation
- "I did X, I will do Y, no blockers"
- Meeting feels like status report

**Why it's problematic:**
- Misses collaboration opportunities
- Blockers hidden
- Team not self-organizing
- Time waste for passive listeners

**Better approach:**
- Face each other, not Scrum Master
- Ask "who needs help?"
- Discuss how to collaborate
- Keep it energetic and engaging

---

## Estimation Anti-Patterns

### 11. Padded Estimates

**What it looks like:**
- Everything is 8 points
- Estimates include "buffer for unknowns"
- Consistent over-delivery
- "We always add 30% buffer"

**Why it's problematic:**
- Hides real velocity
- Planning becomes inaccurate
- Parkinson's law kicks in
- Reduces trust in estimates

**Better approach:**
- Estimate honestly, plan conservatively
- Track velocity including variance
- Address unknowns with spikes
- Retrospect on estimate accuracy

---

### 12. Estimate = Commitment

**What it looks like:**
- Pressure to reduce estimates
- "Can you do it in 3 instead of 5?"
- Estimates treated as deadlines
- Team penalized for misses

**Why it's problematic:**
- Estimates become meaningless
- Team stops being honest
- Gaming the system
- Erodes psychological safety

**Better approach:**
- Estimates are forecasts, not promises
- Focus on accuracy, not reduction
- Use velocity for capacity planning
- Celebrate honest estimation

---

## Process Anti-Patterns

### 13. Ceremonies as Checkboxes

**What it looks like:**
- "We have to do retro, it's agile"
- Meetings run mechanically
- No actions from retrospectives
- Low energy, low engagement

**Why it's problematic:**
- Wastes team time
- Cynicism about agile
- No continuous improvement
- Missed opportunities

**Better approach:**
- Focus on outcomes, not attendance
- Adapt ceremony format
- Track action items to completion
- Cancel meetings that aren't valuable

---

### 14. Waterfall in Sprints

**What it looks like:**
- Sprint 1: Requirements, Sprint 2: Design, Sprint 3: Code...
- Mini-waterfall within each sprint
- QA at the end, not continuous
- "We can't test until development is done"

**Why it's problematic:**
- Late feedback
- Risk accumulation
- Not truly iterative
- Integration problems at end

**Better approach:**
- Vertical slices of work
- Test during development
- Continuous integration
- Done means shippable

---

### 15. Agile in Name Only (AINO)

**What it looks like:**
- Agile terminology but waterfall mindset
- "Sprints" but fixed scope and date
- Standups but no self-organization
- Retros but no changes

**Why it's problematic:**
- Worst of both worlds
- Team confusion and frustration
- False sense of agility
- Missing agile benefits

**Better approach:**
- Commit to agile principles, not just practices
- Leadership buy-in and support
- Coach team through transition
- Inspect and adapt continuously

---

## How to Address Anti-Patterns

### Recognition

1. Name the anti-pattern explicitly
2. Discuss impact on team and delivery
3. Agree it's worth addressing

### Investigation

1. Understand root causes
2. Identify contributing factors
3. Consider systemic issues

### Action

1. Define specific experiments
2. Time-box the experiment
3. Measure impact
4. Adjust or adopt

### Prevention

1. Retrospect on anti-patterns regularly
2. Share learnings across teams
3. Update team working agreements
4. Celebrate improvements

## Anti-Pattern Assessment Checklist

Use this checklist in retrospectives:

| Anti-Pattern | Present? | Impact | Action |
|--------------|----------|--------|--------|
| Sprint Zero never ends | | | |
| Sprints without goals | | | |
| Carry-over culture | | | |
| Mid-sprint changes | | | |
| Iceberg backlog | | | |
| Technical debt denial | | | |
| Hero culture | | | |
| Siloed specialists | | | |
| Padded estimates | | | |
| Ceremonies as checkboxes | | | |
| Waterfall in sprints | | | |

## Related Documents

- Retrospective Facilitation Playbook
- Sprint Planning Playbook
- Estimation Techniques Playbook

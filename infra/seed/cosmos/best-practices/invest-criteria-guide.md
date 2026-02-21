# INVEST Criteria Guide

A comprehensive guide to writing user stories that meet the INVEST criteria for effective agile development.

## What is INVEST?

INVEST is an acronym for six qualities that make user stories effective:

| Letter | Criterion | Key Question |
|--------|-----------|--------------|
| **I** | Independent | Can it be built without waiting? |
| **N** | Negotiable | Is the solution open to discussion? |
| **V** | Valuable | Does it deliver user/business value? |
| **E** | Estimable | Can the team estimate it? |
| **S** | Small | Does it fit in a sprint? |
| **T** | Testable | Can we verify it's done? |

## Independent

### What It Means

Stories should be self-contained and not dependent on other stories being completed first.

### Why It Matters

- Enables flexible prioritization
- Allows parallel development
- Reduces coordination overhead
- Prevents blocked work

### Signs of Dependency

❌ "We need Story A done before we can start Story B"
❌ "This story requires the database schema from Story C"
❌ "Can't test until Story D is complete"

### How to Make Stories Independent

**Technique 1: Combine dependent stories**
```
Before:
- Story A: Create user table
- Story B: Build user registration

After:
- Story: User can register an account
  (includes table creation as technical task)
```

**Technique 2: Use stubs or mocks**
```
Before:
- Story: Display product recommendations (needs ML model)

After:
- Story: Display product recommendations (hardcoded initially)
- Story: Implement ML-based recommendations
```

**Technique 3: Vertical slices**
```
Before:
- Story: Build API for checkout
- Story: Build UI for checkout

After:
- Story: Customer can enter shipping address
  (includes API + UI for shipping)
```

### Assessment Questions

- Can this story be deployed to production alone?
- Can it be reordered in the backlog?
- Does it require other stories to provide value?

---

## Negotiable

### What It Means

Stories should describe the "what" and "why" but leave the "how" open for discussion. They're placeholders for conversation, not detailed specifications.

### Why It Matters

- Encourages collaboration
- Allows for better solutions
- Adapts to new information
- Empowers the team

### Signs of Over-Specification

❌ "Use Bootstrap modal with fade animation"
❌ "Query should use LEFT JOIN on tables X, Y, Z"
❌ "Button should be 44px × 120px, #007bff color"

### Signs of Good Negotiability

✅ "User can see confirmation before submitting"
✅ "Error messages should be helpful"
✅ "Search results should appear quickly"

### How to Keep Stories Negotiable

**Focus on outcomes, not implementation:**
```
Before: "Use React Select component for dropdown"
After: "User can select from list of options"
```

**Describe behaviors, not screens:**
```
Before: "Add modal with form fields X, Y, Z"
After: "User can enter their preferences"
```

**Use acceptance criteria for boundaries:**
```
Story: User can upload profile photo
AC: Photo must be validated (max 5MB, jpg/png only)
AC: User sees preview before confirming
// HOW to show preview is negotiable
```

### Assessment Questions

- Can the team choose the implementation approach?
- Is there room for creative solutions?
- Are technical decisions premature?

---

## Valuable

### What It Means

Every story should deliver value to users or the business. Value must be clearly articulated.

### Why It Matters

- Justifies the investment of time
- Enables prioritization
- Motivates the team
- Guides decision-making

### Signs of Missing Value

❌ "As a developer, I want to refactor the database..."
❌ "Create a service layer for the application"
❌ Story without the "so that" clause

### Types of Value

| Value Type | Example |
|------------|---------|
| User value | "User can track their order" |
| Business value | "Reduce support calls by 30%" |
| Efficiency value | "Save 2 hours/day for admin staff" |
| Risk reduction | "Prevent data loss during crashes" |
| Learning value | "Validate that users want feature X" |

### How to Make Stories Valuable

**Add the "so that" clause:**
```
Before: "As a user, I want to filter products"
After: "As a user, I want to filter products by price
        so that I can find items within my budget"
```

**Reframe technical stories:**
```
Before: "As a developer, I want to add caching"
After: "As a user, I want pages to load in under 2 seconds
        so that I don't abandon my shopping cart"
```

**Connect to business outcomes:**
```
Story: User can save cart for later
Value: Increases conversion rate, reduces cart abandonment
```

### Assessment Questions

- Who benefits from this story?
- What problem does it solve?
- Why would someone pay for this?

---

## Estimable

### What It Means

The team should be able to provide a reasonable estimate of the effort required.

### Why It Matters

- Enables capacity planning
- Identifies risks and unknowns
- Facilitates sprint planning
- Reveals misunderstandings

### Signs Story Isn't Estimable

❌ Team says "it depends..."
❌ Wide range of estimates (2 vs 13)
❌ "We've never done anything like this"
❌ Missing critical information

### Reasons Stories Aren't Estimable

| Reason | Solution |
|--------|----------|
| Too large | Split into smaller stories |
| Too vague | Add details, clarify scope |
| Unknown technology | Create spike first |
| Missing expertise | Pair with expert, research |
| Hidden dependencies | Identify and address |

### How to Make Stories Estimable

**Add enough detail:**
```
Before: "Improve search"
After: "Add category filter to product search
       - Filter appears in sidebar
       - Multi-select categories
       - Results update without page refresh"
```

**Use spikes for unknowns:**
```
Spike: Investigate feasibility of real-time sync with Salesforce
Outcome: Technical approach and estimate for implementation story
```

**Reference similar stories:**
```
"This is similar to the order history feature we built
last sprint, which was 5 points. This seems slightly
more complex, so I estimate 8 points."
```

### Assessment Questions

- Can the team estimate with confidence?
- What information is missing?
- Should we spike first?

---

## Small

### What It Means

Stories should be small enough to complete within a single sprint, ideally in 1-3 days of effort.

### Why It Matters

- Enables accurate estimation
- Provides fast feedback
- Shows progress frequently
- Reduces risk

### Signs Story Is Too Large

❌ Estimated at 13+ story points
❌ Can't complete in one sprint
❌ Contains multiple "and" statements
❌ Team unsure where to start

### Size Guidelines

| Size | Story Points | Team Days | Recommendation |
|------|--------------|-----------|----------------|
| Ideal | 1-5 | 1-3 | Good to go |
| Acceptable | 5-8 | 3-5 | Consider splitting |
| Too large | 8-13 | 5+ | Must split |
| Epic-sized | 13+ | 1+ week | Definitely split |

### How to Make Stories Small

Use splitting patterns:

| Pattern | When to Use |
|---------|-------------|
| Workflow steps | Multi-step processes |
| Business rules | Complex logic variations |
| Data variations | Multiple formats/sources |
| Simple/complex | Start simple, enhance |
| User roles | Different personas |

**Example split:**
```
Before (13 points):
"User can manage their profile"

After:
- User can view their profile (2 points)
- User can edit their name and bio (3 points)
- User can upload profile photo (5 points)
- User can change email address (3 points)
- User can delete their account (3 points)
```

### Assessment Questions

- Can this be done in 1-3 days?
- Can it be split further while retaining value?
- Are there multiple concerns combined?

---

## Testable

### What It Means

Stories must have clear acceptance criteria that allow verification of completion.

### Why It Matters

- Defines "done" clearly
- Enables automated testing
- Prevents ambiguity
- Guides development

### Signs Story Isn't Testable

❌ "System should be user-friendly"
❌ "Search should be fast"
❌ "Make it look professional"
❌ No acceptance criteria

### How to Make Stories Testable

**Use Given-When-Then:**
```gherkin
Given I am on the login page
When I enter invalid credentials
Then I see an error message "Invalid email or password"
And the password field is cleared
```

**Be specific and measurable:**
```
Before: "Page loads quickly"
After: "Page loads in under 2 seconds on 3G connection"

Before: "Error messages are helpful"
After: "Error message includes specific field name and expected format"
```

**Cover happy path AND edge cases:**
```
Story: User can add item to cart

AC1 (Happy): Adding item increases cart count by 1
AC2 (Edge): Adding out-of-stock item shows "Unavailable" message
AC3 (Edge): Adding item at max quantity shows limit warning
AC4 (Error): Network failure shows retry option
```

### Assessment Questions

- How will QA verify this is done?
- Can we write automated tests for this?
- Are acceptance criteria specific enough?

---

## INVEST Checklist

Use this checklist during refinement:

```markdown
## Story: [Title]

### INVEST Assessment

| Criterion | Pass? | Notes |
|-----------|-------|-------|
| Independent | ☐ | |
| Negotiable | ☐ | |
| Valuable | ☐ | |
| Estimable | ☐ | |
| Small | ☐ | |
| Testable | ☐ | |

### If Any Criterion Fails:

- [ ] Identify which criterion fails
- [ ] Apply appropriate technique
- [ ] Re-assess after changes
```

## Quick Reference

| Criterion | Problem | Solution |
|-----------|---------|----------|
| Not Independent | Has dependencies | Combine stories, use stubs |
| Not Negotiable | Over-specified | Focus on outcomes, not implementation |
| Not Valuable | Technical task | Connect to user/business value |
| Not Estimable | Too many unknowns | Add detail, spike first |
| Not Small | Too large | Split using patterns |
| Not Testable | Vague acceptance | Add Given-When-Then |

## Related Documents

- User Story Writing Playbook
- Story Splitting Patterns
- Acceptance Criteria Standards

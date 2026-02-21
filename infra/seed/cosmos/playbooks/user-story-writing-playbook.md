# User Story Writing Playbook

A guide to writing effective user stories that communicate user needs, drive valuable conversations, and result in deliverable work items.

## Purpose

User stories are lightweight descriptions of functionality from the user's perspective. They serve as placeholders for conversations about what to build and why, enabling teams to deliver value incrementally.

## The User Story Format

### Standard Format

```
As a [type of user],
I want [an action or feature],
So that [benefit or value].
```

### Components Explained

| Component | Purpose | Questions to Ask |
|-----------|---------|------------------|
| **As a** | Who benefits | Who is the user? What's their context? |
| **I want** | What they need | What action or capability? |
| **So that** | Why it matters | What problem does it solve? What value? |

### Examples

**Good Example**:
```
As a sales manager,
I want to export my team's quarterly performance data to Excel,
So that I can include it in executive presentations.
```

**Poor Example**:
```
As a user,
I want a button,
So that I can click it.
```

## The INVEST Criteria

Every user story should satisfy INVEST:

### I - Independent

Stories should be self-contained and not depend on other stories.

**Test**: Can this story be developed and deployed without waiting for another story?

**Anti-pattern**: "Story B requires Story A to be done first"

**Solution**: Combine dependent stories or restructure to remove dependency

### N - Negotiable

Stories are not contracts. Details should be open to discussion.

**Test**: Is the implementation approach still flexible?

**Anti-pattern**: Story specifies exact technical solution

**Solution**: Focus on the need, not the implementation

### E - Estimable

Team should be able to estimate the story's size.

**Test**: Can the team provide a story point estimate?

**Anti-pattern**: "This could be 2 days or 2 weeks, we don't know"

**Solution**: Spike to reduce uncertainty, or split into known/unknown parts

### S - Small

Stories should fit within a single sprint.

**Test**: Can this be completed in 1-3 days?

**Anti-pattern**: Story estimated at 13+ points

**Solution**: Split using story splitting patterns

### T - Testable

Stories should have clear acceptance criteria.

**Test**: Will we know when this is done?

**Anti-pattern**: "Make the search better"

**Solution**: Define specific, measurable criteria

## Writing Acceptance Criteria

### Given-When-Then Format

```
Given [precondition/context],
When [action is taken],
Then [expected result].
```

### Example

**Story**: As a customer, I want to reset my password via email, so that I can regain access to my account.

**Acceptance Criteria**:
```
Scenario 1: Successful password reset
Given I am on the login page
When I click "Forgot Password" and enter my registered email
Then I receive a password reset link within 5 minutes

Scenario 2: Invalid email
Given I am on the forgot password page
When I enter an unregistered email address
Then I see a generic message (security - don't confirm if email exists)

Scenario 3: Link expiration
Given I have received a password reset link
When I click the link after 24 hours
Then I see a message that the link has expired

Scenario 4: Password requirements
Given I am on the password reset page
When I enter a new password
Then the password must meet complexity requirements (8+ chars, uppercase, number)
```

### How Many Acceptance Criteria?

- **Minimum**: 2-3 scenarios (happy path + error cases)
- **Maximum**: 8-10 scenarios (if more, consider splitting)
- **Ideal**: 4-6 scenarios covering main flows

## User Personas

### Why Personas Matter

Generic users lead to generic features. Specific personas drive better stories.

### Common Personas

| Persona | Characteristics | Needs |
|---------|-----------------|-------|
| **New User** | First-time, unfamiliar | Guidance, simplicity |
| **Power User** | Daily use, expert | Efficiency, shortcuts |
| **Admin** | Manages others | Control, visibility |
| **Mobile User** | On-the-go, distracted | Speed, touch-friendly |

### Using Personas in Stories

**Generic**:
```
As a user, I want to search products...
```

**With Persona**:
```
As a busy parent shopping on mobile,
I want to filter products by age-appropriateness,
So that I can quickly find suitable gifts during my commute.
```

## Story Splitting Patterns

When stories are too large, split them using these patterns:

### 1. Workflow Steps

Split by stages in a process:
- Original: "User checkout"
- Split: "Add to cart" → "Enter shipping" → "Enter payment" → "Confirm order"

### 2. Business Rules

Split by complexity of rules:
- Original: "Calculate shipping cost"
- Split: "Flat rate shipping" → "Weight-based shipping" → "International shipping"

### 3. Simple/Complex

Start with simplest version:
- Original: "User login"
- Split: "Login with email/password" → "Add 2FA" → "Add SSO"

### 4. Data Variations

Split by data types or sources:
- Original: "Import contacts"
- Split: "Import from CSV" → "Import from Gmail" → "Import from Outlook"

### 5. Operations (CRUD)

Split by operations:
- Original: "Manage user profile"
- Split: "View profile" → "Edit profile" → "Delete account"

### 6. Platform/Device

Split by platform:
- Original: "Mobile app"
- Split: "iOS app" → "Android app" → "Tablet optimization"

## Common Mistakes

### Mistake 1: Technical Stories

**Wrong**:
```
As a developer, I want to refactor the database schema...
```

**Better**: Frame in terms of user impact:
```
As a user, I want faster page load times,
So that I don't abandon my shopping cart.
```

### Mistake 2: Too Vague

**Wrong**:
```
As a user, I want better search...
```

**Better**: Be specific:
```
As a researcher, I want to filter search results by publication date,
So that I can focus on recent findings.
```

### Mistake 3: Solution-Focused

**Wrong**:
```
As a user, I want a dropdown menu for categories...
```

**Better**: Focus on the need:
```
As a shopper, I want to browse products by category,
So that I can find items relevant to my interests.
```

### Mistake 4: Compound Stories

**Wrong**:
```
As a user, I want to create, edit, and delete posts...
```

**Better**: One story per action (split into three stories)

## Story Templates

### Feature Story
```
As a [persona],
I want to [action],
So that [benefit].

Acceptance Criteria:
- Given... When... Then...
- Given... When... Then...

Notes:
- [Technical considerations]
- [Design references]
```

### Bug Story
```
Title: [Brief description of bug]

Current Behavior:
[What happens now]

Expected Behavior:
[What should happen]

Steps to Reproduce:
1. ...
2. ...
3. ...

Environment:
- Browser/Device:
- User type:
- Frequency:
```

### Spike Story
```
As a development team,
We need to investigate [topic],
So that we can [make decision/reduce risk].

Questions to Answer:
1. ...
2. ...
3. ...

Time-box: [X hours/days]

Output: [Document/Prototype/Recommendation]
```

## Workshop Activity

### Story Writing Exercise

1. **Identify user** (5 min): Who is the primary persona?
2. **State the need** (5 min): What do they need to accomplish?
3. **Articulate value** (5 min): Why does this matter to them/the business?
4. **Write story** (5 min): Put it in standard format
5. **Add acceptance criteria** (10 min): Cover happy path + errors
6. **INVEST check** (5 min): Validate against criteria
7. **Team review** (10 min): Get feedback and refine

## Related Playbooks

- Acceptance Criteria Playbook
- Backlog Refinement Playbook
- Estimation Techniques Playbook

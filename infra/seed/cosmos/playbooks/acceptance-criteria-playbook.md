# Acceptance Criteria Playbook

A guide to writing clear, testable acceptance criteria that define "done" for user stories and ensure quality deliverables.

## Purpose

Acceptance criteria (AC) define the boundaries of a user story and establish the conditions that must be met for a story to be considered complete. Well-written AC:

- Clarify expectations before development begins
- Provide testable conditions for QA
- Create shared understanding between PO, developers, and testers
- Prevent scope creep during development
- Enable automated testing

## Acceptance Criteria Formats

### Format 1: Given-When-Then (Gherkin)

Best for: Scenarios with clear preconditions and expected outcomes

```gherkin
Given [precondition/context]
When [action is performed]
Then [expected result]
And [additional result]
```

**Example**:
```gherkin
Feature: User Login

Scenario: Successful login with valid credentials
  Given I am on the login page
  And I have a valid account
  When I enter my email "user@example.com"
  And I enter my password "correctpassword"
  And I click the "Sign In" button
  Then I am redirected to the dashboard
  And I see a welcome message with my name

Scenario: Failed login with invalid password
  Given I am on the login page
  When I enter my email "user@example.com"
  And I enter an incorrect password
  And I click the "Sign In" button
  Then I remain on the login page
  And I see an error message "Invalid credentials"
  And the password field is cleared
```

### Format 2: Checklist/Bullet Points

Best for: Features with multiple independent requirements

```markdown
Acceptance Criteria:
- [ ] User can upload files up to 10MB
- [ ] Supported formats: PDF, DOC, DOCX, JPG, PNG
- [ ] Upload progress is displayed
- [ ] Success message shown after upload completes
- [ ] Error message shown if upload fails
- [ ] Files are scanned for viruses before processing
```

### Format 3: Rule-Based

Best for: Business logic with clear rules

```markdown
Acceptance Criteria:

RULE: Discount calculation
- Orders over $100 receive 10% discount
- Orders over $500 receive 20% discount
- Discounts do not stack with promotional codes
- Discount is applied before tax calculation

RULE: Shipping eligibility
- Orders over $50 qualify for free standard shipping
- Express shipping available for additional $15
- Items marked "oversized" have $25 flat shipping
```

## Writing Effective Acceptance Criteria

### The SMART Approach

| Attribute | Question | Example |
|-----------|----------|---------|
| **S**pecific | Is it clear and unambiguous? | "Error message displays" vs "Red banner shows 'Invalid email format'" |
| **M**easurable | Can we verify it? | "Fast loading" vs "Page loads in under 2 seconds" |
| **A**chievable | Can dev team implement it? | Consider technical constraints |
| **R**elevant | Does it relate to the story? | Only include criteria for this story |
| **T**estable | Can QA verify it? | Must be able to pass/fail |

### Coverage Areas

Ensure AC cover these aspects:

1. **Happy Path**: Normal, successful flow
2. **Edge Cases**: Boundary conditions, limits
3. **Error Handling**: What happens when things go wrong
4. **Security**: Authentication, authorization
5. **Performance**: Speed, capacity (when relevant)
6. **Accessibility**: Screen readers, keyboard navigation
7. **Data Validation**: Input formats, required fields

### Example: Complete AC Set

**User Story**: As a customer, I want to reset my password, so that I can regain access to my account.

```gherkin
# Happy Path
Scenario: Successful password reset request
  Given I am on the login page
  When I click "Forgot Password"
  And I enter my registered email address
  And I click "Send Reset Link"
  Then I see a confirmation message
  And I receive an email with a reset link within 5 minutes

Scenario: Successful password change
  Given I have received a password reset email
  When I click the reset link
  And I enter a new valid password
  And I confirm the new password
  And I click "Reset Password"
  Then my password is changed
  And I am redirected to login page
  And I receive a confirmation email

# Error Cases
Scenario: Invalid email format
  Given I am on the forgot password page
  When I enter an invalid email format "notanemail"
  And I click "Send Reset Link"
  Then I see an error "Please enter a valid email address"
  And no email is sent

Scenario: Unregistered email (security consideration)
  Given I am on the forgot password page
  When I enter an unregistered email address
  And I click "Send Reset Link"
  Then I see the same confirmation message as a valid email
  And no email is sent
  # Note: Don't reveal if email exists in system

Scenario: Expired reset link
  Given I have a password reset link
  When I click the link after 24 hours
  Then I see a message "This link has expired"
  And I am offered to request a new link

# Validation Rules
Scenario: Password complexity requirements
  Given I am on the password reset page
  When I enter a new password
  Then the password must:
    - Be at least 8 characters long
    - Contain at least one uppercase letter
    - Contain at least one number
    - Contain at least one special character

Scenario: Password mismatch
  Given I am on the password reset page
  When I enter a new password
  And I enter a different password in the confirm field
  Then I see an error "Passwords do not match"
  And the submit button is disabled

# Security
Scenario: Rate limiting
  Given I am on the forgot password page
  When I request password reset more than 3 times in 1 hour
  Then I see a message "Too many attempts. Please try again later."
  And no email is sent
```

## Common Patterns

### Form Validation

```gherkin
Scenario: Required field validation
  Given I am on the registration form
  When I leave the [field_name] field empty
  And I submit the form
  Then I see an error "[field_name] is required"
  And the field is highlighted in red
  And focus moves to the first invalid field
```

### Search/Filter

```gherkin
Scenario: Search with results
  Given I am on the product page
  When I enter "laptop" in the search field
  And I press Enter or click Search
  Then I see products matching "laptop"
  And the result count is displayed
  And results are sorted by relevance by default

Scenario: Search with no results
  Given I am on the product page
  When I search for "xyznonexistent123"
  Then I see "No results found for 'xyznonexistent123'"
  And I see suggested alternatives or popular products
```

### CRUD Operations

```gherkin
# Create
Scenario: Create new item
  Given I am on the items page
  When I click "Add New"
  And I fill in required fields
  And I click "Save"
  Then the item is created
  And I see a success message
  And the item appears in the list

# Update
Scenario: Edit existing item
  Given I am viewing an item I own
  When I click "Edit"
  And I modify the [field_name]
  And I click "Save"
  Then the changes are saved
  And I see the updated information

# Delete
Scenario: Delete item with confirmation
  Given I am viewing an item I own
  When I click "Delete"
  Then I see a confirmation dialog
  When I confirm deletion
  Then the item is removed
  And I see a success message
  And I am redirected to the list page
```

## Anti-Patterns to Avoid

### 1. Too Vague

**Bad**: "System should be user-friendly"
**Good**: "User can complete checkout in 5 clicks or fewer"

### 2. Implementation Details

**Bad**: "Use React Bootstrap modal component"
**Good**: "Confirmation dialog appears before destructive actions"

### 3. Untestable

**Bad**: "Search should be fast"
**Good**: "Search results return within 500ms for typical queries"

### 4. Missing Error Cases

**Bad**: Only happy path scenarios
**Good**: Include error scenarios, edge cases, validation

### 5. Too Many AC

**Bad**: 20+ acceptance criteria for one story
**Good**: 4-8 criteria (split story if more needed)

### 6. Duplicate Criteria

**Bad**: Same criteria repeated across stories
**Good**: Reference shared standards (see Definition of Done)

## Collaboration Tips

### Writing AC Together

1. **Start with PO**: Initial criteria based on business needs
2. **Add Dev input**: Technical constraints and edge cases
3. **QA review**: Testability and coverage gaps
4. **Final PO approval**: Ensure business intent preserved

### Discussion Questions

When reviewing acceptance criteria, ask:
- "What happens if...?"
- "What about edge case X?"
- "How do we know this is done?"
- "Can we automate testing for this?"
- "Is this testable?"

### Handling Disagreements

If team can't agree on AC:
1. Time-box discussion (10 minutes)
2. Identify the core uncertainty
3. Consult with stakeholders if needed
4. Document assumptions
5. Create spike if truly unknown

## Templates

### Standard Story AC Template

```markdown
## Acceptance Criteria

### Happy Path
- [ ] [Primary success scenario]

### Validation
- [ ] [Input validation rules]
- [ ] [Business rules]

### Error Handling
- [ ] [Error scenario 1]
- [ ] [Error scenario 2]

### Non-Functional
- [ ] [Performance requirement if applicable]
- [ ] [Accessibility requirement if applicable]

### Out of Scope
- [Explicitly list what is NOT included]
```

### Quick Checklist

Before finalizing AC, verify:
- [ ] Happy path is covered
- [ ] Error cases are included
- [ ] Validation rules are specific
- [ ] All criteria are testable
- [ ] No implementation details
- [ ] Reasonable number (4-8)
- [ ] PO has approved

## Related Playbooks

- User Story Writing Playbook
- Definition of Done
- Definition of Ready

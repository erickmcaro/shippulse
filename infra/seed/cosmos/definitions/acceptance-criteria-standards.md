# Acceptance Criteria Standards

Standards and guidelines for writing clear, testable acceptance criteria that ensure shared understanding of what "done" means.

## Purpose

Acceptance criteria (AC) standards ensure:
- Consistent quality across all user stories
- Clear communication between PO, developers, and testers
- Testable requirements that can be verified
- Reduced ambiguity and rework
- Efficient sprint execution

## Standard Format: Given-When-Then

### Structure

```gherkin
Given [precondition or initial context]
When [action or event occurs]
Then [expected outcome or result]
And [additional outcome if needed]
```

### Components Explained

| Component | Purpose | Example |
|-----------|---------|---------|
| **Given** | Sets up the initial state or context | "Given I am logged in as an admin" |
| **When** | Describes the action being tested | "When I click the delete button" |
| **Then** | Specifies the expected result | "Then the record is removed from the list" |
| **And** | Adds additional conditions or results | "And a confirmation message is displayed" |

### Example Set

```gherkin
Feature: User Registration

Scenario: Successful registration with valid data
  Given I am on the registration page
  And I have not registered before
  When I enter valid email "newuser@example.com"
  And I enter a strong password "SecurePass123!"
  And I confirm the password
  And I click "Create Account"
  Then my account is created
  And I receive a verification email
  And I am redirected to the welcome page

Scenario: Registration fails with existing email
  Given I am on the registration page
  And "existing@example.com" is already registered
  When I enter email "existing@example.com"
  And I enter any password
  And I click "Create Account"
  Then I see an error "An account with this email already exists"
  And I remain on the registration page

Scenario: Registration fails with weak password
  Given I am on the registration page
  When I enter valid email "newuser@example.com"
  And I enter a weak password "123"
  And I click "Create Account"
  Then I see an error "Password must be at least 8 characters"
  And the password field is highlighted
```

## Coverage Requirements

### Minimum Criteria per Story

Every user story must have acceptance criteria covering:

| Category | Description | Minimum |
|----------|-------------|---------|
| **Happy Path** | Primary success scenario | 1-2 criteria |
| **Validation** | Input validation rules | 1-2 criteria |
| **Error Handling** | What happens when things fail | 1-2 criteria |
| **Edge Cases** | Boundary conditions | As applicable |

### Total Criteria Guidelines

| Story Complexity | Recommended Criteria |
|------------------|---------------------|
| Simple | 3-4 criteria |
| Medium | 5-7 criteria |
| Complex | 8-10 criteria |
| If more than 10 | Consider splitting the story |

## Quality Standards

### Specific and Measurable

| ❌ Poor | ✓ Good |
|---------|--------|
| "Fast loading" | "Page loads within 2 seconds" |
| "User-friendly error" | "Error message displays: 'Invalid email format'" |
| "Works on mobile" | "Form is usable on 320px wide screens" |
| "Handles large data" | "Supports up to 10,000 records without pagination" |

### Testable

Every criterion must be verifiable. Ask: "How would a tester verify this?"

| ❌ Not Testable | ✓ Testable |
|-----------------|------------|
| "Should be intuitive" | "User can complete task in 3 clicks or fewer" |
| "Looks professional" | "Uses approved brand colors and fonts" |
| "Performs well" | "Response time under 500ms at 95th percentile" |

### Independent

Each criterion should be verifiable independently:

| ❌ Dependent | ✓ Independent |
|--------------|---------------|
| "After completing step 1, step 2 should work" | Separate criterion for each step |
| "Building on previous criterion..." | Each stands alone |

### Behavior-Focused

Focus on behavior, not implementation:

| ❌ Implementation | ✓ Behavior |
|-------------------|------------|
| "Store data in PostgreSQL" | "User data persists between sessions" |
| "Use React modal component" | "Confirmation appears before destructive actions" |
| "Call REST API endpoint" | "Current weather displays for user's location" |

## Criteria by Story Type

### UI Features

```gherkin
# Include criteria for:
- Visual appearance and layout
- User interactions (click, type, drag)
- Feedback (loading states, success/error messages)
- Accessibility (keyboard, screen reader)
- Responsive behavior (desktop, tablet, mobile)

Example:
Scenario: Form displays validation feedback
  Given I am on the contact form
  When I submit the form with empty required fields
  Then each empty required field shows a red border
  And an error message appears below each invalid field
  And the first invalid field receives focus
  And the form is not submitted
```

### API Endpoints

```gherkin
# Include criteria for:
- Request format (method, parameters, headers)
- Success response (status code, body format)
- Error responses (validation, authentication, not found)
- Rate limiting behavior
- Idempotency (for write operations)

Example:
Scenario: GET /api/users/{id} returns user details
  Given I am authenticated with valid API key
  And user with id "123" exists
  When I send GET request to /api/users/123
  Then response status is 200
  And response body contains:
    | field     | type   |
    | id        | string |
    | email     | string |
    | createdAt | date   |

Scenario: GET /api/users/{id} returns 404 for non-existent user
  Given I am authenticated with valid API key
  And user with id "999" does not exist
  When I send GET request to /api/users/999
  Then response status is 404
  And response body contains error message "User not found"
```

### Data Processing

```gherkin
# Include criteria for:
- Input validation
- Processing rules and transformations
- Output format
- Error handling
- Performance requirements

Example:
Scenario: CSV import processes valid file
  Given I have a valid CSV file with 100 records
  When I upload the file to the import page
  Then all 100 records are imported
  And I see a summary showing "100 records imported successfully"
  And import completes within 30 seconds

Scenario: CSV import handles invalid rows
  Given I have a CSV file with 95 valid and 5 invalid rows
  When I upload the file
  Then 95 valid records are imported
  And 5 invalid records are rejected
  And I see a report listing the 5 rejected rows with reasons
```

## Common Patterns

### Authentication/Authorization

```gherkin
Scenario: Authenticated user can access protected resource
  Given I am logged in as a valid user
  When I navigate to the dashboard
  Then I see my personal dashboard

Scenario: Unauthenticated user is redirected to login
  Given I am not logged in
  When I navigate to the dashboard
  Then I am redirected to the login page
  And I see a message "Please log in to continue"

Scenario: User cannot access resources they don't own
  Given I am logged in as "user-a"
  When I try to access "user-b"'s document
  Then I see a 403 Forbidden error
  And the document content is not revealed
```

### Form Validation

```gherkin
Scenario: Required field validation
  Given I am on the form
  When I leave the [field] empty
  And I attempt to submit
  Then I see an error "[field] is required"
  And the field is highlighted in red
  And form submission is prevented

Scenario: Format validation
  Given I am on the form
  When I enter "[invalid_value]" in the [field]
  And I move to the next field
  Then I see an error "[expected_format_message]"
```

### Pagination

```gherkin
Scenario: Results are paginated
  Given there are 50 items in the database
  When I view the item list
  Then I see the first 10 items
  And I see pagination controls showing "Page 1 of 5"

Scenario: Navigate to next page
  Given I am on page 1 of results
  When I click "Next"
  Then I see items 11-20
  And the URL updates to include page=2
  And "Previous" button becomes enabled
```

### Search/Filter

```gherkin
Scenario: Search returns matching results
  Given products "Apple iPhone", "Apple iPad", "Samsung Galaxy" exist
  When I search for "Apple"
  Then I see "Apple iPhone" and "Apple iPad"
  And I do not see "Samsung Galaxy"
  And result count shows "2 results"

Scenario: Search with no results
  Given products exist in the catalog
  When I search for "xyz123nonexistent"
  Then I see "No results found for 'xyz123nonexistent'"
  And I see suggestions or popular items
```

## Anti-Patterns to Avoid

### 1. Too Vague

❌ **Avoid**:
```
Then the system handles the error appropriately
```

✓ **Better**:
```
Then I see an error message "Unable to save. Please try again."
And my entered data is preserved in the form
And an error is logged for investigation
```

### 2. Implementation Details

❌ **Avoid**:
```
Given the database contains a user record
When the API calls the UserService.findById() method
Then the response is serialized as JSON
```

✓ **Better**:
```
Given a user with ID "123" exists
When I request user details for ID "123"
Then I receive the user's profile information
```

### 3. Multiple Behaviors in One Criterion

❌ **Avoid**:
```
Then the user is created and an email is sent and they are logged in and the welcome modal appears
```

✓ **Better**:
```
Then the user account is created
And I receive a welcome email at my registered address
And I am automatically logged in
And I see a welcome modal with getting started tips
```

### 4. Missing Error Cases

❌ **Incomplete**:
```
Scenario: User signs up
  When I complete the registration form
  Then my account is created
```

✓ **Complete**: Include scenarios for invalid input, existing users, server errors

## Templates

### Basic Story AC Template

```markdown
## Acceptance Criteria

### Happy Path
Given [initial context]
When [user action]
Then [expected result]

### Validation
Given [context]
When [invalid input is provided]
Then [validation error is shown]

### Error Handling
Given [context]
When [action fails]
Then [error is handled gracefully]

### [Additional Scenarios as needed]
```

### Comprehensive AC Template

```markdown
## Acceptance Criteria

### Functional Requirements

**Scenario 1: [Happy Path Name]**
Given [precondition]
When [action]
Then [result]

**Scenario 2: [Alternate Flow Name]**
Given [precondition]
When [alternate action]
Then [result]

### Validation Rules
- [Field 1]: [validation rule]
- [Field 2]: [validation rule]

### Error Scenarios

**Scenario 3: [Error Case Name]**
Given [precondition]
When [action that fails]
Then [error handling]

### Non-Functional Requirements (if applicable)
- Performance: [requirement]
- Accessibility: [requirement]
- Security: [requirement]

### Out of Scope
- [Explicitly excluded behavior]
```

## Related Standards

- Definition of Ready
- Definition of Done
- User Story Writing Playbook

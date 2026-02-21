# Story Splitting Patterns

Practical patterns and techniques for breaking down large user stories into smaller, deliverable pieces.

## Why Split Stories?

Large stories (8+ points) cause problems:
- **Risk**: Unknown complexity revealed late
- **Flow**: Blocked work, uneven sprints
- **Feedback**: Delayed learning and validation
- **Predictability**: Harder to plan and track

Ideal story size: 1-5 points, completable in 1-3 days.

## The INVEST Test

Before splitting, verify the original story fails INVEST:

| Criterion | Question | If "No" → Split |
|-----------|----------|-----------------|
| **I**ndependent | Can it be built separately? | Decouple |
| **N**egotiable | Are details flexible? | Simplify |
| **V**aluable | Does it deliver user value? | Reframe |
| **E**stimable | Can team estimate it? | Research first |
| **S**mall | Fits in a sprint? | Apply patterns below |
| **T**estable | Clear acceptance criteria? | Define outcomes |

## Splitting Patterns

### Pattern 1: Workflow Steps

Split by steps in a user journey or process.

**Original:**
```
As a customer, I want to complete checkout so I can purchase items.
```

**Split:**
```
1. Customer can add items to cart
2. Customer can enter shipping address
3. Customer can select shipping method
4. Customer can enter payment information
5. Customer can review and confirm order
6. Customer receives order confirmation
```

**Best for:**
- Multi-step processes
- Forms with multiple pages
- Workflows with distinct stages

---

### Pattern 2: Business Rules/Variations

Split by different business rules or logic paths.

**Original:**
```
As a shopper, I want to see applicable discounts at checkout.
```

**Split:**
```
1. Apply percentage discount codes (e.g., 10% off)
2. Apply fixed amount discount codes (e.g., $5 off)
3. Apply free shipping codes
4. Apply buy-one-get-one offers
5. Handle multiple discount stacking rules
```

**Best for:**
- Complex business logic
- Multiple rule variations
- Conditional behaviors

---

### Pattern 3: Data Variations

Split by different data types, sources, or formats.

**Original:**
```
As a user, I want to import my contacts into the system.
```

**Split:**
```
1. Import contacts from CSV file
2. Import contacts from Excel file
3. Import contacts from Google Contacts
4. Import contacts from Outlook
5. Handle duplicate detection during import
```

**Best for:**
- Multi-format support
- Multiple data sources
- Integration work

---

### Pattern 4: Operations (CRUD)

Split by create, read, update, delete operations.

**Original:**
```
As an admin, I want to manage user accounts.
```

**Split:**
```
1. Admin can view list of user accounts
2. Admin can create new user account
3. Admin can edit user account details
4. Admin can disable/enable user account
5. Admin can delete user account
6. Admin can search/filter users
```

**Best for:**
- Resource management features
- Admin functionality
- Standard entity operations

---

### Pattern 5: User Roles/Types

Split by different user personas or permission levels.

**Original:**
```
As a user, I want to view my dashboard.
```

**Split:**
```
1. Standard user sees their personal dashboard
2. Team lead sees team aggregate dashboard
3. Admin sees organization-wide dashboard
4. Guest user sees public dashboard
```

**Best for:**
- Role-based features
- Multi-tenant applications
- Personalized experiences

---

### Pattern 6: Platform/Interface

Split by platform, device, or interface.

**Original:**
```
As a user, I want to access the app on my devices.
```

**Split:**
```
1. Web application (desktop browser)
2. Mobile web (responsive)
3. iOS native app
4. Android native app
5. API for third-party integrations
```

**Best for:**
- Cross-platform features
- Responsive design work
- Multi-channel experiences

---

### Pattern 7: Simple/Complex (Walking Skeleton)

Start with simplest version, add complexity incrementally.

**Original:**
```
As a user, I want a full-featured search with filters, sorting, and saved searches.
```

**Split:**
```
1. Basic keyword search returns results
2. Search results show in paginated list
3. Filter results by category
4. Filter results by date range
5. Sort results by relevance/date/price
6. Save search criteria for later
7. Search suggestions/autocomplete
```

**Best for:**
- New features with many requirements
- MVP identification
- Progressive enhancement

---

### Pattern 8: Accept/Handle/Respond

Split by the stages of processing.

**Original:**
```
As a user, I want to submit a support ticket.
```

**Split:**
```
1. Accept: User can fill and submit ticket form
2. Handle: System validates and stores ticket
3. Respond: User receives confirmation email
4. Track: User can view ticket status
5. Resolve: User is notified when resolved
```

**Best for:**
- Request/response patterns
- Async processing
- Communication features

---

### Pattern 9: Defer Quality Attributes

Implement functional behavior first, then enhance.

**Original:**
```
As a user, I want fast, secure, accessible login.
```

**Split:**
```
1. Basic login with email/password
2. Add password complexity requirements
3. Add rate limiting for security
4. Add MFA option
5. Optimize for performance (< 2s)
6. Add accessibility (keyboard nav, screen reader)
```

**Best for:**
- Features with many non-functional requirements
- Performance optimization
- Security enhancements

---

### Pattern 10: Spike and Implement

When uncertainty is high, research first.

**Original:**
```
As a user, I want my data synced with Salesforce.
```

**Split:**
```
1. Spike: Research Salesforce API and authentication
2. Implement authentication with Salesforce
3. Read contacts from Salesforce
4. Write contacts to Salesforce
5. Handle sync conflicts
6. Schedule automatic sync
```

**Best for:**
- New integrations
- Unfamiliar technology
- High uncertainty

---

## Anti-Patterns to Avoid

### Don't Split By...

| Anti-Pattern | Why It's Bad | Better Approach |
|--------------|--------------|-----------------|
| **Architecture Layer** | "Backend story" + "Frontend story" | Vertical slice through all layers |
| **Component** | "Database story" + "API story" | End-to-end user value |
| **Developer** | "John's story" + "Jane's story" | Any team member can work it |
| **Task** | "Write tests story" | Tasks, not stories |

### Examples of Bad Splits

❌ **Split by layer:**
```
1. Create database tables for orders
2. Create API endpoints for orders
3. Create UI for orders
```
Each piece has no user value until all are done.

✅ **Better (vertical slice):**
```
1. User can view list of orders (simple)
2. User can view order details
3. User can create new order
4. User can cancel order
```
Each delivers end-to-end value.

---

## Decision Guide

```
Is the story too large (8+ points)?
│
├─ Yes → What makes it large?
│    │
│    ├─ Multiple user flows? → Pattern 1: Workflow Steps
│    ├─ Complex business rules? → Pattern 2: Business Rules
│    ├─ Multiple data types? → Pattern 3: Data Variations
│    ├─ CRUD operations? → Pattern 4: Operations
│    ├─ Multiple user types? → Pattern 5: User Roles
│    ├─ Multiple platforms? → Pattern 6: Platform
│    ├─ Many requirements? → Pattern 7: Simple/Complex
│    ├─ Process stages? → Pattern 8: Accept/Handle/Respond
│    ├─ NFRs mixed with FRs? → Pattern 9: Defer Quality
│    └─ High uncertainty? → Pattern 10: Spike First
│
└─ No → Story is sized appropriately
```

---

## Splitting Exercise Template

Use this template in refinement:

```markdown
## Story Being Split
[Original story]

## Why Split?
- [ ] Too large (estimated at ___ points)
- [ ] Multiple concerns
- [ ] High uncertainty
- [ ] Multiple user types
- [ ] Other: ___

## Pattern(s) Applied
[Which patterns are you using?]

## Resulting Stories

### Story 1
As a ___, I want ___, so that ___.
- Acceptance criteria:
- Estimated: ___ points

### Story 2
As a ___, I want ___, so that ___.
- Acceptance criteria:
- Estimated: ___ points

[Continue as needed]

## Validation
For each resulting story:
- [ ] Independent (can be built alone)
- [ ] Valuable (delivers user value)
- [ ] Small (fits in sprint)
- [ ] Testable (clear acceptance)
```

---

## Quick Reference

| Pattern | Use When | Example Trigger |
|---------|----------|-----------------|
| Workflow Steps | Multi-step process | "First... then... finally" |
| Business Rules | Complex logic | "Depending on... or..." |
| Data Variations | Multiple formats | "Support CSV, Excel, JSON" |
| Operations | Resource management | "Manage users" |
| User Roles | Different personas | "Admin vs user" |
| Platform | Multi-device | "Web and mobile" |
| Simple/Complex | Feature overload | "With all these features" |
| Accept/Handle/Respond | Processing stages | "Submit and track" |
| Defer Quality | NFR heavy | "Fast, secure, accessible" |
| Spike First | High uncertainty | "Never done this before" |

## Related Documents

- Epic Decomposition Playbook
- User Story Writing Playbook
- INVEST Criteria Guide

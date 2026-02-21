# Epic Decomposition Playbook

A guide to breaking down large epics into manageable features, user stories, and incremental deliverables that maintain value and reduce risk.

## Purpose

Epic decomposition is the art of breaking large initiatives into smaller, deliverable pieces. Effective decomposition:
- Enables incremental value delivery
- Reduces risk through smaller batches
- Improves estimation accuracy
- Facilitates parallel work streams
- Provides clearer progress visibility

## Epic Hierarchy

Understanding the hierarchy helps with proper decomposition:

```
Theme / Initiative (Months-Quarters)
    └── Epic (1-3 Months)
        └── Feature (2-4 Sprints)
            └── User Story (1 Sprint)
                └── Task (Hours-Days)
```

### Definitions

| Level | Scope | Typical Duration |
|-------|-------|------------------|
| **Theme** | Strategic business goal | Quarters to years |
| **Epic** | Major capability or outcome | 1-3 months |
| **Feature** | Coherent functionality group | 2-4 sprints |
| **Story** | Single user-valuable increment | 1 sprint or less |
| **Task** | Technical work item | Hours to days |

## When to Decompose

### Signs an Epic Needs Decomposition

- Cannot be delivered in one quarter
- Team can't estimate it (too much uncertainty)
- Multiple independent work streams
- Too many unknowns to plan
- Stakeholders need earlier value

### Signs a Story Needs Decomposition

- Estimated at 13+ story points
- Can't be completed in one sprint
- Contains multiple "and" clauses
- Team can't agree on estimate
- Has embedded dependencies

## Decomposition Strategies

### 1. User Journey Decomposition

Break down by steps in the user's journey:

**Epic**: User Checkout
```
Feature 1: Shopping Cart
  - Story: Add item to cart
  - Story: Update cart quantity
  - Story: Remove item from cart
  - Story: View cart summary

Feature 2: Shipping
  - Story: Enter shipping address
  - Story: Select shipping method
  - Story: Calculate shipping cost

Feature 3: Payment
  - Story: Enter payment information
  - Story: Process payment
  - Story: Handle payment errors

Feature 4: Confirmation
  - Story: Display order summary
  - Story: Send confirmation email
  - Story: Update inventory
```

### 2. Functional Decomposition

Break down by system functions (CRUD):

**Epic**: Customer Management
```
Feature: Customer Records
  - Story: Create new customer
  - Story: View customer details
  - Story: Edit customer information
  - Story: Deactivate customer
  - Story: Search customers
  - Story: Export customer list
```

### 3. Data-Driven Decomposition

Break down by data objects or entities:

**Epic**: Analytics Dashboard
```
Feature: Sales Metrics
  - Story: Daily sales summary
  - Story: Sales by product category
  - Story: Sales by region

Feature: Customer Metrics
  - Story: Customer acquisition trends
  - Story: Customer retention rate
  - Story: Customer lifetime value

Feature: Inventory Metrics
  - Story: Stock levels
  - Story: Reorder alerts
  - Story: Inventory turnover
```

### 4. Role-Based Decomposition

Break down by user role or persona:

**Epic**: User Management
```
Feature: Admin Users
  - Story: Admin can create users
  - Story: Admin can assign roles
  - Story: Admin can disable accounts

Feature: Regular Users
  - Story: User can view profile
  - Story: User can update profile
  - Story: User can change password

Feature: Guest Users
  - Story: Guest can browse catalog
  - Story: Guest can create account
```

### 5. Business Rule Decomposition

Break down by business rules complexity:

**Epic**: Pricing Engine
```
Feature: Base Pricing
  - Story: Set base product price
  - Story: Display price on catalog

Feature: Discount Rules
  - Story: Percentage discounts
  - Story: Fixed amount discounts
  - Story: Buy-one-get-one offers

Feature: Dynamic Pricing
  - Story: Time-based pricing
  - Story: Volume-based pricing
  - Story: Customer segment pricing
```

### 6. Interface/Platform Decomposition

Break down by platform or integration:

**Epic**: Mobile App
```
Feature: iOS App
  - Story: iOS login
  - Story: iOS dashboard
  - Story: iOS push notifications

Feature: Android App
  - Story: Android login
  - Story: Android dashboard
  - Story: Android push notifications

Feature: API Layer
  - Story: Authentication API
  - Story: Data sync API
  - Story: Notification API
```

### 7. Quality Attribute Decomposition

Start simple, then enhance non-functional aspects:

**Epic**: Search Feature
```
Feature: Basic Search (MVP)
  - Story: Simple text search
  - Story: Display results list

Feature: Search Usability
  - Story: Search suggestions
  - Story: Search filters
  - Story: Sort results

Feature: Search Performance
  - Story: Implement caching
  - Story: Index optimization
  - Story: Pagination

Feature: Search Accessibility
  - Story: Keyboard navigation
  - Story: Screen reader support
```

## The Decomposition Process

### Step 1: Understand the Epic

Before decomposing, ensure you understand:
- **Business goal**: Why does this epic exist?
- **User needs**: Who benefits and how?
- **Success criteria**: How will we know it's done?
- **Constraints**: Technical, regulatory, timeline

### Step 2: Identify the MVP

**Minimum Viable Product (MVP)** = smallest version that delivers value

Questions to find MVP:
- What's the simplest version users would actually use?
- What can we cut and still solve the core problem?
- What's the smallest experiment to test our hypothesis?

### Step 3: Map the User Journey

1. List all user actions/workflows
2. Identify decision points
3. Note variations and exceptions
4. Prioritize by user value

### Step 4: Apply Decomposition Strategy

Choose the most appropriate strategy (or combine):
- Complex workflows → User Journey
- Data-heavy features → Data-Driven
- Multi-user features → Role-Based
- Technical uncertainty → Quality Attribute

### Step 5: Validate Independence

For each resulting story, verify INVEST:
- **I**ndependent: Can be built separately
- **N**egotiable: Details flexible
- **V**aluable: Delivers user value
- **E**stimable: Team can estimate
- **S**mall: Fits in a sprint
- **T**estable: Can verify completion

### Step 6: Sequence and Prioritize

Arrange stories considering:
- Technical dependencies
- Value delivery order
- Risk reduction
- Team capacity

## Story Mapping

### What is Story Mapping?

A visual technique for organizing stories that:
- Shows the big picture
- Reveals dependencies
- Helps identify MVP
- Facilitates prioritization

### Creating a Story Map

```
User Activities (left to right journey)
    |
    v
+-----------+-----------+-----------+-----------+
|  Browse   |  Select   |  Purchase |  Receive  |  ← User Activities
+-----------+-----------+-----------+-----------+
|  Search   |  View     |  Add to   |  Track    |  ← Walking Skeleton
|  products |  details  |  cart     |  order    |
+-----------+-----------+-----------+-----------+
|  Filter   |  Compare  |  Apply    |  Review   |  ← Release 1
|  results  |  items    |  coupon   |  order    |
+-----------+-----------+-----------+-----------+
|  Save     |  Reviews  |  Multiple |  Returns  |  ← Release 2
|  search   |           |  payment  |           |
+-----------+-----------+-----------+-----------+
```

### Walking Skeleton

First slice through the story map that:
- Covers entire user journey (end-to-end)
- Is minimal but functional
- Proves architecture works
- Enables integration testing early

## Common Mistakes

### Mistake 1: Technical Decomposition

**Wrong**: Breaking into technical layers
```
- Backend API
- Database schema
- Frontend UI
- Integration testing
```

**Right**: Breaking into user value
```
- User can view products
- User can search products
- User can filter by category
```

### Mistake 2: Too Fine-Grained

**Wrong**: Tasks disguised as stories
```
- Create database table
- Write API endpoint
- Design UI mockup
- Write unit tests
```

**Right**: User-facing capabilities
```
- User can register account
```

### Mistake 3: "And" Stories

**Wrong**: Multiple features in one story
```
User can search products AND filter results AND save searches AND view history
```

**Right**: One capability per story
```
- User can search products
- User can filter search results
- User can save searches
- User can view search history
```

### Mistake 4: UI-Only Stories

**Wrong**: Stories that don't include backend
```
- Display registration form
```

**Right**: End-to-end functionality
```
- User can register new account (form, validation, storage, confirmation)
```

## Templates

### Epic Definition Template

```markdown
## Epic: [Title]

### Business Value
[Why does this matter? What problem does it solve?]

### Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

### In Scope
- [Feature/capability 1]
- [Feature/capability 2]

### Out of Scope
- [Explicitly excluded item 1]
- [Explicitly excluded item 2]

### Features
1. [Feature 1]
2. [Feature 2]

### Dependencies
- [Dependency 1]
- [Dependency 2]

### Risks
- [Risk 1]
- [Risk 2]
```

### Feature Definition Template

```markdown
## Feature: [Title]

### Part of Epic
[Parent Epic name]

### Description
[What this feature enables]

### User Stories
- [ ] [Story 1] (X points)
- [ ] [Story 2] (X points)
- [ ] [Story 3] (X points)

### Acceptance Criteria
- [Feature-level criterion 1]
- [Feature-level criterion 2]

### Technical Notes
- [Architecture consideration]
- [Integration requirement]
```

## Workshop Activity

### Epic Decomposition Workshop (2 hours)

**Participants**: PO, Dev Team, UX (optional)

**Agenda**:

1. **Present Epic** (15 min)
   - PO explains business context
   - Team asks clarifying questions

2. **User Journey Mapping** (30 min)
   - Identify all user activities
   - Map on whiteboard left-to-right
   - Note variations and exceptions

3. **Identify Features** (20 min)
   - Group related activities
   - Name each feature
   - Verify completeness

4. **Decompose to Stories** (30 min)
   - Break each feature into stories
   - Apply INVEST criteria
   - Write on sticky notes

5. **Story Map Creation** (15 min)
   - Arrange stories under features
   - Identify walking skeleton
   - Mark MVP boundary

6. **Prioritize and Sequence** (10 min)
   - Dot vote on priorities
   - Identify dependencies
   - Rough sequencing

## Related Playbooks

- User Story Writing Playbook
- Estimation Techniques Playbook
- Release Planning Playbook

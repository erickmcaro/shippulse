# Vertical Slicing Guide

A guide to creating vertical slices that deliver end-to-end user value, avoiding the pitfalls of horizontal (layer-based) decomposition.

## What is Vertical Slicing?

A vertical slice is a piece of functionality that cuts through all layers of the application, delivering a complete, testable, valuable feature - even if small.

```
Horizontal (Anti-Pattern):        Vertical (Best Practice):
┌─────────────────────────┐       ┌─────┬─────┬─────┬─────┐
│         UI Layer        │       │     │     │     │     │
├─────────────────────────┤       │  S  │  S  │  S  │  S  │
│       Logic Layer       │       │  l  │  l  │  l  │  l  │
├─────────────────────────┤       │  i  │  i  │  i  │  i  │
│       Data Layer        │       │  c  │  c  │  c  │  c  │
├─────────────────────────┤       │  e  │  e  │  e  │  e  │
│      Database Layer     │       │     │     │     │     │
└─────────────────────────┘       │  1  │  2  │  3  │  4  │
                                  └─────┴─────┴─────┴─────┘
```

## Why Vertical Slices?

### Benefits

| Benefit | Explanation |
|---------|-------------|
| **Early value** | Users get something useful immediately |
| **Fast feedback** | Learn from real usage quickly |
| **Reduced risk** | Integration proven early |
| **Flexibility** | Easy to change direction |
| **Momentum** | Team sees completed work |
| **Testing** | Each slice is testable end-to-end |

### Problems with Horizontal Slices

| Issue | Impact |
|-------|--------|
| No value until all layers complete | Delayed feedback |
| Integration problems discovered late | Costly rework |
| All-or-nothing delivery | High risk |
| Dependencies between layers | Coordination overhead |
| Hard to test in isolation | Quality issues |

## Creating Vertical Slices

### Step 1: Identify the User Journey

Map the complete user journey for the feature:

```
User wants to: Purchase a product

Journey:
1. Browse products
2. View product details
3. Add to cart
4. Enter shipping info
5. Enter payment
6. Confirm order
7. Receive confirmation
```

### Step 2: Find the Thinnest Path

Identify the minimum path through all layers:

**Thick slice (too much):**
```
Browse all products with filters, sorting, categories,
search, recommendations, and infinite scroll
```

**Thin slice (just right):**
```
Display 5 hardcoded products in a simple list
```

### Step 3: Cut Through All Layers

Ensure the slice touches every necessary layer:

```
Thin Slice: "View one product"

┌──────────────────────────────────────────────┐
│ UI: Product detail page (minimal styling)    │
├──────────────────────────────────────────────┤
│ API: GET /products/{id}                      │
├──────────────────────────────────────────────┤
│ Logic: Fetch product by ID                   │
├──────────────────────────────────────────────┤
│ Data: Query products table                   │
├──────────────────────────────────────────────┤
│ DB: Products table with basic fields         │
└──────────────────────────────────────────────┘
```

### Step 4: Validate INVEST

Check each slice:
- **I**ndependent: Can be deployed alone
- **N**egotiable: Details can be discussed
- **V**aluable: Delivers user value
- **E**stimable: Can be estimated
- **S**mall: Fits in a sprint
- **T**estable: Has acceptance criteria

## Examples

### Example 1: E-Commerce Checkout

**Feature:** Complete checkout system

**Horizontal (Wrong):**
```
Sprint 1: Database schema for orders, payments, addresses
Sprint 2: API endpoints for all checkout operations
Sprint 3: UI for all checkout pages
Sprint 4: Integration and testing
```

**Vertical (Correct):**
```
Sprint 1: User can view cart with hardcoded items
         (UI + API + Data for cart viewing)

Sprint 2: User can add item to cart
         (UI + API + Logic + Data for add-to-cart)

Sprint 3: User can enter shipping address
         (UI + API + Validation + Data for addresses)

Sprint 4: User can complete purchase (one payment method)
         (UI + API + Payment integration + Order creation)
```

### Example 2: Search Feature

**Feature:** Product search with filters

**Horizontal (Wrong):**
```
Story 1: Set up Elasticsearch
Story 2: Index all products
Story 3: Create search API
Story 4: Build search UI
Story 5: Add filters
```

**Vertical (Correct):**
```
Story 1: Search by name returns matching products
         (UI: search box + results, API: search endpoint,
          Data: simple SQL LIKE query)

Story 2: Search results show product images and prices
         (Enhance existing slice with more data)

Story 3: Filter search results by category
         (Add filter to UI, Add category filter to query)

Story 4: Search with full-text matching
         (Replace SQL LIKE with Elasticsearch, keep UI same)
```

### Example 3: User Dashboard

**Feature:** Analytics dashboard for users

**Horizontal (Wrong):**
```
Story 1: Create data warehouse schema
Story 2: Build data pipeline
Story 3: Create aggregation queries
Story 4: Build dashboard UI
Story 5: Add charts and visualizations
```

**Vertical (Correct):**
```
Story 1: Dashboard shows user's total orders this month
         (UI: single number, API: count query, Data: existing orders)

Story 2: Dashboard shows orders over time (line chart)
         (UI: chart component, API: time-series query)

Story 3: Dashboard shows orders by category (pie chart)
         (UI: pie chart, API: category breakdown)

Story 4: Dashboard is personalized (remembers preferences)
         (UI: settings, API: user prefs, Data: preferences table)
```

## Walking Skeleton Approach

Start with a "walking skeleton" - the thinnest end-to-end slice:

### What is a Walking Skeleton?

A tiny implementation that:
- Walks through all architectural layers
- Proves the architecture works
- Provides deployment pipeline validation
- Creates foundation for incremental development

### Walking Skeleton Example: Task Management App

```
Walking Skeleton (Sprint 1):
- UI: Single page with "Add Task" button and task list
- API: POST /tasks (create), GET /tasks (list)
- Logic: Basic CRUD operations
- DB: Tasks table with title field only

NOT included in skeleton:
- User authentication
- Task due dates
- Categories
- Priority
- Sharing
- Search
- Mobile app
```

### Building on the Skeleton

```
Sprint 2: Add task completion toggle
Sprint 3: Add due dates to tasks
Sprint 4: Add user authentication
Sprint 5: Add task categories
Sprint 6: Add task search
...
```

## Slicing Techniques

### Technique 1: Hardcode First

Replace complex logic with hardcoded values initially.

```
Slice 1: Show shipping options (hardcoded list)
Slice 2: Calculate shipping based on weight
Slice 3: Get real-time rates from carriers
```

### Technique 2: Manual Before Automatic

Allow manual process before automation.

```
Slice 1: Admin manually approves orders (UI button)
Slice 2: System auto-approves orders < $100
Slice 3: Fraud detection for large orders
```

### Technique 3: Read Before Write

Implement reading data before writing.

```
Slice 1: View list of items
Slice 2: View item details
Slice 3: Create new item
Slice 4: Edit existing item
```

### Technique 4: One Before Many

Support single item before multiple.

```
Slice 1: Upload one file
Slice 2: Upload multiple files
Slice 3: Drag-and-drop upload
```

### Technique 5: Simple UI First

Start with basic UI, enhance later.

```
Slice 1: Plain table of data
Slice 2: Add sorting
Slice 3: Add filtering
Slice 4: Add pagination
Slice 5: Add export
```

## Anti-Patterns and Solutions

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| "Tech story" | No user value | Always deliver user-facing outcome |
| "Spike as delivery" | Research isn't shippable | Follow spike with implementation |
| "API first" | No UI means no testing | Include minimal UI in slice |
| "UI only" | No backend means mockup | Include real data, even if hardcoded |
| "All happy paths" | Ignores errors | Include one error path per slice |

## Slice Planning Template

Use this template for each slice:

```markdown
## Slice: [Name]

### User Value
As a [user], I can [action], so that [benefit].

### All Layers Included
- [ ] UI: [what user sees]
- [ ] API: [endpoints involved]
- [ ] Logic: [business rules]
- [ ] Data: [database operations]

### What's IN This Slice
- [Specific capability 1]
- [Specific capability 2]

### What's NOT in This Slice (Deferred)
- [Future capability 1]
- [Future capability 2]

### Acceptance Criteria
- [Criterion 1]
- [Criterion 2]

### Technical Notes
- [Implementation notes]

### Estimated Size
[Points]
```

## Quick Reference

### Slice Checklist

Before accepting a slice:
- [ ] Delivers user value (not just technical work)
- [ ] Cuts through all necessary layers
- [ ] Is independently deployable
- [ ] Has clear acceptance criteria
- [ ] Is small enough for one sprint
- [ ] Can be tested end-to-end

### Key Questions

- "Can a user do something new after this slice?"
- "Can we deploy this slice to production?"
- "Can we get user feedback on this slice?"
- "Does this slice prove our architecture works?"

## Related Documents

- Story Splitting Patterns
- Epic Decomposition Playbook
- INVEST Criteria Guide

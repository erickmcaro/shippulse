# Elatta Estimation Method Examples

This document provides examples of using the Elatta estimation method, which breaks down work into four categories: UI, Logic, Data, and Test.

## Elatta Method Overview

The Elatta method estimates complexity across four dimensions:

| Category | What It Covers | Complexity Factors |
|----------|----------------|-------------------|
| **UI** | User interface, visual components | Screens, components, interactions, responsiveness |
| **Logic** | Business rules, processing | Algorithms, validations, integrations, workflows |
| **Data** | Persistence, data access | Queries, schemas, migrations, caching, APIs |
| **Test** | Quality assurance | Unit tests, integration tests, E2E, manual testing |

### Scoring Scale

Each category is scored 1-5:

| Score | Complexity Level | Description |
|-------|------------------|-------------|
| 1 | Trivial | Almost none, minimal work |
| 2 | Simple | Straightforward, well-understood |
| 3 | Moderate | Some complexity, standard patterns |
| 4 | Complex | Significant complexity, multiple considerations |
| 5 | Very Complex | High complexity, many unknowns |

### Converting to Story Points

| Elatta Total | Story Points |
|--------------|--------------|
| 4-6 | 2 |
| 7-9 | 3 |
| 10-12 | 5 |
| 13-15 | 8 |
| 16-18 | 13 |
| 19+ | Split the story |

---

## Example 1: Simple CRUD Feature

### Story: Add a Contact Form

```
As a website visitor,
I want to submit a contact form,
So that I can reach the support team.
```

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 2 | Single form with 5 fields, standard layout, basic validation feedback |
| **Logic** | 2 | Simple validation rules, email sending via existing service |
| **Data** | 1 | Store submission in existing table, no new schema |
| **Test** | 2 | Unit tests for validation, integration test for submission |
| **Total** | **7** | |

**Story Points**: 3

### Task Breakdown

```
UI (2):
- Form component with 5 fields
- Client-side validation UI
- Success/error messages
- Responsive layout

Logic (2):
- Server-side validation
- Call email service API
- Rate limiting check

Data (1):
- Insert submission record
- No migration needed

Test (2):
- Unit tests for validation
- Integration test for form submission
```

---

## Example 2: Moderate Feature

### Story: Product Search with Filters

```
As a shopper,
I want to search products and filter by category and price,
So that I can find items I want to buy.
```

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 4 | Search bar, filter panel, results grid, pagination, loading states |
| **Logic** | 3 | Search algorithm, filter combination logic, sorting |
| **Data** | 3 | Search query optimization, filter indexes, caching strategy |
| **Test** | 3 | Multiple filter combinations, performance tests, edge cases |
| **Total** | **13** | |

**Story Points**: 8

### Task Breakdown

```
UI (4):
- Search input with autocomplete
- Filter sidebar (category tree, price range slider)
- Results grid with product cards
- Pagination component
- Loading skeletons
- No results state
- Mobile responsive design

Logic (3):
- Search term parsing
- Filter combination logic
- Result ranking algorithm
- Sort options (relevance, price, rating)
- URL state management

Data (3):
- Search query builder
- Add indexes for filters
- Implement result caching
- Optimize for large catalogs

Test (3):
- Unit tests for search logic
- Filter combination tests
- Performance tests (1000+ products)
- Accessibility testing
- Cross-browser testing
```

---

## Example 3: Complex Feature

### Story: Multi-Step Checkout Flow

```
As a customer,
I want to complete checkout with shipping and payment,
So that I can purchase items in my cart.
```

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 5 | Multi-step wizard, address forms, payment integration, order summary, confirmation |
| **Logic** | 5 | Cart validation, tax calculation, shipping rates, payment processing, inventory checks |
| **Data** | 4 | Create order, update inventory, payment records, address storage |
| **Test** | 4 | Many flows, payment scenarios, failure modes, E2E critical path |
| **Total** | **18** | |

**Story Points**: 13 (consider splitting)

### Recommendation: Split into Smaller Stories

**Story 2A: Shipping Address Step** (Total: 8 → 3 points)
- UI: 2 (Address form, validation)
- Logic: 2 (Address validation, save to profile)
- Data: 2 (Store address)
- Test: 2 (Validation tests)

**Story 2B: Shipping Method Step** (Total: 9 → 3 points)
- UI: 2 (Shipping options, cost display)
- Logic: 3 (Rate calculation, carrier integration)
- Data: 2 (Cache rates)
- Test: 2 (Rate calculation tests)

**Story 2C: Payment Step** (Total: 12 → 5 points)
- UI: 3 (Payment form, saved cards)
- Logic: 4 (Payment gateway, 3D Secure)
- Data: 3 (Payment records, tokenization)
- Test: 2 (Payment flow tests with mocks)

**Story 2D: Order Confirmation** (Total: 10 → 5 points)
- UI: 3 (Summary, confirmation page)
- Logic: 3 (Create order, update inventory, notifications)
- Data: 3 (Order creation, inventory update)
- Test: 1 (Happy path test)

---

## Example 4: Technical Story

### Story: Implement API Rate Limiting

```
As a platform administrator,
I want API rate limiting in place,
So that the system is protected from abuse.
```

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 1 | Admin dashboard update for viewing limits, error response format |
| **Logic** | 4 | Rate limiting algorithm, configurable limits per endpoint, bypass rules |
| **Data** | 3 | Redis for tracking, configuration storage, metrics logging |
| **Test** | 3 | Load testing, limit verification, bypass testing |
| **Total** | **11** | |

**Story Points**: 5

### Task Breakdown

```
UI (1):
- Update API error responses with rate limit headers
- Admin UI to view/edit limits (optional)

Logic (4):
- Token bucket or sliding window algorithm
- Per-user and per-IP limiting
- Configurable limits per endpoint
- Whitelist/bypass rules
- Graceful degradation

Data (3):
- Redis integration for counters
- Configuration in database
- Metrics for monitoring
- Cleanup of expired data

Test (3):
- Unit tests for limiting logic
- Integration tests with Redis
- Load test to verify limits
- Test bypass rules
```

---

## Example 5: Bug Fix

### Story: Fix Login Error Not Displayed

```
Bug: When login fails, no error message appears
Expected: User sees "Invalid credentials" message
```

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 2 | Add error display, style error message |
| **Logic** | 1 | Error is returned from API, just not shown |
| **Data** | 1 | No data changes needed |
| **Test** | 2 | Add test for error display |
| **Total** | **6** | |

**Story Points**: 2

---

## Example 6: Spike (Research)

### Story: Evaluate PDF Generation Libraries

```
Spike: Research PDF generation options for reports
Time-box: 2 days
```

### Elatta Breakdown (Estimated based on deliverable)

| Category | Score | Rationale |
|----------|-------|-----------|
| **UI** | 1 | Prototype PDF layouts |
| **Logic** | 2 | Test library APIs, evaluate features |
| **Data** | 1 | Sample data for testing |
| **Test** | 1 | Manual testing, no automated tests |
| **Total** | **5** | |

**Story Points**: 2

---

## Estimation Template

Use this template during estimation sessions:

```markdown
## Story: [Title]

### Elatta Breakdown

| Category | Score | Rationale |
|----------|-------|-----------|
| UI | _ | |
| Logic | _ | |
| Data | _ | |
| Test | _ | |
| **Total** | **_** | |

### Story Points: _

### Breakdown Notes

**UI (_):**
-

**Logic (_):**
-

**Data (_):**
-

**Test (_):**
-

### Risks/Unknowns
-
```

---

## Common Patterns

### When UI Dominates (UI > Logic + Data)

Typical for:
- Dashboard and visualization features
- Complex form builders
- Interactive experiences

Consider:
- Design approval requirements
- Accessibility testing
- Cross-browser testing

### When Logic Dominates (Logic > UI + Data)

Typical for:
- Calculation engines
- Workflow automation
- Integration features

Consider:
- Algorithm complexity
- Edge cases
- Error handling

### When Data Dominates (Data > UI + Logic)

Typical for:
- Data migration features
- Reporting and analytics
- Import/export functionality

Consider:
- Query performance
- Data volume
- Schema changes

### Balanced Scores

When all categories are similar (2-3 each), the feature is well-scoped and typically straightforward to implement.

## Related Documents

- Estimation Techniques Playbook
- Story Point Guidelines
- Sprint Planning Playbook

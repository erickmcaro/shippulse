# Golden PBI: UI Component Implementation

This exemplar demonstrates a well-structured Product Backlog Item for implementing a frontend UI component.

## PBI Overview

| Field | Value |
|-------|-------|
| **ID** | PBI-2024-0187 |
| **Title** | Build reusable data table component with sorting and pagination |
| **Type** | User Story |
| **Epic** | Design System |
| **Sprint** | Sprint 24 |
| **Story Points** | 8 |
| **Priority** | P1 (Must Have) |

## User Story

```
As a frontend developer,
I want a reusable data table component with sorting and pagination,
So that I can display tabular data consistently across the application.
```

## Business Context

Multiple features need data tables:
- User management (admin)
- Order history (customers)
- Product catalog (all users)
- Audit logs (admin)

A reusable component ensures consistency and reduces development time.

## Acceptance Criteria

### Core Functionality

```gherkin
Scenario: Display data in table format
  Given I render the DataTable component with data
  When the component loads
  Then data is displayed in rows and columns
  And column headers match provided configuration
  And rows alternate background color for readability

Scenario: Sort by column (ascending)
  Given the DataTable is rendered with sortable columns
  When I click on a column header
  Then data is sorted by that column in ascending order
  And the column header shows an up arrow indicator
  And other column indicators are cleared

Scenario: Sort by column (descending)
  Given a column is sorted ascending
  When I click the same column header again
  Then data is sorted in descending order
  And the column header shows a down arrow indicator

Scenario: Sort by column (clear)
  Given a column is sorted descending
  When I click the same column header again
  Then sorting is cleared
  And data returns to original order
  And no sort indicator is shown

Scenario: Paginate results
  Given the DataTable has more rows than page size
  When the component renders
  Then only the first page of results is shown
  And pagination controls appear below the table
  And page count reflects total data divided by page size

Scenario: Navigate to next page
  Given I am on page 1 of paginated results
  When I click "Next" or page 2
  Then the next page of results is displayed
  And the current page indicator updates
  And scroll position resets to top of table

Scenario: Change page size
  Given the DataTable supports page size selection
  When I select a different page size (10, 25, 50, 100)
  Then the table re-renders with new page size
  And pagination updates accordingly
  And I return to page 1
```

### Accessibility

```gherkin
Scenario: Keyboard navigation
  Given the DataTable is rendered
  When I press Tab
  Then focus moves through interactive elements
  And focus is visible on all interactive elements

Scenario: Sort with keyboard
  Given focus is on a sortable column header
  When I press Enter or Space
  Then the column sorts (same as click)

Scenario: Screen reader support
  Given a screen reader is active
  When the table is rendered
  Then table has appropriate ARIA labels
  And sort state is announced
  And pagination state is announced
```

### Empty and Loading States

```gherkin
Scenario: Empty state
  Given the DataTable receives empty data
  When the component renders
  Then I see an empty state message
  And the message is customizable
  And column headers are still visible

Scenario: Loading state
  Given the DataTable is in loading state
  When the component renders
  Then I see a loading skeleton or spinner
  And interactive elements are disabled

Scenario: Error state
  Given data fetching fails
  When error prop is provided
  Then I see an error message
  And a retry option is available
```

## Component API

### Props

```typescript
interface DataTableProps<T> {
  // Data
  data: T[];
  columns: ColumnDefinition<T>[];

  // Pagination
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalCount?: number; // For server-side pagination
  onPageChange?: (page: number, pageSize: number) => void;

  // Sorting
  sortable?: boolean;
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  onSortChange?: (column: string, direction: 'asc' | 'desc' | null) => void;

  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;

  // States
  loading?: boolean;
  error?: string;
  emptyMessage?: string;

  // Styling
  className?: string;
  rowClassName?: (row: T) => string;
  stickyHeader?: boolean;
  striped?: boolean;
}

interface ColumnDefinition<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}
```

### Usage Example

```tsx
import { DataTable } from '@/components/DataTable';

const columns = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'status', header: 'Status', render: (v) => <Badge>{v}</Badge> },
  { key: 'createdAt', header: 'Created', sortable: true },
];

function UserList() {
  return (
    <DataTable
      data={users}
      columns={columns}
      pagination
      pageSize={25}
      sortable
      defaultSort={{ column: 'createdAt', direction: 'desc' }}
      emptyMessage="No users found"
    />
  );
}
```

## Design Specifications

### Visual Design

| Element | Specification |
|---------|---------------|
| Header background | `--color-gray-100` |
| Header text | `--font-weight-semibold`, `--font-size-sm` |
| Row height | 48px minimum |
| Cell padding | 12px horizontal, 8px vertical |
| Border | 1px `--color-gray-200` |
| Hover state | `--color-gray-50` background |
| Sort icon | 16x16, `--color-gray-500` inactive, `--color-primary` active |

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (>1024px) | Full table with all columns |
| Tablet (768-1024px) | Horizontal scroll if needed |
| Mobile (<768px) | Card layout or essential columns only |

## Technical Tasks

| Task | Estimate | Notes |
|------|----------|-------|
| Create base table component | 3 hrs | Structure, props, types |
| Implement sorting logic | 2 hrs | Client-side, multi-column support |
| Implement pagination | 2 hrs | Client and server-side modes |
| Add keyboard navigation | 2 hrs | Tab, Enter, Arrow keys |
| Add ARIA attributes | 1 hr | Screen reader support |
| Create loading/empty/error states | 1.5 hrs | Skeleton, messages |
| Style according to design system | 2 hrs | Tokens, responsive |
| Write unit tests | 3 hrs | All scenarios |
| Write Storybook stories | 2 hrs | All states and variants |
| Documentation | 1 hr | Usage guide |

## Definition of Done

- [ ] Component renders data correctly
- [ ] Sorting works (asc, desc, clear)
- [ ] Pagination works (page navigation, size change)
- [ ] All states handled (loading, empty, error)
- [ ] Keyboard accessible
- [ ] Screen reader compatible (ARIA)
- [ ] Responsive on all breakpoints
- [ ] Unit tests passing (≥80% coverage)
- [ ] Storybook stories for all states
- [ ] Design review passed
- [ ] Code review approved
- [ ] Documentation complete

## Testing Strategy

### Unit Tests

```typescript
describe('DataTable', () => {
  describe('Rendering', () => {
    it('renders data in rows and columns');
    it('renders column headers from config');
    it('applies custom renderers');
    it('handles empty data');
  });

  describe('Sorting', () => {
    it('sorts ascending on first click');
    it('sorts descending on second click');
    it('clears sort on third click');
    it('updates sort indicator');
    it('calls onSortChange callback');
  });

  describe('Pagination', () => {
    it('shows correct number of rows per page');
    it('navigates to next/previous page');
    it('updates on page size change');
    it('disables prev on first page');
    it('disables next on last page');
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes');
    it('supports keyboard navigation');
    it('announces sort changes');
  });
});
```

### Storybook Stories

- Default table
- With sorting
- With pagination
- Server-side pagination
- Empty state
- Loading state
- Error state
- Selectable rows
- Custom cell renderers
- Responsive variants

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Design tokens | Complete | Uses existing design system |
| Icon library | Complete | Sort arrows from icon set |
| Skeleton component | Complete | For loading state |

## Notes

- Consider virtualization for large datasets (>1000 rows)
- Server-side pagination recommended for large datasets
- Test with real-world data volumes
- Follow existing component patterns

## Related Items

- Parent Epic: EPIC-2024-DESIGN
- Used By: PBI-2024-0189 (User List Page)
- Uses: Design Token System

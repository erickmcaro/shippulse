# Golden PBI: Database Migration

This exemplar demonstrates a well-structured Product Backlog Item for implementing a database schema migration.

## PBI Overview

| Field | Value |
|-------|-------|
| **ID** | PBI-2024-0203 |
| **Title** | Add soft delete support to User table |
| **Type** | Technical Story |
| **Epic** | Platform Infrastructure |
| **Sprint** | Sprint 25 |
| **Story Points** | 5 |
| **Priority** | P1 (Must Have) |

## User Story

```
As a platform administrator,
I want users to be soft-deleted rather than permanently removed,
So that we can recover accidentally deleted accounts and maintain audit history.
```

## Business Context

Current state:
- Users are permanently deleted from the database
- No recovery option for accidental deletions
- Audit requirements mandate data retention for 7 years
- GDPR allows soft delete with anonymization

Required for:
- Data retention compliance
- Account recovery capability
- Audit trail integrity
- User data export before permanent deletion

## Acceptance Criteria

### Migration Requirements

```gherkin
Scenario: Migration adds required columns
  Given the current users table exists
  When the migration runs
  Then a "deleted_at" column is added (nullable timestamp)
  And a "deleted_by" column is added (nullable string)
  And existing rows have NULL for both columns
  And new indexes are created for query performance

Scenario: Migration is reversible
  Given the migration has been applied
  When the rollback is executed
  Then the "deleted_at" column is removed
  And the "deleted_by" column is removed
  And no data is lost from existing columns

Scenario: Migration handles large tables
  Given the users table has 1 million+ rows
  When the migration runs
  Then it completes without timeout
  And it does not lock the table for more than 5 seconds
  And application remains available during migration
```

### Application Behavior

```gherkin
Scenario: Queries exclude soft-deleted users by default
  Given a user has been soft-deleted
  When the application queries for users
  Then soft-deleted users are excluded
  And query performance is not degraded

Scenario: Soft-deleted users can be queried explicitly
  Given a user has been soft-deleted
  When an admin queries with include_deleted=true
  Then soft-deleted users are included in results
  And deleted_at timestamp is visible

Scenario: Soft delete sets correct values
  Given a user exists
  When the user is deleted
  Then deleted_at is set to current timestamp
  And deleted_by is set to the actor's ID
  And other user data remains unchanged

Scenario: Soft-deleted user cannot log in
  Given a user has been soft-deleted
  When they attempt to log in
  Then authentication fails
  And they see message "Account not found"
```

## Technical Specification

### Migration Script

```sql
-- Migration: 20240315_add_soft_delete_to_users

-- Up Migration
BEGIN;

-- Add columns
ALTER TABLE users
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN deleted_by VARCHAR(36) DEFAULT NULL;

-- Add index for soft delete queries (partial index for active users)
CREATE INDEX CONCURRENTLY idx_users_not_deleted
ON users (id)
WHERE deleted_at IS NULL;

-- Add index for admin queries on deleted users
CREATE INDEX CONCURRENTLY idx_users_deleted_at
ON users (deleted_at)
WHERE deleted_at IS NOT NULL;

COMMIT;

-- Down Migration
BEGIN;

DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_users_not_deleted;

ALTER TABLE users
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS deleted_by;

COMMIT;
```

### Model Changes

```typescript
// User model updates
interface User {
  id: string;
  email: string;
  // ... existing fields

  // New soft delete fields
  deletedAt: Date | null;
  deletedBy: string | null;
}

// Default scope excludes soft-deleted
const defaultUserScope = {
  where: {
    deletedAt: null
  }
};

// Scope for including deleted
const withDeletedScope = {
  // No where clause - includes all
};
```

### Query Changes

```typescript
// Before: Hard delete
async function deleteUser(id: string): Promise<void> {
  await User.destroy({ where: { id } });
}

// After: Soft delete
async function deleteUser(id: string, actorId: string): Promise<void> {
  await User.update(
    {
      deletedAt: new Date(),
      deletedBy: actorId
    },
    { where: { id } }
  );
}

// Restore user (admin only)
async function restoreUser(id: string): Promise<void> {
  await User.update(
    {
      deletedAt: null,
      deletedBy: null
    },
    {
      where: { id },
      scope: 'withDeleted'  // Include soft-deleted
    }
  );
}
```

## Technical Tasks

| Task | Estimate | Notes |
|------|----------|-------|
| Write migration script | 1 hr | Up and down migrations |
| Test migration on production clone | 2 hrs | Verify with real data volume |
| Update User model | 1 hr | Add fields, scopes |
| Update delete operations | 2 hrs | Service layer changes |
| Update queries (default scope) | 2 hrs | Ensure filtered by default |
| Add restore functionality | 1 hr | Admin feature |
| Update unit tests | 2 hrs | Cover new scenarios |
| Update integration tests | 1 hr | End-to-end flows |
| Documentation | 1 hr | Runbook, API docs |

## Migration Plan

### Pre-Migration

1. [ ] Backup production database
2. [ ] Test migration on staging with production data copy
3. [ ] Verify rollback works
4. [ ] Notify on-call team
5. [ ] Schedule maintenance window (if needed)

### Migration Execution

1. [ ] Run migration in development
2. [ ] Run migration in staging
3. [ ] Verify application functionality
4. [ ] Run migration in production
5. [ ] Verify production health

### Post-Migration

1. [ ] Verify indexes are created
2. [ ] Check query performance
3. [ ] Verify application behavior
4. [ ] Update monitoring dashboards
5. [ ] Close change management ticket

## Rollback Plan

**Trigger conditions**:
- Migration fails to complete
- Application errors increase >5%
- Query performance degrades >20%

**Rollback steps**:
1. Run down migration
2. Deploy previous application version
3. Verify functionality restored
4. Investigate root cause

**Rollback time estimate**: 5 minutes

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Table lock during migration | Medium | High | Use CONCURRENTLY for indexes |
| Queries miss soft-delete filter | Medium | High | Code review, integration tests |
| Performance degradation | Low | Medium | Add appropriate indexes |
| Rollback data loss | Low | High | Test rollback thoroughly |

## Definition of Done

- [ ] Migration script written and reviewed
- [ ] Migration tested on production-size data
- [ ] Rollback tested successfully
- [ ] User model updated
- [ ] All delete operations use soft delete
- [ ] Default queries exclude soft-deleted
- [ ] Admin can query deleted users
- [ ] Admin can restore deleted users
- [ ] Unit tests passing (≥90% coverage)
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Deployed to production

## Testing Strategy

### Unit Tests

```typescript
describe('User soft delete', () => {
  it('sets deletedAt on delete');
  it('sets deletedBy to actor ID');
  it('excludes soft-deleted from default queries');
  it('includes soft-deleted with explicit scope');
  it('allows restore of soft-deleted user');
  it('prevents login for soft-deleted user');
});
```

### Integration Tests

```typescript
describe('Soft delete flow', () => {
  it('complete delete and restore cycle');
  it('audit trail is maintained');
  it('cascading soft delete for related data');
});
```

### Performance Tests

- Query with 1M users, 10% soft-deleted
- Measure p95 latency for common queries
- Compare before/after migration

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Database access | Complete | Need admin privileges |
| Staging environment | Complete | With production data copy |
| Change approval | Pending | CAB meeting Thursday |

## Notes

- Consider data retention policy for permanent deletion
- Schedule job to anonymize soft-deleted data after 90 days
- Update data export to exclude soft-deleted by default
- Related tables (orders, etc.) may need similar treatment

## Related Items

- Parent Epic: EPIC-2024-PLATFORM
- Blocks: PBI-2024-0210 (GDPR compliance)
- Related: PBI-2024-0215 (Data retention policy)

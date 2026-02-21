# Golden PBI: API Endpoint Implementation

This exemplar demonstrates a well-structured Product Backlog Item for implementing a REST API endpoint.

## PBI Overview

| Field | Value |
|-------|-------|
| **ID** | PBI-2024-0142 |
| **Title** | Create API endpoint to retrieve user profile |
| **Type** | User Story |
| **Epic** | User Management |
| **Sprint** | Sprint 23 |
| **Story Points** | 5 |
| **Priority** | P2 (Should Have) |

## User Story

```
As an API consumer,
I want to retrieve a user's profile by their ID,
So that I can display user information in my application.
```

## Business Context

This endpoint is needed by:
- Mobile app team for user profile screens
- Third-party integrations for user data sync
- Admin dashboard for user management

## Acceptance Criteria

### Functional Requirements

```gherkin
Scenario: Successfully retrieve user profile
  Given I am authenticated with a valid API token
  And user with ID "usr_123" exists
  When I send GET request to /api/v1/users/usr_123
  Then response status is 200 OK
  And response body contains:
    | field       | type   | nullable |
    | id          | string | false    |
    | email       | string | false    |
    | firstName   | string | true     |
    | lastName    | string | true     |
    | avatar      | string | true     |
    | createdAt   | date   | false    |
    | updatedAt   | date   | false    |

Scenario: Request user that does not exist
  Given I am authenticated with a valid API token
  And user with ID "usr_nonexistent" does not exist
  When I send GET request to /api/v1/users/usr_nonexistent
  Then response status is 404 Not Found
  And response body contains:
    | error.code    | "USER_NOT_FOUND" |
    | error.message | "User not found" |

Scenario: Request without authentication
  Given I am not authenticated
  When I send GET request to /api/v1/users/usr_123
  Then response status is 401 Unauthorized
  And response body contains:
    | error.code    | "UNAUTHORIZED" |
    | error.message | "Authentication required" |

Scenario: Request with insufficient permissions
  Given I am authenticated as a user without admin role
  And I am requesting another user's profile
  When I send GET request to /api/v1/users/usr_456
  Then response status is 403 Forbidden
  And response body contains:
    | error.code    | "FORBIDDEN" |
    | error.message | "Access denied" |

Scenario: User can access own profile
  Given I am authenticated as user "usr_123"
  When I send GET request to /api/v1/users/usr_123
  Then response status is 200 OK
  And I receive my profile information
```

### Non-Functional Requirements

```gherkin
Scenario: Response time meets SLA
  Given the system is under normal load
  When I send a valid request
  Then response time is less than 200ms at 95th percentile

Scenario: Rate limiting is enforced
  Given I send more than 100 requests per minute
  When I send another request
  Then response status is 429 Too Many Requests
  And response includes Retry-After header
```

## API Specification

### Request

```
GET /api/v1/users/{userId}

Headers:
  Authorization: Bearer {token}
  Accept: application/json

Path Parameters:
  userId (required): string - User ID in format "usr_xxxx"
```

### Response (200 OK)

```json
{
  "data": {
    "id": "usr_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "https://cdn.example.com/avatars/usr_123.jpg",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-02-20T14:45:00Z"
  }
}
```

### Error Responses

```json
// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

// 403 Forbidden
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}

// 404 Not Found
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 30
  }
}
```

## Technical Tasks

| Task | Estimate | Owner |
|------|----------|-------|
| Create endpoint route and controller | 2 hrs | - |
| Implement service layer logic | 2 hrs | - |
| Add authentication/authorization checks | 1 hr | - |
| Write unit tests (target 90% coverage) | 3 hrs | - |
| Write integration tests | 2 hrs | - |
| Update API documentation (OpenAPI) | 1 hr | - |
| Code review | 1 hr | - |

## Definition of Done

- [ ] Code implemented following team standards
- [ ] Unit tests written and passing (≥90% coverage)
- [ ] Integration tests written and passing
- [ ] Code reviewed and approved
- [ ] API documentation updated in OpenAPI spec
- [ ] Deployed to staging environment
- [ ] Manual testing completed
- [ ] No critical or high security vulnerabilities
- [ ] Performance meets SLA (<200ms p95)

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| User service available | Complete | Uses existing user repository |
| Auth middleware deployed | Complete | JWT validation |
| API gateway configured | Complete | Rate limiting rules |

## Testing Strategy

### Unit Tests

```python
# Test cases to implement
def test_get_user_success():
    """Valid request returns user profile"""

def test_get_user_not_found():
    """Non-existent user returns 404"""

def test_get_user_unauthorized():
    """Missing auth returns 401"""

def test_get_user_forbidden():
    """Accessing other user without permission returns 403"""

def test_get_own_profile():
    """User can access their own profile"""

def test_response_format():
    """Response matches expected schema"""
```

### Integration Tests

```python
def test_full_flow_with_real_database():
    """End-to-end test with actual database"""

def test_rate_limiting():
    """Verify rate limits are enforced"""
```

## Notes

- Follow RESTful naming conventions
- Use standard error response format
- Log all requests for audit trail
- Mask sensitive data in logs
- Consider caching for frequently accessed profiles

## Related Items

- Parent Epic: EPIC-2024-USERMGMT
- Depends On: None
- Blocks: PBI-2024-0145 (User Profile UI)

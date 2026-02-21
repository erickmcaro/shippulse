# Golden Technical Task Breakdown

This exemplar demonstrates how to break down a user story into technical tasks with clear scope and estimates.

## Story Overview

**User Story**: As a user, I want to receive email notifications when my order ships, so that I can track my delivery.

| Field | Value |
|-------|-------|
| Story ID | PBI-2024-0312 |
| Story Points | 8 |
| Sprint | Sprint 26 |

## Task Breakdown

### Task 1: Create Email Template

**ID**: TASK-0312-01
**Estimate**: 3 hours

**Description**:
Create the HTML email template for shipping notifications using our email design system.

**Scope**:
- Create responsive HTML template
- Include order number, tracking link, carrier info
- Match brand guidelines
- Support both HTML and plain text versions
- Test in major email clients (Gmail, Outlook, Apple Mail)

**Technical Details**:
- Use MJML framework for email templates
- Template location: `/templates/email/order-shipped.mjml`
- Variables: orderNumber, trackingNumber, trackingUrl, carrierName, items[]

**Acceptance**:
- [ ] HTML renders correctly in Gmail web
- [ ] HTML renders correctly in Outlook
- [ ] HTML renders correctly on mobile
- [ ] Plain text fallback is readable
- [ ] All dynamic variables display correctly

---

### Task 2: Implement Shipping Event Handler

**ID**: TASK-0312-02
**Estimate**: 4 hours

**Description**:
Create event handler to process shipping events and trigger email notifications.

**Scope**:
- Subscribe to `order.shipped` events from order service
- Validate event payload
- Retrieve additional order data if needed
- Queue email for delivery
- Handle errors and retries

**Technical Details**:
- Handler location: `/src/handlers/shipping-notification.ts`
- Use existing event bus (RabbitMQ)
- Use existing email queue (SES via queue)

**Code Structure**:
```typescript
// shipping-notification.ts
export async function handleOrderShipped(event: OrderShippedEvent): Promise<void> {
  // 1. Validate event
  // 2. Fetch order details
  // 3. Fetch user preferences (opt-out check)
  // 4. Build email payload
  // 5. Queue email
  // 6. Log for audit
}
```

**Acceptance**:
- [ ] Handler processes valid events
- [ ] Invalid events are rejected with appropriate error
- [ ] User notification preferences are respected
- [ ] Emails are queued (not sent synchronously)
- [ ] Failed events are retried up to 3 times
- [ ] Events are logged for debugging

---

### Task 3: Add Notification Preference Check

**ID**: TASK-0312-03
**Estimate**: 2 hours

**Description**:
Integrate with user preferences service to check if user has opted into shipping notifications.

**Scope**:
- Add preference check before sending
- Handle missing preferences (default to opt-in)
- Cache preferences for performance
- Log opt-out events

**Technical Details**:
- Preference key: `notifications.order.shipping`
- Default value: `true` (opt-in by default)
- Cache TTL: 5 minutes

**Code Structure**:
```typescript
async function shouldSendNotification(userId: string): Promise<boolean> {
  const prefs = await userPreferencesService.get(userId);
  return prefs?.notifications?.order?.shipping ?? true;
}
```

**Acceptance**:
- [ ] Opted-in users receive email
- [ ] Opted-out users do not receive email
- [ ] Missing preferences default to opt-in
- [ ] Preference checks are cached
- [ ] Opt-out events are logged

---

### Task 4: Write Unit Tests

**ID**: TASK-0312-04
**Estimate**: 3 hours

**Description**:
Write comprehensive unit tests for the shipping notification feature.

**Scope**:
- Test event handler logic
- Test preference checking
- Test email payload construction
- Test error scenarios
- Achieve 90%+ code coverage

**Test Cases**:
```typescript
describe('ShippingNotificationHandler', () => {
  describe('handleOrderShipped', () => {
    it('should queue email for valid shipped event');
    it('should not send email if user opted out');
    it('should include all required fields in email');
    it('should handle missing tracking number gracefully');
    it('should retry on transient failures');
    it('should not retry on validation errors');
    it('should log event processing');
  });

  describe('shouldSendNotification', () => {
    it('should return true for opted-in user');
    it('should return false for opted-out user');
    it('should return true for missing preferences');
    it('should cache preference lookups');
  });
});
```

**Acceptance**:
- [ ] All test cases pass
- [ ] Code coverage ≥ 90%
- [ ] Tests run in under 10 seconds
- [ ] No flaky tests

---

### Task 5: Write Integration Tests

**ID**: TASK-0312-05
**Estimate**: 2 hours

**Description**:
Write integration tests to verify end-to-end flow.

**Scope**:
- Test full event flow from publish to email queue
- Test with real database (test container)
- Test with mocked external services

**Test Cases**:
```typescript
describe('Shipping Notification Integration', () => {
  it('should process shipped event and queue email');
  it('should not queue email for opted-out user');
  it('should handle event bus reconnection');
  it('should handle email service unavailability');
});
```

**Acceptance**:
- [ ] Integration tests pass in CI
- [ ] Tests use isolated test data
- [ ] Tests clean up after themselves

---

### Task 6: Update Event Schema Documentation

**ID**: TASK-0312-06
**Estimate**: 1 hour

**Description**:
Document the order.shipped event schema and notification flow.

**Scope**:
- Document event payload schema
- Document notification flow diagram
- Update API documentation
- Add troubleshooting guide

**Deliverables**:
- `/docs/events/order-shipped.md`
- Sequence diagram in `/docs/architecture/`
- Update main README

**Acceptance**:
- [ ] Event schema documented with examples
- [ ] Flow diagram shows all components
- [ ] Troubleshooting section covers common issues

---

### Task 7: Configure Monitoring and Alerts

**ID**: TASK-0312-07
**Estimate**: 2 hours

**Description**:
Set up monitoring dashboards and alerts for shipping notifications.

**Scope**:
- Add metrics for notification processing
- Create Grafana dashboard
- Configure alerts for failures
- Add log queries for debugging

**Metrics to Track**:
- `shipping_notifications_sent_total`
- `shipping_notifications_failed_total`
- `shipping_notifications_opted_out_total`
- `shipping_notification_processing_duration`

**Alerts**:
- Alert if failure rate > 5% over 5 minutes
- Alert if no notifications sent in 1 hour (during business hours)
- Alert if processing duration p95 > 5 seconds

**Acceptance**:
- [ ] Dashboard shows all key metrics
- [ ] Alerts fire correctly (test in staging)
- [ ] Runbook updated with alert responses

---

## Task Summary

| Task | Description | Estimate | Dependency |
|------|-------------|----------|------------|
| TASK-01 | Email template | 3 hrs | None |
| TASK-02 | Event handler | 4 hrs | TASK-01 |
| TASK-03 | Preference check | 2 hrs | None |
| TASK-04 | Unit tests | 3 hrs | TASK-02, TASK-03 |
| TASK-05 | Integration tests | 2 hrs | TASK-02, TASK-03 |
| TASK-06 | Documentation | 1 hr | TASK-02 |
| TASK-07 | Monitoring | 2 hrs | TASK-02 |
| **Total** | | **17 hrs** | |

## Dependency Graph

```
TASK-01 (Template)
    └──► TASK-02 (Handler) ──┬──► TASK-04 (Unit Tests)
                             ├──► TASK-05 (Integration Tests)
TASK-03 (Preferences) ──────┤    TASK-06 (Documentation)
                             └──► TASK-07 (Monitoring)
```

## Definition of Done (Story)

- [ ] All tasks complete
- [ ] Email template approved by design
- [ ] Code reviewed and merged
- [ ] Unit tests passing (90%+ coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Deployed to staging
- [ ] QA verified in staging
- [ ] Product Owner accepted

## Notes

- Coordinate with Design team on template approval (TASK-01)
- Check with Platform team on event bus capacity
- Consider A/B testing different email subject lines (future story)

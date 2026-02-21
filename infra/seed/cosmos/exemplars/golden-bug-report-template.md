# Golden Bug Report Template

This document provides a template and examples for writing clear, actionable bug reports.

## Bug Report Template

```markdown
## Bug: [Brief, Descriptive Title]

### Summary
[One sentence describing the issue]

### Environment
- **Version/Build**: [e.g., v2.4.1, build 1234]
- **Browser/Device**: [e.g., Chrome 120, iPhone 14 Pro]
- **OS**: [e.g., Windows 11, iOS 17.2]
- **User Type**: [e.g., Admin, Standard User]

### Severity
[Critical / High / Medium / Low]

### Priority
[P1 / P2 / P3 / P4]

### Steps to Reproduce
1. [First step]
2. [Second step]
3. [Continue as needed]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots/Videos
[Attach or link evidence]

### Logs/Error Messages
[Include relevant logs or error messages]

### Impact
[Who is affected? How many users? Business impact?]

### Workaround
[If one exists, describe it]

### Additional Context
[Any other relevant information]
```

---

## Severity Guidelines

| Severity | Definition | Examples |
|----------|------------|----------|
| **Critical** | System unusable, data loss, security breach | App crashes on launch, payment processing fails for all users, user data exposed |
| **High** | Major feature broken, no workaround | Cannot log in, cannot save documents, checkout fails |
| **Medium** | Feature impaired, workaround exists | Filter doesn't work but search does, export fails but copy-paste works |
| **Low** | Minor issue, cosmetic defect | Typo in label, alignment off, color slightly wrong |

---

## Example 1: Critical Bug

```markdown
## Bug: Checkout Payment Processing Fails with 500 Error

### Summary
Users cannot complete checkout - all payment attempts return a server error.

### Environment
- **Version**: v3.2.0 (production)
- **Browser**: All browsers affected
- **Affected Region**: All regions
- **Started**: 2024-03-15 14:32 UTC

### Severity
Critical

### Priority
P1

### Steps to Reproduce
1. Add any item to cart
2. Proceed to checkout
3. Enter valid shipping address
4. Enter valid payment information (any card)
5. Click "Place Order"

### Expected Behavior
Order is placed, confirmation page displays, confirmation email sent.

### Actual Behavior
- Error message: "Something went wrong. Please try again."
- Server returns HTTP 500
- Order is not created
- Payment is not charged (verified)

### Screenshots
[payment-error-screenshot.png attached]

### Logs
```
ERROR 2024-03-15T14:32:15Z PaymentService.processPayment
  NullPointerException: paymentGateway is null
  at com.example.PaymentService.processPayment(PaymentService.java:142)
  at com.example.CheckoutController.placeOrder(CheckoutController.java:87)
```

### Impact
- **Severity**: All purchases blocked
- **Users Affected**: 100% of checkout attempts
- **Revenue Impact**: Estimated $50K/hour lost
- **Duration**: Ongoing since 14:32 UTC

### Workaround
None - users cannot complete purchases.

### Additional Context
- Issue started after deployment 3.2.0 at 14:30 UTC
- Suspect: Payment gateway bean not properly initialized
- Previous version 3.1.9 was working correctly
```

---

## Example 2: High Severity Bug

```markdown
## Bug: Password Reset Email Not Sent

### Summary
Users requesting password reset never receive the email, preventing account access.

### Environment
- **Version**: v3.1.5
- **Browser**: All
- **Email Providers Affected**: All tested (Gmail, Outlook, Yahoo)

### Severity
High

### Priority
P2

### Steps to Reproduce
1. Go to login page
2. Click "Forgot Password"
3. Enter registered email address
4. Click "Send Reset Link"
5. Check email (including spam folder)
6. Wait 30 minutes

### Expected Behavior
- User receives password reset email within 5 minutes
- Email contains valid reset link

### Actual Behavior
- Success message displayed: "Check your email for reset instructions"
- No email received after 30 minutes
- No email in spam folder
- Reset link never arrives

### Screenshots
[forgot-password-success.png] - Shows misleading success message

### Logs
```
WARN 2024-03-15T10:15:22Z EmailService.sendEmail
  Connection refused: smtp.example.com:587
  Retrying in 30 seconds...
ERROR 2024-03-15T10:16:22Z EmailService.sendEmail
  Max retries exceeded. Email not sent.
  Recipient: user@example.com
  Template: password-reset
```

### Impact
- **Users Affected**: ~50 requests/day
- **Support Tickets**: 12 tickets opened today
- **User Impact**: Cannot access accounts

### Workaround
Users can contact support for manual password reset (manual process, 24hr delay).

### Additional Context
- SMTP server credentials may have expired
- Similar issue occurred 3 months ago (BUG-1234)
```

---

## Example 3: Medium Severity Bug

```markdown
## Bug: Date Filter Shows Wrong Results for Timezone

### Summary
Date filter returns incorrect results for users in non-UTC timezones.

### Environment
- **Version**: v3.1.5
- **Browser**: Chrome 120
- **Timezone**: PST (UTC-8)

### Severity
Medium

### Priority
P3

### Steps to Reproduce
1. Set browser timezone to PST (UTC-8)
2. Create a record dated "March 15, 2024"
3. Go to list view
4. Apply date filter: "March 15, 2024"
5. Observe results

### Expected Behavior
Record created on March 15 appears in filtered results.

### Actual Behavior
- Record does NOT appear in filtered results
- Record appears when filtering by "March 14, 2024"
- Off by one day due to timezone handling

### Screenshots
[date-filter-bug.png] - Shows record with March 15 date missing from March 15 filter

### Impact
- **Users Affected**: Users in timezones UTC-1 through UTC-12
- **Data Impact**: No data loss, just display/filter issue
- **User Experience**: Confusing, causes support inquiries

### Workaround
- Users can manually adjust filter date by 1 day
- Users can switch to UTC timezone in settings

### Additional Context
- Likely issue: Server converts dates to UTC but filter compares to user local date
- Related to BUG-2345 (timezone issues in reports)
```

---

## Example 4: Low Severity Bug

```markdown
## Bug: Typo in Settings Page Header

### Summary
"Notifcation Settings" misspelled in page header.

### Environment
- **Version**: v3.1.5
- **Location**: Settings > Notifications page

### Severity
Low

### Priority
P4

### Steps to Reproduce
1. Log in to application
2. Go to Settings
3. Click "Notifications"
4. Observe page header

### Expected Behavior
Header text: "Notification Settings"

### Actual Behavior
Header text: "Notifcation Settings" (missing 'i')

### Screenshots
[typo-screenshot.png]

### Impact
- **Users Affected**: All users who view settings
- **Business Impact**: Minor - looks unprofessional
- **User Experience**: Cosmetic only

### Workaround
N/A - cosmetic issue

### Additional Context
- File location: /src/components/Settings/NotificationSettings.tsx, line 42
```

---

## Bug Triage Guidelines

### Information Checklist

Before submitting, verify:
- [ ] Clear, descriptive title
- [ ] Reproducible steps (tested at least twice)
- [ ] Expected vs actual behavior clear
- [ ] Environment details complete
- [ ] Screenshots/logs attached
- [ ] Severity and impact assessed
- [ ] Checked for duplicates

### Common Mistakes to Avoid

| Mistake | Example | Better |
|---------|---------|--------|
| Vague title | "Login broken" | "Login fails with 'Invalid credentials' for valid users" |
| Missing steps | "Go to checkout, error appears" | Numbered steps from start to finish |
| No environment | "Doesn't work" | Browser, version, OS, user type |
| No evidence | "I saw an error" | Screenshot of error message |
| Assumed cause | "Bug in the API" | "Error appears when clicking submit" |

### Severity vs Priority

| | Severity | Priority |
|-|----------|----------|
| **Definition** | Impact of the bug | Order of fixing |
| **Who decides** | QA/Technical team | Product Owner |
| **Based on** | Technical impact | Business value |
| **Example** | Critical crash | May be P2 if workaround exists |

---

## Investigation Template

When assigned a bug, use this template:

```markdown
## Investigation Notes: [BUG-ID]

### Reproduced?
[ ] Yes / [ ] No / [ ] Intermittent

### Root Cause
[Description of what's causing the issue]

### Affected Code
- File: [path/to/file.ts]
- Line: [line number]
- Function: [function name]

### Fix Approach
[Brief description of planned fix]

### Testing Plan
- [ ] Unit test to prevent regression
- [ ] Reproduce in staging
- [ ] Verify fix
- [ ] Regression test related features

### Risk Assessment
[Any risks with the fix]
```

## Related Documents

- Definition of Done
- Acceptance Criteria Standards
- Estimation Techniques Playbook

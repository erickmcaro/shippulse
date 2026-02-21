# Definition of Done (DoD)

A shared agreement that defines when work is complete and potentially releasable.

## Purpose

The Definition of Done ensures that:
- Quality is consistent across all work
- Work is truly complete, not just "code complete"
- Technical debt doesn't accumulate silently
- Everyone agrees on what "done" means
- Work can be released with confidence

## Standard Definition of Done

A Product Backlog Item is done when:

### Code Quality
- [ ] Code is written and compiles without errors
- [ ] Code follows team coding standards
- [ ] Code is reviewed by at least one other developer
- [ ] No new static analysis warnings introduced
- [ ] Code complexity is within acceptable limits

### Testing
- [ ] Unit tests written and passing (minimum 80% coverage for new code)
- [ ] Integration tests written and passing
- [ ] All existing tests still pass
- [ ] Manual testing completed per acceptance criteria
- [ ] Edge cases and error conditions tested

### Documentation
- [ ] Code is self-documenting with clear naming
- [ ] Complex logic has inline comments
- [ ] API documentation updated (if applicable)
- [ ] User-facing documentation updated (if applicable)
- [ ] README updated for setup changes

### Deployment
- [ ] Code is merged to main/development branch
- [ ] Feature is deployable to production
- [ ] Database migrations are reversible
- [ ] Configuration changes documented
- [ ] Feature flags configured (if applicable)

### Acceptance
- [ ] All acceptance criteria met and verified
- [ ] Product Owner has reviewed and accepted
- [ ] No critical or high-severity bugs remaining
- [ ] Performance is acceptable (no regressions)

## DoD by Work Type

### User Stories

| Category | Criteria |
|----------|----------|
| **Code** | Written, reviewed, merged |
| **Tests** | Unit (80%+), integration, acceptance |
| **Quality** | No new warnings, passes security scan |
| **Docs** | API docs, help content if user-facing |
| **Deploy** | Deployable, feature flag ready |
| **Accept** | AC met, PO approved |

### Bugs

| Category | Criteria |
|----------|----------|
| **Fix** | Root cause addressed (not just symptoms) |
| **Tests** | Regression test added |
| **Verify** | Original issue no longer reproduces |
| **Regression** | No new bugs introduced |
| **Close** | Bug ticket updated and closed |

### Technical Debt

| Category | Criteria |
|----------|----------|
| **Refactor** | Code improved without behavior change |
| **Tests** | Existing tests still pass |
| **Performance** | No performance regression |
| **Docs** | Architecture docs updated if needed |
| **Review** | Tech lead approved approach |

### Spikes

| Category | Criteria |
|----------|----------|
| **Questions** | All research questions answered |
| **Document** | Findings documented in wiki/ticket |
| **Recommend** | Clear recommendation provided |
| **Follow-up** | New stories created if needed |
| **Time-box** | Completed within allocated time |

## DoD Checklist Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│  │  Code    │──►│  Test    │──►│  Review  │──►│  Merge   │       │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘       │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                         DoD VERIFICATION                          │
│                                                                   │
│  [ ] Code compiles, no errors                                     │
│  [ ] All tests pass                                               │
│  [ ] Code reviewed                                                │
│  [ ] Docs updated                                                 │
│  [ ] AC verified                                                  │
│  [ ] PO accepted                                                  │
│                                                                   │
│  ┌─────────────────────────────┐                                  │
│  │  All checked? ──► ✓ DONE   │                                  │
│  │  Missing items? ──► Return │                                  │
│  └─────────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────┘
```

## DoD Levels

### Story-Level DoD

Applied to each individual PBI:
- Code complete and tested
- Reviewed and merged
- AC verified
- PO accepted

### Sprint-Level DoD

Applied at the end of each sprint:
- All done stories integrated
- Sprint increment is shippable
- No integration issues
- Demo-ready

### Release-Level DoD

Applied before production release:
- All sprint DoDs met
- Performance testing passed
- Security scan passed
- Release notes complete
- Rollback plan documented
- Stakeholders notified

## Quality Gates

### Automated Gates

Configure CI/CD to enforce:

```yaml
# Example CI Pipeline Gates
quality_gates:
  - name: Build
    check: compilation_successful

  - name: Unit Tests
    check: all_tests_pass
    coverage_threshold: 80%

  - name: Static Analysis
    check: no_critical_issues
    tools: [eslint, sonarqube]

  - name: Security Scan
    check: no_high_vulnerabilities
    tools: [snyk, dependabot]

  - name: Code Review
    check: min_approvals >= 1
```

### Manual Gates

Require human verification:

| Gate | Who | When |
|------|-----|------|
| Code Review | Peer developer | Before merge |
| AC Verification | Developer + QA | After development |
| PO Acceptance | Product Owner | Before story closes |
| Release Approval | Tech Lead/Manager | Before production |

## Common DoD Failures

| Failure | Consequence | Prevention |
|---------|-------------|------------|
| "Done" without tests | Bugs escape to production | Enforce coverage gate |
| Skipped code review | Quality issues, knowledge silos | Require PR approval |
| Missing documentation | Knowledge lost, onboarding slow | Include in checklist |
| AC not verified | Features don't match expectations | PO reviews all stories |
| Technical debt ignored | Velocity degrades over time | Include in DoD |

## Undone Work

### What is Undone Work?

Work marked "done" that doesn't meet the full DoD:
- Code complete but untested
- Tested but not documented
- Developed but not reviewed

### Tracking Undone Work

If DoD isn't fully met, track explicitly:

| Story | DoD Gap | Risk | Plan to Address |
|-------|---------|------|-----------------|
| US-123 | Missing integration test | Medium | Add in next sprint |
| US-124 | Docs not updated | Low | Complete before release |

### Undone Work Policy

- Undone work is technical debt
- Track and make visible
- Plan time to complete
- Don't let it accumulate

## DoD Evolution

### Signs Your DoD Needs Updating

- Bugs frequently escape to production
- "Done" items need rework
- New quality concerns emerge
- Team maturity increases
- Tools and processes change

### Evolution Process

1. Discuss gaps in retrospective
2. Propose additions/changes
3. Get team consensus
4. Document updated DoD
5. Communicate to stakeholders

### Sample Evolution Path

**Starter DoD** (new team):
```
- Code compiles
- Basic tests pass
- PO reviewed
```

**Intermediate DoD** (6 months):
```
- Code compiles and reviewed
- Unit tests (60% coverage)
- Integration tests pass
- Documentation updated
- PO accepted
```

**Mature DoD** (1+ year):
```
- Code compiles, reviewed, follows standards
- Unit tests (80%+ coverage)
- Integration and E2E tests pass
- Security scan passed
- Performance tested
- API documentation updated
- Accessibility verified
- Feature flag configured
- PO accepted
- Deployable to production
```

## Templates

### DoD Checklist Card

```
═══════════════════════════════════════════════
DEFINITION OF DONE CHECKLIST
═══════════════════════════════════════════════
Item: ________________________________________

CODE
[ ] Compiles without errors
[ ] Follows coding standards
[ ] Peer reviewed and approved
[ ] No new static analysis warnings

TESTING
[ ] Unit tests written (80%+ coverage)
[ ] Integration tests pass
[ ] All existing tests pass
[ ] Manual AC verification

DOCUMENTATION
[ ] Code is self-documenting
[ ] API docs updated (if applicable)
[ ] User docs updated (if applicable)

DEPLOYMENT
[ ] Merged to main branch
[ ] Deployable to production
[ ] Feature flags configured

ACCEPTANCE
[ ] All acceptance criteria met
[ ] Product Owner accepted
[ ] No open critical bugs

═══════════════════════════════════════════════
DONE: [ ] Yes  [ ] No

If No, what's remaining:
______________________________________________
______________________________________________

Verified by: ______________ Date: ____________
═══════════════════════════════════════════════
```

### DoD Poster (Team Room)

```
╔═══════════════════════════════════════════════════════════╗
║                   DEFINITION OF DONE                       ║
║                                                            ║
║  ✓ Code written, compiles, follows standards              ║
║  ✓ Code reviewed by peer                                   ║
║  ✓ Unit tests written (80%+ coverage)                      ║
║  ✓ All tests pass (unit, integration, E2E)                ║
║  ✓ No critical static analysis issues                      ║
║  ✓ Documentation updated                                   ║
║  ✓ Merged to main branch                                   ║
║  ✓ All acceptance criteria verified                        ║
║  ✓ Product Owner accepted                                  ║
║                                                            ║
║  If it's not DONE, it's not done.                         ║
╚═══════════════════════════════════════════════════════════╝
```

## Related Definitions

- Definition of Ready
- Acceptance Criteria Standards
- Code Review Guidelines

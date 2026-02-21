# Golden Spike Template

This document provides templates and examples for writing effective spike (research) stories.

## Spike Template

```markdown
## Spike: [Brief, Descriptive Title]

### Objective
[What question(s) are we trying to answer?]

### Background
[Why is this research needed? What decision depends on it?]

### Time-Box
[Maximum time to spend: X hours/days]

### Questions to Answer
1. [Specific question 1]
2. [Specific question 2]
3. [Continue as needed]

### Success Criteria
[How will we know the spike is complete?]
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Research Approach
[How will you investigate?]
- [ ] [Method 1]
- [ ] [Method 2]

### Expected Output
- [ ] [Deliverable 1: e.g., Document, POC, Recommendation]
- [ ] [Deliverable 2]

### Follow-up Actions
[What might happen after the spike?]
- If result A: [Action]
- If result B: [Action]
```

---

## Example 1: Technology Evaluation Spike

```markdown
## Spike: Evaluate PDF Generation Libraries for Report Export

### Objective
Determine the best PDF generation library for exporting user reports, considering features, performance, and licensing.

### Background
Users have requested the ability to export their dashboard reports as PDF files. We need to select a library before implementing the feature (PBI-2024-0456).

### Time-Box
2 days (16 hours)

### Questions to Answer
1. Which PDF libraries support our requirements (tables, charts, images)?
2. What are the performance characteristics with large reports (100+ pages)?
3. What are the licensing implications for each option?
4. How easy is integration with our Node.js backend?
5. What is the file size output for typical reports?

### Success Criteria
- [ ] At least 3 libraries evaluated
- [ ] Prototype generated for top 2 candidates
- [ ] Performance benchmarks documented
- [ ] Clear recommendation with rationale

### Research Approach
- [ ] Review documentation for candidate libraries
- [ ] Create prototype with sample report
- [ ] Benchmark: Generate 10-page, 50-page, 100-page reports
- [ ] Measure: Generation time, memory usage, file size
- [ ] Evaluate: API ease of use, documentation quality

### Libraries to Evaluate
1. PDFKit (https://pdfkit.org/)
2. Puppeteer/Chrome Headless (HTML to PDF)
3. jsPDF (client-side option)
4. pdfmake (declarative approach)
5. react-pdf (if React-based generation)

### Expected Output
- [ ] Comparison matrix document
- [ ] Working prototype for recommended library
- [ ] Performance benchmark results
- [ ] Architecture recommendation

### Follow-up Actions
- If clear winner: Create implementation stories for report export feature
- If no clear winner: Second spike to deep-dive top 2 candidates
- If all unsuitable: Explore alternative approaches (e.g., server-side rendering)

### Deliverable Template

## PDF Library Evaluation Results

### Summary
[Recommendation and rationale in 2-3 sentences]

### Comparison Matrix

| Criteria | PDFKit | Puppeteer | jsPDF | pdfmake |
|----------|--------|-----------|-------|---------|
| Table support | | | | |
| Chart support | | | | |
| Image support | | | | |
| Performance (100pg) | | | | |
| File size | | | | |
| License | | | | |
| Documentation | | | | |
| **Score** | /10 | /10 | /10 | /10 |

### Recommendation
[Detailed recommendation with justification]

### Next Steps
- [ ] [Story 1]
- [ ] [Story 2]
```

---

## Example 2: Architecture Decision Spike

```markdown
## Spike: Evaluate State Management Solutions for React App

### Objective
Determine the best state management approach for our growing React application.

### Background
Our app has grown to 50+ components with complex shared state. Local state and prop drilling are becoming unmanageable. We need a scalable solution.

### Time-Box
3 days (24 hours)

### Questions to Answer
1. Which state management solution best fits our team's expertise?
2. How does each option handle async operations (API calls)?
3. What is the learning curve for our team (familiar with hooks)?
4. How does each option integrate with our testing strategy?
5. What are the bundle size implications?

### Success Criteria
- [ ] Team workshop conducted to gather requirements
- [ ] At least 3 solutions prototyped with same feature
- [ ] Developer experience documented for each
- [ ] Clear recommendation approved by tech lead

### Research Approach
- [ ] Workshop: Identify current pain points (2 hours)
- [ ] Research: Read docs and tutorials for candidates (4 hours)
- [ ] Prototype: Build shopping cart feature in each (12 hours)
- [ ] Compare: Document DX, code complexity, testing (4 hours)
- [ ] Present: Demo to team, gather feedback (2 hours)

### Solutions to Evaluate
1. Redux Toolkit (industry standard, complex)
2. Zustand (minimal, hook-based)
3. Jotai (atomic, bottom-up)
4. React Query + Context (server state focus)

### Expected Output
- [ ] Prototype branch for each solution
- [ ] ADR (Architecture Decision Record) document
- [ ] Team presentation and decision

### Follow-up Actions
- Create migration plan stories
- Update coding standards documentation
- Schedule team training session
```

---

## Example 3: Integration Feasibility Spike

```markdown
## Spike: Evaluate Feasibility of Salesforce CRM Integration

### Objective
Determine if and how we can integrate with customer's existing Salesforce instance for bi-directional sync.

### Background
Enterprise customer requires our app to sync contacts and deals with their Salesforce CRM. Need to understand technical feasibility and effort before committing.

### Time-Box
2 days (16 hours)

### Questions to Answer
1. What Salesforce APIs are available for our use case?
2. What authentication method is required (OAuth, API key)?
3. What are the rate limits and how do they affect our sync requirements?
4. What data mapping is needed between our entities and Salesforce objects?
5. What is the estimated development effort?

### Success Criteria
- [ ] API access obtained to sandbox environment
- [ ] Successfully read contacts from Salesforce
- [ ] Successfully create a contact in Salesforce
- [ ] Data mapping documented
- [ ] Effort estimate for full integration

### Research Approach
- [ ] Obtain Salesforce sandbox credentials (request from customer)
- [ ] Review Salesforce REST API documentation
- [ ] Test authentication flow
- [ ] Test read operations (contacts, deals)
- [ ] Test write operations (create contact)
- [ ] Document data model differences

### Expected Output
- [ ] Technical feasibility report (YES/NO/CONDITIONAL)
- [ ] High-level architecture diagram
- [ ] Data mapping document
- [ ] Rough effort estimate (T-shirt size)
- [ ] List of risks and unknowns

### Follow-up Actions
- If feasible (simple): Create epic with implementation stories
- If feasible (complex): Create detailed technical design, then epic
- If not feasible: Document blockers, discuss alternatives with customer
```

---

## Example 4: Performance Investigation Spike

```markdown
## Spike: Investigate Dashboard Load Time Performance

### Objective
Identify root causes of slow dashboard load times and recommend optimizations.

### Background
Customer complaints indicate dashboard takes 8-12 seconds to load. Target is under 3 seconds. Need to identify bottlenecks before optimizing.

### Time-Box
1 day (8 hours)

### Questions to Answer
1. Where is time being spent (network, rendering, data processing)?
2. Which API calls are the slowest?
3. Are there unnecessary API calls or data fetches?
4. What is the current bundle size and can it be reduced?
5. What quick wins can improve performance immediately?

### Success Criteria
- [ ] Performance profile captured (Chrome DevTools)
- [ ] API response times documented
- [ ] Top 3 bottlenecks identified
- [ ] Quick win recommendations provided
- [ ] Long-term optimization roadmap drafted

### Research Approach
- [ ] Set up performance monitoring (Lighthouse, WebPageTest)
- [ ] Profile dashboard load with Chrome DevTools
- [ ] Analyze network waterfall
- [ ] Review API endpoints called on load
- [ ] Analyze React component render times
- [ ] Review bundle size with webpack-bundle-analyzer

### Expected Output
- [ ] Performance analysis report
- [ ] Identified bottlenecks with evidence
- [ ] Prioritized list of optimization opportunities
- [ ] Estimated impact of each optimization

### Measurement Baseline

| Metric | Current | Target |
|--------|---------|--------|
| Total Load Time | ? | < 3s |
| First Contentful Paint | ? | < 1.5s |
| Time to Interactive | ? | < 3s |
| Bundle Size | ? | < 500KB |
| API Calls Count | ? | Minimize |

### Follow-up Actions
- Create optimization stories for each identified issue
- Establish performance budget and monitoring
- Schedule performance review in 1 month
```

---

## Spike Anti-Patterns

### What NOT to Do

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Open-ended research | Never finishes | Strict time-box + specific questions |
| No questions defined | Wandering investigation | List 3-5 specific questions upfront |
| No deliverable | Knowledge lost | Require document/prototype output |
| Too long | Delayed decisions | Max 3-5 days, split if larger |
| Building full solution | Spike becomes epic | Prototype only, stop at proof |
| No follow-up | Research wasted | Define next actions in advance |

---

## Spike Checklist

Before starting:
- [ ] Time-box defined and agreed
- [ ] Specific questions documented
- [ ] Success criteria clear
- [ ] Expected output defined
- [ ] Follow-up actions outlined

During spike:
- [ ] Track time spent
- [ ] Document findings as you go
- [ ] Note unexpected discoveries
- [ ] Stop at time-box even if incomplete

After spike:
- [ ] Complete deliverable document
- [ ] Present findings to team
- [ ] Create follow-up stories/actions
- [ ] Archive research for future reference

## Related Documents

- Story Point Guidelines (spike estimation)
- Definition of Ready (spikes complete requirements investigation)
- Epic Decomposition Playbook

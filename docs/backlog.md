# Projects UI Backlog

**Last updated:** 2026-09-27. Built by checking `docs/plan.md` against the code. Each item names its source. Items marked **In progress (plan budgets-planning-projects-bi-2026-09-27)** are being built now under `.claude/plans/budgets-planning-projects-bi-2026-09-27.md`; do not start them separately. Backend gaps live in `projects-service/projects-api/docs/backlog.md`.

## Fixes

All In progress (plan budgets-planning-projects-bi-2026-09-27, Phase 0):

- Tender metrics cards read the wrong shape: Awarded and Evaluating show 0 and Est. Value shows "NaNK". Source: budgets plan audit.
- List pages send `page_size`, but the API reads `limit`. Source: budgets plan audit.
- Drop the dual project summary field names. Source: budgets plan audit.

## Project finance

All In progress (plan budgets-planning-projects-bi-2026-09-27, Phase 6). The Financials tab and the portfolio dashboard gate on the existing projects feature code `budget_tracking` (T3), decided 2026-09-27.

- Project Financials tab: CPI, SPI, EAC and VAC cards, S-curve of PV, EV and AC, cost breakdown, committed vs actual, budget edit through the proxy. Source: budgets plan.
- Task estimate and progress fields. Source: budgets plan.
- Portfolio dashboard with RAG health. Source: budgets plan.
- Tender pipeline view. Source: budgets plan.
- Add recharts (same version as treasury-ui). Source: budgets plan.

## Tasks and collaboration

- Task detail view with comments and attachments (hook exists, no page). Source: plan.md Sprint 2.
- Activity feed on project and task pages. Source: plan.md Sprint 3.
- Project status reports. Source: plan.md Sprint 3.
- Time tracking view, fed by ERP timesheet hours. Source: plan.md Sprint 3.

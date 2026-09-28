# Projects UI Backlog

**Last updated:** 2026-09-28. Built by checking `docs/plan.md` against the code. Each item names its source. Backend gaps live in `projects-service/projects-api/docs/backlog.md`.

## Done

Kept for one release so reviewers can see what moved; delete on the next pass.

- Fixes (budgets plan Phase 0): tender metrics read `by_status`, list pages send `limit`, one project summary shape.
- Project finance (budgets plan Phase 6): Financials tab (CPI, SPI, EAC, VAC, S-curve, cost breakdown, committed vs actual, hours logged), task estimate and progress fields, portfolio with RAG health, tender pipeline panel on the Tenders page (stage counts and values, open pipeline value, win rate), recharts.
- Tasks and collaboration (plan.md Sprints 2 and 3): task detail view with comments, attachments and dependencies; activity feed on project and task pages; project discussion and files on the overview; project status report page; Time page fed by ERP timesheet hours.

## Open

- Attachments are links (the user pastes a URL to the file in their drive or document store). Direct upload needs a storage service; none exists in the platform yet. Source: plan.md Sprint 2.
- Comments and activity show user ids ("User 1a2b3c4d") for everyone but the signed-in user. Needs a user directory lookup (auth-api) to show names. Source: task detail review 2026-09-28.
- The activity feed polls every 30 seconds. Switch to push when projects-api ships WebSocket updates (projects-api backlog, Planning and collaboration). Source: plan.md Sprint 3.
- Status report task lists read the first 100 tasks (the API page cap). A server-side report endpoint would lift this for large projects. Source: status report review 2026-09-28.
- @mentions in comments, once projects-api supports them. Source: projects-api backlog.

# Projects UI Backlog

**Last updated:** 2026-11-16. Built by checking `docs/plan.md` against the code. Each item names its source. Backend gaps live in `projects-service/projects-api/docs/backlog.md`. Build order: `.claude/plans/projects-service-competitive-revamp-2026-11-16.md`.

## Foundation, sprint 0b (2026-11-16 audit)

- The root page redirects to itself.
- No phone navigation: the sidebar is a fixed 256 px, with no drawer and no bottom nav.
- Tailwind 3 does not scan shared-ui-lib, so shared components can render unstyled. Move to Tailwind 4 with `@source`, like the other apps.
- Hand-built tables on the tasks, team, Gantt and portfolio pages; native selects across tasks, team, tenders, committees, portfolio and QA; a hand-made search box in the QA feature picker; local money formatting in `lib/utils.ts` and `toLocaleString` calls.
- The header uses `bg-white` instead of theme tokens; form grids are fixed at two columns; the board does not scroll sideways on phones.
- `packageManager` says pnpm 9 while the Dockerfile installs pnpm 10; the Radix packages are on `latest`.

## Project finance

Done 2026-09-29 (plan budgets-planning-projects-bi-2026-09-27). The Financials tab and the portfolio dashboard gate on `budget_tracking`. The two older fixes (tender metrics shape and the `page_size` param) shipped with it.

- Project Financials tab: CPI, SPI, EAC and VAC cards, S-curve of PV, EV and AC, cost breakdown, committed vs actual, budget edit through the proxy. Source: budgets plan.
- Task estimate and progress fields. Source: budgets plan.
- Portfolio dashboard with RAG health. Source: budgets plan.
- Tender pipeline view. Source: budgets plan.
- Add recharts (same version as treasury-ui). Source: budgets plan.

## QA and acceptance

Screens built 13 November 2026 (see plan.md, "QA and acceptance"). Still open, each waiting on its backend or shared piece:

- Signing with the stored profile signature, and uploading a signed scan. Waits on auth-api signatures with consent, projects-api `qa_signatures` and shared-ui-lib `SignaturePad`. Today a signer prints and signs the report. Source: QA plan sections 5 and 6.
- Evidence upload on a verdict. Waits on the shared upload field and the projects-api evidence route (`evidence_keys` exists, no route yet). Source: QA plan section 7.
- Results history view (`GET results?history=true` is wired in the API client, no screen yet). Source: QA plan section 3.
- Live board updates. The board refreshes on focus and by hand; projects-api has no event stream for QA yet. Source: webhooks over polling rule.
- Template version diff and a criteria reorder by drag. Source: QA plan section 2.

## Tasks and collaboration

- Task detail view with comments and attachments (hook exists, no page). Source: plan.md Sprint 2. Now sprint 12 (task drawer).
- Activity feed on project and task pages. Source: plan.md Sprint 3. Now sprint 12, once the API writes activity (0b).
- Board drag and drop, list and calendar views, Gantt chart, My Work, live updates. Source: Find, Flip, Fix 2026-11-16. Sprint 12.
- Time tracking: timer and week timesheet, posting to ERP. Source: plan.md Sprint 3. Now sprint 13.
- Client portal. Sprint 14.
- Billing and profitability screens. Sprint 15.
- Workload, baselines, risks, change requests, templates, status rules. Sprint 16.
- Project status reports. Source: plan.md Sprint 3. API sprint 7.

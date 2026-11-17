# Projects UI Backlog

**Last updated:** 2026-11-16. Built by checking `docs/plan.md` against the code. Each item names its source. Backend gaps live in `projects-service/projects-api/docs/backlog.md`. Build order: `.claude/plans/projects-service-competitive-revamp-2026-11-16.md`.

## Foundation, sprint 0b (2026-11-16 audit)

- The root page redirects to itself.
- No phone navigation: the sidebar is a fixed 256 px, with no drawer and no bottom nav.
- Tailwind 3 does not scan shared-ui-lib, so shared components can render unstyled. Move to Tailwind 4 with `@source`, like the other apps.
- Hand-built tables on the tasks, team, Gantt and portfolio pages; native selects across tasks, team, tenders, committees, portfolio and QA; a hand-made search box in the QA feature picker; local money formatting in `lib/utils.ts` and `toLocaleString` calls.
- The header uses `bg-white` instead of theme tokens; form grids are fixed at two columns; the board does not scroll sideways on phones.
- `packageManager` says pnpm 9 while the Dockerfile installs pnpm 10; the Radix packages are on `latest`.

### Access and API contract (built 2026-11-16, see plan.md Sprint 0b)

Done: the service auth/me profile with the 404 fallback, the permission registry and its node tests, nav, page guards and buttons on service codes, the 403 split (unauthorized page, permission toast, upgrade toast), the project not-found state, paged tasks, the new task detail and Gantt shapes, Settings, Roles and access, tenant branding by slug and the step 8 sign out. Still open:

- Adding a person to the organisation from Roles and access (`POST /users`). I left it out until I decide how it sits beside the accounts site invite; today the page links to the accounts site.
- Adding a team member and committees still take a raw user id. They should pick people from `GET /rbac/users` with the shared SearchableCombobox. The team list itself now shows names.
- The tenders list loads one page of 20; it needs Show more like tasks.

## Security

- On 2026-11-16 GitHub reported 15 Dependabot alerts on the default branch: 2 critical, 6 high and 7 moderate. I review and upgrade them in the sprint 11 security pass, alongside a dependency audit.

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

Sprint 12 screens built 2026-11-16 (see plan.md, "Sprint 12"): task drawer, several assignees, board with drag and drop and column editor, list with saved filters, calendar, Gantt chart with the critical path, My Work, live updates, offline status, comment and checklist edits, file uploads. Still open:

- Verified 2026-11-17: type check, lint, 57 node tests, build and the full Playwright run (100 tests, phone and desktop) cover sprints 0b, 12, 13 and 14.
- Mention picker in comments: done 2026-11-17 with shared-ui-lib v0.1.147 (the RichTextEditor `mentions` prop); the comment box offers the project's members.
- Task files on the files page show their task's title only when that task is already cached; otherwise they read "A task" (still linked). A `task_title` on the attachment list from projects-api would fix it in one batched read.
- The calendar still picks agenda or grid after hydration (the same `useMediaQuery` answer the Gantt page used to flash on). It could take the Gantt page's CSS approach if anyone notices.
- Project activity feed on the project page. Source: plan.md Sprint 3.
- Time tracking: built 2026-11-17 (plan.md, "Sprint 13"). Still open:
  - Done 2026-11-17: the person picker searches the tenant through `GET /time/people` on the server, and the stop sends an `Idempotency-Key` built from the run (task and start time), so two devices stopping the same run log it once.
  - The add row picker loads 100 projects and their tasks 100 at a time, with no server search on tasks.
  - Done 2026-11-17: the timer is on the list rows, the calendar's agenda rows and the My Work rows too (the month and week grid chips stay drag targets only).
- Client portal: built 2026-11-17 (plan.md, "Sprint 14"). Still open:
  - Done 2026-11-17 with projects-api: the `X-Client-Invites` CORS header, the contact lookup for `portal.manage`, `last_decision` on the team's milestones, `author_kind` on thread entries and `progress` on the portal list (plan.md, "API follow-ups wired in").
  - Fixed 2026-11-17: a revoked client's older thread entries kept carrying the Team tag. projects-api now stores the author kind on each comment when it is posted, so the Client tag stays.
  - Done 2026-11-17 (sprint 15): the portal's Invoices tab lists the sent and paid invoices with a "View and pay" link to treasury's public page.
  - Ready for review lives on the milestones page, which needs `milestone_billing`; a firm without it cannot send milestones for review from the UI yet.
- Billing and profitability screens: released 2026-11-17 (plan.md, "Sprint 15"; projects-ui `3ed4ba7`, Playwright 115 passed). Still open:
  - VAT is per project (`tax_code` on the contract card) and empty by default, which invoices with no VAT. I could default it from a tenant setting once treasury exposes the tenant's VAT registration over S2S.
  - The Billing tab shows the latest invoices only, with a link to the full list in treasury; there is no paging on the tab.
  - Retainer hours used against the allowance (and what rolls over) are not shown yet. projects-api does not send them.
  - The client rollup on the portfolio is not paged and cannot open a client's projects; a client filter on the By project view would do it.
  - The hourly rate is now set on the contract card, but there is no rate per person or per role.
  - Voiding or sending an invoice is done in treasury; the tab links there and refreshes on its next load.
- Workload, baselines, risks, change requests, templates, recurring tasks, status rules and automations: screens built 2026-11-17 (plan.md, "Sprint 16"), not yet through the type check, lint, build and Playwright batch. Still open:
  - The approvals queue and the Changes tab show the latest 100 requests with no paging, and the queue names projects from the first 100 projects the approver can see.
  - The risk register loads 500 risks in one page (the API holds up to 1000); the heat map filter runs over that page.
  - A change request's date shifts name their tasks only when those tasks are cached; from the approvals page they can read "Task" and a short id. A `task_title` on each shift from projects-api would fix it.
  - The task picker for date shifts lists the project's tasks 100 at a time with Load more and no server search.
  - The cost change uses the project's own budget when financials report one (needs `budget_tracking` and `financials.view`); there is no picker over other draft budgets in treasury, since projects-api has no budget list route.
  - Automations set priority to low, medium, high or urgent (the API's list), while tasks use low, medium, high or critical; one of the two lists should change.
  - A queued offline status move that the rules refuse on replay is not explained to the user yet.
  - Editing a pending change request (PUT) has no screen; withdraw and raise a new one instead.
  - Required fields can only be set per target status from any status; a rule limited to one source status shows only through the API.
  - The workload capacity has no ERP read yet (projects-api decision), and public holidays are not counted.
- Fixed 2026-11-17: `pnpm dev` served on 3005 while every frontend's SSO dev redirect (auth-api seed) is `http://localhost:3000`, so a local sign-in could not return. Dev now runs on 3000; `pnpm start` (Playwright's server) stays on 3005.
- Project status reports. Source: plan.md Sprint 3. API sprint 7.

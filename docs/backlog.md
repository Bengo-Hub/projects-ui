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

- Waiting on the main session: type check, lint, `pnpm test`, build and Playwright for these changes, including the new `e2e/access.spec.ts`.
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

- Waiting on the main session: `pnpm install` for `@dnd-kit/core` 6.3.1, type check, lint, `pnpm test` (`node-tests/work.test.ts`), build and Playwright (`e2e/work.spec.ts`).
- Mention picker in comments. shared-ui-lib's RichTextEditor takes no extensions and has no Tiptap Mention, so I cannot type a mention yet. Mentions the API stores already show as chips. Needs a shared-ui-lib tag with an optional `mentions` prop (suggestion list of `{id, label}`, rendering `span[data-type="mention"][data-id][data-label]`); then the drawer passes the project members.
- Waiting on the main session for the 2026-11-17 gap fixes (plan.md, "Gaps closed"): type check, lint, `pnpm test` and Playwright, including the new phone long press spec, which runs on the Chromium phone project only.
- Task files on the files page show their task's title only when that task is already cached; otherwise they read "A task" (still linked). A `task_title` on the attachment list from projects-api would fix it in one batched read.
- The calendar still picks agenda or grid after hydration (the same `useMediaQuery` answer the Gantt page used to flash on). It could take the Gantt page's CSS approach if anyone notices.
- Project activity feed on the project page. Source: plan.md Sprint 3.
- Time tracking: timer and week timesheet, posting to ERP. Source: plan.md Sprint 3. Now sprint 13.
- Client portal. Sprint 14.
- Billing and profitability screens. Sprint 15.
- Workload, baselines, risks, change requests, templates, status rules. Sprint 16.
- Project status reports. Source: plan.md Sprint 3. API sprint 7.

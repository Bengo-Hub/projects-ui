# Projects UI - Implementation Plan

## Executive Summary

**System Purpose**: A collaborative project management and task tracking portal for the Codevertex ecosystem. It helps teams manage internal projects, client engagements, and cross-service initiatives.

**Key Capabilities**:
- **Project Tracking**: Manage project lifecycles, milestones, and deliverables.
- **Task Management**: Kanban boards, lists, and Gantt charts for task orchestration.
- **Collaboration**: Real-time comments, file sharing, and team notifications.
- **Resource Allocation**: Track team availability and workload.
- **Time Tracking**: Log time against projects and tasks for billing and analytics.

---

## Technology Stack

### Frontend Framework
- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **State Management**: Zustand (Global State) + TanStack Query (Server State)
- **API Client**: Axios with interceptors for auth handling.
- **PWA**: `@ducanh2912/next-pwa` for service worker and manifest management.
- **Authentication**: SSO via `auth-ui` (OIDC/OAuth2)

---

## Service Boundaries

### ✅ Project Operations (Owned by Projects UI)
- Project and task lifecycle management.
- Team collaboration and communication.
- Resource and time tracking.

### ❌ Financials & Billing → **finance-service** / **erp**
- **Redirects To**: Respective service dashboards.
- **Why**: Project billing, invoicing, and payroll are handled by the finance and ERP services.
- **Update 2026-09-27:** projects-ui will show a read-mostly Financials tab (EVM, budget vs actual, committed vs actual) and edit the project budget through projects-api, which proxies to treasury. Treasury remains the owner of the budget data.

---

## Roadmap

**Status (verified against code 2026-11-16):** Sprint 1 done; Sprint 2 partly done; Sprint 3 planned. Also shipped outside this roadmap: tenders (list, detail, committees, evaluations), project team, milestones, a Gantt page (a dates table, not a chart yet), project financials with EVM and S-curve, the portfolio, QA and acceptance, and Security keys. Open items: [backlog.md](backlog.md). The UI sprints now follow the API numbering in `projects-api/plan.md` section 10 (0b, then 12 to 16), and the plan is `.claude/plans/projects-service-competitive-revamp-2026-11-16.md`.

### Sprint 0b: UI foundation (in progress, 2026-11-16)
I found these in the 2026-11-16 audit:
- **Bugs and layout:**
  - The root page redirected to itself.
  - The sidebar was a fixed 256 px with no drawer or bottom nav, so a 390 px phone had about 134 px of content.
- **Shared-ui-lib:**
  - Tailwind 3 did not scan shared-ui-lib, so its components could render unstyled.
  - shared-ui-lib was one minor version behind.
- **Hand-built code:**
  - Four tables were built by hand.
  - Native selects, a hand-made search box and local money formatting were used instead of the shared ones.

The fix:
- Tailwind 4 with `@source` for shared-ui-lib and shared-ui-lib v0.1.146.
- A console shell like maskani-ui's: collapsible sidebar, phone drawer and the shared `MobileBottomNav` with safe-area padding.
- `PageHeader`, `StatTile` and list parts taken from maskani-ui and hadia-ui.
- The shared `DataTable` (cards on phones), `SearchableCombobox`, `/search`, `/format` and `RichTextEditor` everywhere.
- A Playwright mobile project at 390 px.
- Sign-in and permissions follow `shared-docs/docs/architecture/sso-integration-guide.md` and `trinity-authorization-pattern.md`:
  - **Profile:** two steps. First SSO `/auth/me` for identity, then the projects-api `auth/me` for the service role and `projects.*` codes, which drive the sidebar, page guards and buttons. Until now the app only made the first call, so permission checks could only see the global admin role.
  - **403 handling:** a subscription 403 (`upgrade: true`) shows the upgrade message; a permission 403 goes to the unauthorized page.

#### Access and the new API contract (built 2026-11-16)

I aligned the UI with the projects-api access layer and its new list contract.

- **Two-step profile.** `useMe` stays the SSO identity (auth-api `/api/v1/auth/me`). Beside it, `useServicePermissions` (`src/hooks/usePermissions.ts`) calls `GET /api/v1/{orgSlug}/auth/me` and gets the service role, the role list and the effective `projects.*` codes. When that answers 404 (not provisioned yet) I infer the default role from the global roles, the same mapping projects-api uses on first sign-in. `useMe().hasPermission` now reads these service codes. A superuser or the platform owner passes every check.
- **One registry.** `src/lib/auth/permissions.ts` copies the API registry and system roles exactly, with the same implication rules: a module's `manage` covers its other actions, `view`, `change` and `delete` cover their `_own` forms, and `qa.run` covers `qa.view`. Node tests in `node-tests/permissions.test.ts`. The QA screens use `qaAllowed` over the same service codes.
- **Where it applies.** The sidebar hides Projects, Portfolio, Tenders, Acceptance and Roles and access without their code. Each page group has a guard layout (`RequirePermission`) that sends a user without the code to `/{orgSlug}/unauthorized` before any query runs. Buttons hide without their code: New project, Add task, task status and progress (full `change`, or `change_own` on my own tasks), Add member and Remove, Add milestone, New tender, committees, evaluations, and Edit terms. The dashboard only asks for what the role can read, and the tenant-wide task trend shows only to people who see every project.
- **403s.** The query client sends a permission or tenant 403 on a page load to the unauthorized page. A 403 on a save is a toast that names the missing permission. A subscription or feature 403 is the upgrade toast with a link to the plans, and never redirects. The mutation hooks show the API's own message for other errors.
- **Membership.** A user without `projects.projects.manage` sees only their projects; any other answers 404, and the project pages now show "Project not found" for it.
- **Lists.** Tasks load a page at a time (`limit` with `page`) with Show more. GET task now carries dependencies, the latest 50 comments and `comments_total`; project reads no longer expect tasks. The Gantt table reads `{data, truncated, limit}` and says when the plan is cut at 2000 tasks. Comment lists take `limit` and `page`. Members, milestones and tender sub-lists are plain `{data}`.
- **Roles and access.** A new page at Settings, Roles and access (`/{orgSlug}/settings/roles`), shown only with `projects.rbac.manage`. It lists the roles with how many people hold each, and the people with their roles in the shared DataTable (cards on phones). I give a role through the shared SearchableCombobox and remove one through the ConfirmDialog. My own row has no actions, as the API refuses self changes.
- **Branding and sign out.** The org layout wraps the console in the shared `TenantBrandingProvider`, which reads auth-api `GET /api/v1/tenants/by-slug/{slug}` (6 hour cache) and sets the brand colours; the sidebar shows the tenant logo and name. Sign out clears the auth store, the saved session and tenant keys and sessionStorage, then goes to the SSO logout with this app's origin as the return address.
- **Tests.** `e2e/qa-mocks.ts` now mocks the SSO identity, the service auth/me (holding each test's permissions) and the tenant by slug. `e2e/access.spec.ts` covers the hidden New project button, the unauthorized page on a permission 403 and from a page guard, the upgrade message on a subscription 403 during a save, and the not-found state.

### Sprints 12 to 16
UI work for each API sprint:
- **12:** task drawer, board drag and drop, list and calendar views, Gantt chart, My Work, live updates.
- **13:** timer and week timesheet.
- **14:** client portal.
- **15:** billing and profitability screens.
- **16:** workload, baselines, risks, change requests, templates and status rules.

### Sprint 12: Work management core (UI built 2026-11-16, ships with projects-api 1ccc945)

I built the screens people compare us with (Zoho, Asana, ClickUp), phone first at 390 px. The API
contract is projects-api `docs/api.md`, "Work management". Waiting on the main session: install
(`@dnd-kit/core` 6.3.1 is new), type check, lint, `pnpm test`, build and Playwright.

- [x] **Task drawer (US-12.1).** Any view opens a task by `?task=<id>`, so the notification link
  `/{org}/projects/{id}/tasks?task={id}` lands on it. It is a side sheet from 768 px and full screen
  below. It holds title, status, priority, assignees, start and due dates, estimate, progress, the
  rich text description, the checklist (task metadata `checklist`, changed one operation at a
  time), subtasks, comments with "Show
  older", files and the activity history. Delete asks first. `src/components/work/task-drawer.tsx`.
- [x] **Several assignees (US-12.2).** `assignee_ids` in, `edges.assignees` out, primary first;
  `assignee_id` is gone from the types. The picker is the shared MultiSelectCombobox over project
  members only. Names come with the member list (see Gaps closed below).
- [x] **Board (US-12.5).** Columns are the project statuses, each paging 25 at a time with Show
  more, counts from `board-counts`. Dragging (`@dnd-kit/core`; a long press on phones, keyboard
  too) moves the card at once with a fresh `Idempotency-Key` and rolls back on a refusal. Columns
  scroll sideways on phones. People with `projects.projects.change` edit the columns: rename,
  reorder, add, stage, never removing Done or a column that still holds tasks.
- [x] **List and calendar (US-12.6).** The list is the shared DataTable with server side filters
  (status, priority, assignee) and named saved filters kept per project in this browser. The
  calendar shows month and week grids from 640 px and an agenda below; dragging a task to another
  day sends `PATCH dates`. Only the shown window is fetched.
- [x] **Gantt chart (US-12.7).** Bars, dependency arrows, the critical path in red with its length
  in days, a today line, day, week and month zoom, drag to move or resize either end. A 409
  `schedule_conflict` names the blocking tasks. Only rows in view are drawn, so 2,000 tasks stay
  smooth. Below 640 px the plan is a list first with the chart one tap away. The `gantt_chart`
  lock and the truncated notice stay.
- [x] **My Work (US-12.8).** `/{org}/my-work`: counts and the four buckets in my time zone, each
  paged, opening the drawer in place. In the sidebar and the phone bar (Tenders moved to More so
  four tabs fit).
- [x] **Live updates (US-12.9).** `GET /projects/{id}/stream` read with fetch (the API client's
  `stream`, the same approach as erp-ui's payroll stream). Events carry ids only, so each one marks
  the matching queries stale, bursts folded into one refetch every 300 ms. A reconnect backs off
  from 1 s to 30 s and refetches everything for the project. Board, list, calendar, drawer and
  Gantt all follow it; a dot in the header says whether it is live.
- [x] **Offline edits (US-12.10).** Status moves, comments and checklist ticks run with
  `networkMode: 'always'`. Offline, or with no answer, they go to a queue per user in
  localStorage, keyed by their `Idempotency-Key` and dropped after 24 hours like the API's window.
  The shared OfflineSyncBanner shows what is waiting, and the queue drains on reconnect, every 30
  seconds and on "Sync now". A refused edit is dropped with a toast. Queued moves show on the card.
- [x] **Files (US-12.4).** Ask for a presigned PUT, send the file straight to storage with exactly
  the signed headers, then confirm. Remove asks first and needs your own file or
  `comments.manage`.
- [x] Tests: `node-tests/work.test.ts` (checklist, offline queue, Gantt layout, critical path and
  conflict text, the stream parser, calendar and saved filters) and `e2e/work.spec.ts` with
  `e2e/work-mocks.ts` (drawer from `?task=`, board drag with the key, members only picker, My Work,
  Gantt critical path and conflict, upload).

#### Gaps closed (2026-11-17, with the projects-api sprint 12 follow-up)

- [x] **Names for everyone.** The member list now carries each member's name and email, so
  `usePeople` reads names from it and no longer touches `GET /rbac/users`. Comments show
  `author_name` and the activity history `actor_name` as the API sends them, with the member list
  and then a short id as fallbacks (`src/lib/work/people.ts`). The team page shows names too.
- [x] **Subtasks** come from `?parent_id=` a page of 25 at a time with Show more, instead of
  reading 500 tasks and filtering them here.
- [x] **Comment replays** send the comment's `Idempotency-Key` on the first post and on every
  replay from the offline queue, so a post whose answer was lost never doubles.
- [x] **Checklist operations.** Each tick, add, rename or removal is one `PATCH checklist`
  operation with its own key. Ticks send the state wanted, never "flip", so a replay cannot undo
  one. Offline operations queue in order (a newer one no longer replaces the waiting one), and the
  drawer shows them applied until they are sent. A whole-list write is gone, and a stored queue
  entry from the old shape is dropped on load.
- [x] **Project files page** at `/{org}/projects/{id}/files`, linked from the project tabs (locked
  without `team_collaboration`). It lists project and task files newest first on the shared
  DataTable (cards on phones), links task files to their task, uploads to the project and removes
  after a ConfirmDialog. The "Attach a file" button is shared with the drawer.
- [x] **Gantt first paint.** `useMediaQuery` now answers undefined until it knows the width. While
  it is unknown the page renders both the chart and the phone list and the `sm` breakpoint picks in
  CSS, so a desktop paints the chart first; once known, only one stays mounted.
- [x] **Phone board drag spec.** dnd-kit's TouchSensor reacts to real touch events, which
  Playwright's own API cannot move. Chromium's DevTools protocol (`Input.dispatchTouchEvent`) sends
  the same events a finger does, so the phone project now holds a card for 400 ms and drags it to
  the next column.
- [x] Tests: node tests for checklist operations (applied twice changes nothing), the queue, names,
  files and the Gantt layout; Playwright for names without `rbac.manage`, checklist operations
  and comment keys, `?parent_id`, the files page, the phone long press and the desktop Gantt.

Open from this sprint, in `docs/backlog.md`: the mention picker (the shared editor has no mention
extension yet).

### Sprint 13: Time tracking (UI built 2026-11-17, ships with projects-api bf96ccd)

I built the timer and the week timesheet over projects-api's `/time` routes (`docs/api.md`, "Time").
ERP owns the hours: every save lands on the user's ERP timesheet and approval stays in ERP. Every
screen needs the `time_tracking` and `attendance` features (the API checks both) and the
`projects.time.*` codes. Waiting on the main session: type check, lint, `pnpm test` and
Playwright. No new dependencies.

- [x] **Timer (US-13.1).** A start and stop button in the task drawer (with Discard, behind a
  ConfirmDialog, which logs nothing) and on every board card. Starting needs a connection, as the
  server stamps the start and stops any other timer; the toast says how much the stopped one
  logged. A pill in the header shows the running timer on every page: elapsed time, the task (a
  link to it) and stop. The server is the source of truth (`GET /time/timer`, read again on focus),
  so a reload or another device shows the same timer. The browser keeps a copy per user and
  organisation in localStorage, which the pill falls back on when the server cannot be reached.
  Stopping sends the browser's own start and stop in RFC 3339 and my zone.
- [x] **Week timesheet (US-13.2).** `/{org}/time`, in the sidebar and the phone bar only when the
  plan and `time.view_own` allow (the bar keeps four tabs, so Portfolio moves to More when Time is
  there). From 768 px a grid of projects and tasks by day with totals per row and day, the week
  total and the billable total. Below it a day strip with each day's total and that day's rows.
  Cells take `1.5` or `1:30`, save on Enter or when focus leaves, and a note button opens the
  hours and note together. Week arrows, This week, the status badge, a rejection reason from ERP,
  Add a row (a project I can see, then one of its tasks or the whole project, both in the shared
  SearchableCombobox) and Submit week behind a ConfirmDialog. People with `time.view` pick
  someone else's week from the members of their projects; only `time.manage` edits it, and
  submit is for my own week only.
- [x] **Billable (US-13.3).** Each row shows its billable flag. The switch shows only on time and
  materials projects and re-sends the row's logged days with the new flag; a 422 is a toast and
  the cell rolls back.
- [x] **Offline (US-13.5).** Week edits and timer stops join the sprint 12 queue and the shared
  OfflineSyncBanner. A cell is keyed by user, project, task and date, so a newer edit replaces the
  waiting one, and a PUT sets the hours, so a replay changes nothing twice. The stop route takes
  no Idempotency-Key and adds the run to ERP, so a stop is keyed by the task and the run's start
  and, before it is sent, the runner asks the task for its timer: when the server no longer runs
  that timer (same start), the run was already logged and nothing is sent. A stop across
  midnight that fails after logging its first date answers `logged_segments`; the waiting stop
  then moves its start to the next midnight in its zone, so the retry sends only the rest. While a
  stop waits, the header shows no timer even though the server still runs it. Time waits a week
  in the queue, task edits a day.
- [x] **Errors.** `no_employee_record` is an empty state on the week ("Your account has no
  employee record in ERP. Ask HR to link it.") and a single toast elsewhere, never retried.
  `timesheet_locked`, `nothing_to_submit` and `validation_error` show the API's message;
  `erp_unavailable` shows the retry state.
- [x] Tests: `node-tests/time.test.ts` (week maths, zones and midnight, hours, totals, elapsed
  time, the partial stop, queue keys and the time queue) and `e2e/time.spec.ts` with
  `e2e/time-mocks.ts` at phone and desktop (timer from a card with the header pill across a
  reload, a cell edit and submit, the no employee state, the billable switch hidden on a fixed
  fee project). The mocked token now carries `attendance`.

### Sprint 14: Client portal (UI built 2026-11-17, with the uncommitted projects-api portal)

I built the client portal and the team's client screens over projects-api's portal routes
(`docs/api.md`, "Client portal"). Every screen needs the `client_portal` feature, which every
Projects tier has. Waiting on the main session: type check, `pnpm test` and Playwright. No new
dependencies.

- [x] **Portal sign-in (US-14.1).** The portal lives at `/{org}/portal` and signs in with auth-api's
  `projects-portal` client (PKCE, `tenant={org}`, callback `/{org}/portal/auth/callback` on the
  page's own origin; auth-api's seed registers the production URLs and `http://localhost:3000/{slug}/portal/auth/callback`).
  The portal session is kept apart from the staff one: its own store (`src/store/portal-auth.ts`,
  saved under `projects-portal-auth-storage`), its own PKCE keys in sessionStorage (prefix
  `portal_`), its own axios client (`src/lib/api/portal.ts`) and its own cross-tab refresher on the
  `projects-portal` client id. The org layout leaves `/{org}/portal` out of the staff AuthProvider
  and console shell, and the query client skips the staff unauthorized page and permission toasts
  there. Signing out of the portal clears only the portal's keys, so a staff member trying the
  portal stays signed in to the staff app. The shared PKCE and refresh helpers now take a client id
  and a storage prefix; the staff app passes neither and behaves as before.
- [x] **What a client sees (US-14.2).** Phone first, no staff shell: a header with the firm's logo
  and name (the shared TenantBrandingProvider) and Sign out. The landing lists the projects shared
  with the client as cards with progress and how many milestones wait for them. When the list
  answers `X-Client-Invites: email_not_verified`, a banner asks them to verify their email on the
  accounts site (`/dashboard/profile?tab=email`) to open the projects they were invited to. The
  project page has the summary and tabs for milestones, shared tasks (read only), files (signed
  links, fetched again after 10 minutes), invoices and messages. Invoices answering
  `available: false` read "Invoices will appear here", never an error. An account that is not a
  client of the firm, or a plan without the portal, gets a plain explanation instead of a staff
  page.
- [x] **Approve a milestone (US-14.3).** While `can_decide`, a milestone shows Approve or Request
  changes with a comment (required for changes, at most 2000 characters, checked before sending).
  A 409 `milestone_not_ready` says the milestone no longer waits for their review and reloads the
  list. A notice link with `?milestone={id}` scrolls to and highlights that milestone. On the team
  side, the milestones page has Ready for review (behind a ConfirmDialog, as it notifies the
  clients) on any milestone that is not waiting, approved or completed, for people with
  `milestones.change`.
- [x] **Client thread (US-14.4).** The same thread component for the client (Messages tab) and
  the team (a Client thread tab on the project, `comments.view` to read and `comments.add` to
  post). It uses the shared RichTextEditor with no mention list, and every post carries an
  Idempotency-Key.
- [x] **Clients and sharing.** A Clients tab on the project (`portal.manage`) lists the clients,
  invites from a marketflow contact with the same picker as the contract card (a resent invite
  says so) and removes one behind a ConfirmDialog. A "Visible to client" switch sits in the task
  drawer and on file rows (files page and the drawer's files), for `portal.manage` only. The
  UI's project manager role now holds `portal.manage` and the global client role maps to client,
  as in projects-api.
- [x] Tests: `node-tests/portal.test.ts` (portal paths and the safe return, the invite header,
  review rules and the decision check, refusals, roles) and, at phone and desktop,
  `e2e/portal.spec.ts` (landing with and without the banner, approve, request changes with the
  409, invoices and files, a thread post) and `e2e/clients.spec.ts` (invite and remove, no tab
  or switch without `portal.manage`, task and file sharing, the team's thread post), with
  `e2e/portal-mocks.ts`. The portal fixture token carries the client role.
- [x] **API follow-ups wired in (2026-11-17).** projects-api closed the four gaps I had listed, and
  the screens use them:
  - The landing cards read `progress` from `GET /portal/projects` (percent, milestones done and
    how many wait for the client) and no longer ask for a summary per card. A decision refreshes
    the list too.
  - The team's milestones page shows the client's last decision in place, with their comment and
    who sent it (`DecisionNote`, the same block the portal uses). `last_decision.decision` is now
    the outcome, `approved` or `changes_requested`, on both sides.
  - Thread entries carry a Client or Team tag from `author_kind`, on the portal and the team's
    Client thread tab.
  - The contact lookup opens to `portal.manage`, so the Clients tab always shows the picker; I
    removed the "ask a project manager" note.
  - The browser can now read `X-Client-Invites`, so the verify email banner works across origins.
  - Tests: `node-tests/portal.test.ts` covers `decisionSummary`, `landingNote` and
    `threadAuthor`; the e2e mocks carry the new fields, `portal.spec.ts` checks that the landing
    makes no summary call and that the thread tags its entries, and `clients.spec.ts` checks the
    decision on the milestones page. `freshPortal` now applies its overrides, which it silently
    dropped before, so the unverified email and 409 specs really run those cases. The staff
    fixture token gains `milestone_billing` so the milestones page renders.

### Sprint 15: Billing and profitability (UI built 2026-11-17)

I built the screens against the projects-api billing routes (`internal/http/handlers/billing.go`)
and the client rollup (`GET /financials/clients`). Treasury owns every invoice; these screens create
drafts through projects-api and link to treasury-ui's invoice page (`/{orgSlug}/invoices/{id}`).
Waiting on the main session: type check, lint, `pnpm test`, build and Playwright.

- [x] **Permissions.** `projects.billing.view` ("View project billing and invoices") and
  `projects.billing.manage` ("Create project invoices") are in the UI registry; manage implies
  view, and the project manager role holds manage, as in projects-api's roles.
- [x] **Billing tab (US-15.1, 15.2, 15.3, 15.5).** A Billing tab on the project, shown with the
  `milestone_billing` feature and `billing.view`, guarded by `RequirePermission`. It holds the
  contract terms with a link to edit them on the Financials tab (and a note when there is no
  client or the project is internal), the milestones in the shared DataTable (cards on phones)
  with price, invoice number, and a paid, partly paid, overdue or void badge, Set price (a dialog
  with a fixed amount or a share of the contract value) and Create invoice (`billing.manage`,
  disabled without a price or a client). A created invoice toasts with "Open in treasury". Time
  and materials projects get the unbilled hours and value and a from and to date pair (last month
  by default) with Invoice time; a returned warning stays on the card. Retainer projects get a
  month picker (this month by default). Then the latest invoices with date, due date, total,
  amount due and status. Banners say when treasury or ERP is not answering. Without the feature
  the page shows the plan lock and makes no billing call; a plan 403 shows the same lock. Errors
  show the server's text, and nothing to bill is an information toast.
- [x] **Milestones page (US-15.5).** Each invoiced milestone shows its invoice number, linked to
  treasury, with the payment badge. The billing overview is only read when the tenant has the
  feature and the user holds `billing.view`.
- [x] **Contract card (US-15.3, 15.4).** Billing gains Monthly retainer with the monthly fee,
  included hours and a rollover switch, and time and materials gains the hourly rate (both kept in
  project metadata). The summary adds labour cost, cost to date, margin to date and the approved
  hours not yet billed.
- [x] **Portfolio by client (US-15.4).** A By project and By client switch on the portfolio. By
  client lists each client's projects, contract value, invoiced, unbilled, labour cost, cost to
  date and margin, in the API's order, with notes when the rollup was cut short or treasury did
  not answer.
- [x] **Portal invoices.** The client's Invoices tab lists the sent and paid invoices with date,
  due date, total, amount due, a paid or overdue badge and "View and pay" to treasury's public
  page. While billing is not connected it shows the API's note.
- [x] Tests: `node-tests/billing.test.ts` (money parsing, default periods, price rules, the
  invoice badge order, invoice blocks, error toasts, links, permissions) and, at phone and
  desktop, `e2e/billing.spec.ts` with `e2e/billing-mocks.ts` (milestone invoice, price by percent,
  time invoice with a warning, nothing to bill, retainer month, read only, the plan lock, the
  client rollup and the portal list). `signIn` in `e2e/qa-mocks.ts` now takes the plan features.

### Sprint 1: Foundation & SSO
- [x] Project scaffolding with Next.js 15.
- [x] SSO integration with `auth-ui`.
- [x] Core layout with project dashboard shell.

### Sprint 2: Task Management
- [x] Kanban board implementation (tasks page).
- [x] Task detail view with comments and attachments: the sprint 12 task drawer.
- [x] Milestone tracking.

### Sprint 3: Collaboration & Reporting
- [ ] Real-time activity feed. A task's history shows in the drawer (sprint 12); a project feed is still open.
- [ ] Project status reports.
- [ ] Time tracking interface. Hours will come from ERP timesheets, not a projects time log.

---

## QA and acceptance (13 November 2026)

Built from the plan `.claude/plans/hadia-remaining-sprints-gift-hadia-payout-verification-2026-11-12.md`
("QA and Acceptance tool", section 7) against the projects-api contract in
`projects-service/projects-api/docs/api.md`. projects-api owns every record; this UI only reads and
sends through its routes.

### Routes

| Route | Who | What |
|---|---|---|
| `/{orgSlug}/qa` | `projects.qa.view` | Sessions list with status filter; New session (`manage`) freezes a template into a draft session (service, project or general subject; an optional higher minimum score) |
| `/{orgSlug}/qa/templates` | `view` | Own and active platform templates; New template (`manage`; the platform owner can make a platform template) |
| `/{orgSlug}/qa/templates/{id}` | `view`, edits `manage` | Name, service tag, status, pass rule (must rule, blocking severities, minimum score, weights); criteria table with add, edit, remove; bulk import from CSV or JSON; Mark as reviewed when a catalogue feature changed. A platform template is read only unless you are the platform owner |
| `/{orgSlug}/qa/sessions/{id}` | `view` | Outcome and score, criteria with every tester's current verdict, defects with ticket status and retry, people (invite as tester, signer or observer; revoke), share link, open, close, accept or reject, report PDF in the shared `PdfPreview`. Accept stays disabled with the pass rule's reasons until the rule is met. A team member with `run` records their own verdict on an open session |
| `/qa/{code}` | invited email | Public page: access by SSO (signed in with the invited email) or the auth-api email code; testers get the checklist, signers and observers the outcome and the report to print |
| `/qa/sessions/{id}` | signed in | The link in projects-api notices; redirects to `/{tenant_slug}/qa/sessions/{id}` |

The sidebar shows Acceptance only to users who can view QA. Permissions are read with
`qaAllowed` (`src/lib/qa/logic.ts`) over the projects service profile (`GET /{tenant}/auth/me`),
the same rule as projects-api's gate: `manage` covers everything, `run` covers view, and a
superuser or the platform owner passes. Tenant admins pass because projects-api gives them the
projects administrator role.

### Invitee access and autosave

- The share link alone grants nothing. The page asks auth-api for an email code
  (`/api/v1/auth/public-otp/send` with the tenant slug for branding, then `/verify`) and trades the
  one-time `otp_token` at `POST /api/v1/qa/access/{code}/email`. A signed-in user can continue
  through `POST /api/v1/qa/access/{code}/sso` instead.
- projects-api sets the HttpOnly `qa_access` cookie. The token from the same answer is kept for the
  tab in sessionStorage and sent as `X-QA-Access`, for browsers that block the cross-site cookie.
- Each verdict is kept on the device first (localStorage, per session), sent after a short pause,
  and dropped from the device once the API holds it. Offline or on a network error it stays and is
  sent again when the browser is back online or the page is opened again. A failure is not sent
  until it has a severity. Sign out warns when verdicts are still on the device.
- The checklist works one criterion at a time (the default, for phones) or as the whole list.

### Feature catalogue

The criterion editor reads `GET /api/v1/{tenant}/qa/catalog/features?service=`. While projects-api
answers `available:false` (QA_CATALOG_ENABLED off) or the read fails, the feature code is typed by
hand and checked by the API once the catalogue is on.

### Tests

- `pnpm test`: node tests for the pure helpers (`node-tests/qa-logic.test.ts`): permissions,
  verdict checks, drafts, the accept reason, CSV and JSON import; and the Security keys helpers
  (`node-tests/field-keys.test.ts`).
- `pnpm test:e2e`: Playwright with mocked APIs at 390 px and 1280 px (`e2e/qa-invitee.spec.ts`,
  `e2e/qa-tenant.spec.ts`, mocks in `e2e/qa-mocks.ts`). Build first; the config runs `pnpm start`.

Note: `/qa` is a top-level route, so an organisation slug `qa` would be shadowed by it.

## Security keys (15 November 2026)

`/{orgSlug}/platform/security` is the platform owner's page for projects-api's field encryption
keys. The sidebar shows it under "Platform" only when `isPlatformOwner` is true, the page refuses
anyone else, and projects-api checks again on every route.

- Key health: whether the root key is set and its fingerprint, the current data key and its
  fingerprint, the last backup (when and by whom), the last rotation, how many sealed values exist
  and how many are on the current key, the rotation state, and each key with its value count. While
  a rotation re-seals, the card refreshes every 5 seconds.
- Download a backup and Rotate the key both start with a fresh email code. The page asks auth-api to
  email me a code, trades it for a one-time `otp_token` and sends that with the request
  (`src/lib/api/field-keys.ts`). The backup comes back as a file and goes straight to a download;
  nothing of it is shown on screen. Rotate is off while a re-seal runs.
- The backup holds the data keys, not the root `FIELD_ENCRYPTION_KEY`; the page says so.

Pure helpers live in `src/lib/security/field-keys.ts` with node tests in
`node-tests/field-keys.test.ts`. The API side is in projects-api `docs/api.md` ("Platform: field
keys") and `docs/architecture.md` ("Field encryption keys").

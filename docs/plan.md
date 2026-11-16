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

### Sprint 1: Foundation & SSO
- [x] Project scaffolding with Next.js 15.
- [x] SSO integration with `auth-ui`.
- [x] Core layout with project dashboard shell.

### Sprint 2: Task Management
- [x] Kanban board implementation (tasks page).
- [ ] Task detail view with comments and attachments. A `useComments` hook exists but no page uses it; there is no task detail page.
- [x] Milestone tracking.

### Sprint 3: Collaboration & Reporting
- [ ] Real-time activity feed (the API has activity routes; the UI does not show them).
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

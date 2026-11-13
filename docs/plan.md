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

**Status (verified against code 2026-09-27):** Sprint 1 done; Sprint 2 partially done; Sprint 3 planned. Also shipped outside this roadmap: tenders (list, detail, committees, evaluations), project team, milestones and Gantt pages. Project financials, EVM, portfolio and tender pipeline are In progress (plan budgets-planning-projects-bi-2026-09-27). Open items: [backlog.md](backlog.md).

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
`qaAllowed` (`src/lib/qa/logic.ts`), the same rule as projects-api's gate: `manage` covers
everything, `run` covers view, and tenant admins and the platform owner pass.

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
  verdict checks, drafts, the accept reason, CSV and JSON import.
- `pnpm test:e2e`: Playwright with mocked APIs at 390 px and 1280 px (`e2e/qa-invitee.spec.ts`,
  `e2e/qa-tenant.spec.ts`, mocks in `e2e/qa-mocks.ts`). Build first; the config runs `pnpm start`.

Note: `/qa` is a top-level route, so an organisation slug `qa` would be shadowed by it.

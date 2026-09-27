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

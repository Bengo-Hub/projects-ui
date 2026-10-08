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
- **Update 2026-09-27:** projects-ui shows a read-mostly Financials tab (EVM, budget vs actual, committed vs actual) and edit the project budget through projects-api, which proxies to treasury. Treasury remains the owner of the budget data.

---

## Roadmap

**Status (verified against code 2026-09-28):** Sprints 1 to 3 done. Also shipped outside this roadmap: tenders (list, detail, committees, evaluations, pipeline), project team, milestones, Gantt, project financials (EVM), portfolio and time pages. Open items: [backlog.md](backlog.md).

### Sprint 1: Foundation & SSO
- [x] Project scaffolding with Next.js 15.
- [x] SSO integration with `auth-ui`.
- [x] Core layout with project dashboard shell.

### Sprint 2: Task Management
- [x] Kanban board implementation (tasks page).
- [x] Task detail view (`/projects/[id]/tasks/[taskId]`): edit fields, comments (add, edit and delete your own), attachments, dependencies and the task's activity. Task titles on the board and list link to it.
- [x] Milestone tracking.

### Sprint 3: Collaboration & Reporting
- [x] Activity feed on the project overview and task detail pages, refreshed every 30 seconds (projects-api has no push channel yet). The overview also gained a project discussion thread and a files list.
- [x] Project status reports (`/projects/[id]/report`): health, progress, work completed, overdue and due soon, milestones, budget and hours (with Budget Tracking) and recent activity over the last 7, 14 or 30 days. Prints to PDF and copies as plain text.
- [x] Time tracking view (`/time`, Budget Tracking): hours logged on ERP timesheets against task estimates per project, with pending hours and an overrun flag. Time is logged in ERP; set `NEXT_PUBLIC_ERP_UI_URL` to link there.

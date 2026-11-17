// projects-api's permission registry and system roles (internal/modules/rbac/permissions.go and
// roles.go), and the checks the UI runs against the service profile from GET /{tenant}/auth/me.
// No React, no aliases and no runtime imports, so node-tests can load this file directly.

export const PERMS = {
  projectsView: 'projects.projects.view',
  projectsAdd: 'projects.projects.add',
  projectsChange: 'projects.projects.change',
  projectsDelete: 'projects.projects.delete',
  projectsManage: 'projects.projects.manage',

  tasksView: 'projects.tasks.view',
  tasksViewOwn: 'projects.tasks.view_own',
  tasksAdd: 'projects.tasks.add',
  tasksChange: 'projects.tasks.change',
  tasksChangeOwn: 'projects.tasks.change_own',
  tasksDelete: 'projects.tasks.delete',
  tasksManage: 'projects.tasks.manage',

  milestonesView: 'projects.milestones.view',
  milestonesAdd: 'projects.milestones.add',
  milestonesChange: 'projects.milestones.change',
  milestonesDelete: 'projects.milestones.delete',

  membersView: 'projects.members.view',
  membersManage: 'projects.members.manage',

  commentsView: 'projects.comments.view',
  commentsAdd: 'projects.comments.add',
  commentsChangeOwn: 'projects.comments.change_own',
  commentsDeleteOwn: 'projects.comments.delete_own',
  commentsManage: 'projects.comments.manage',

  tendersView: 'projects.tenders.view',
  tendersAdd: 'projects.tenders.add',
  tendersChange: 'projects.tenders.change',
  tendersDelete: 'projects.tenders.delete',
  tendersManage: 'projects.tenders.manage',

  financialsView: 'projects.financials.view',
  financialsManage: 'projects.financials.manage',

  billingView: 'projects.billing.view',
  billingManage: 'projects.billing.manage',

  timeView: 'projects.time.view',
  timeViewOwn: 'projects.time.view_own',
  timeAdd: 'projects.time.add',
  timeManage: 'projects.time.manage',

  portalView: 'projects.portal.view',
  portalManage: 'projects.portal.manage',

  qaView: 'projects.qa.view',
  qaRun: 'projects.qa.run',
  qaManage: 'projects.qa.manage',

  rbacManage: 'projects.rbac.manage',

  // Planning depth (sprint 16).
  workloadView: 'projects.workload.view',
  workloadManage: 'projects.workload.manage',
  baselinesView: 'projects.baselines.view',
  baselinesAdd: 'projects.baselines.add',
  baselinesDelete: 'projects.baselines.delete',
  risksView: 'projects.risks.view',
  risksAdd: 'projects.risks.add',
  risksChange: 'projects.risks.change',
  risksDelete: 'projects.risks.delete',
  changeRequestsView: 'projects.change_requests.view',
  changeRequestsAdd: 'projects.change_requests.add',
  changeRequestsManage: 'projects.change_requests.manage',
  changeApprovals: 'projects.change_approvals.manage',
  templatesView: 'projects.templates.view',
  templatesAdd: 'projects.templates.add',
  templatesDelete: 'projects.templates.delete',
  automationView: 'projects.automation.view',
  automationManage: 'projects.automation.manage',
} as const;

export type PermissionCode = (typeof PERMS)[keyof typeof PERMS];

/** Plain names, the same as the registry's, for messages such as a refused save. */
export const PERMISSION_NAMES: Record<PermissionCode, string> = {
  'projects.projects.view': 'View projects',
  'projects.projects.add': 'Create projects',
  'projects.projects.change': 'Edit projects',
  'projects.projects.delete': 'Delete projects',
  'projects.projects.manage': 'Manage every project in the organisation',
  'projects.tasks.view': 'View tasks',
  'projects.tasks.view_own': 'View tasks assigned to me',
  'projects.tasks.add': 'Create tasks',
  'projects.tasks.change': 'Edit tasks',
  'projects.tasks.change_own': 'Edit tasks assigned to me',
  'projects.tasks.delete': 'Delete tasks',
  'projects.tasks.manage': 'Manage tasks',
  'projects.milestones.view': 'View milestones',
  'projects.milestones.add': 'Create milestones',
  'projects.milestones.change': 'Edit milestones',
  'projects.milestones.delete': 'Delete milestones',
  'projects.members.view': 'View project members',
  'projects.members.manage': 'Add and remove project members',
  'projects.comments.view': 'View comments',
  'projects.comments.add': 'Write comments',
  'projects.comments.change_own': 'Edit my comments',
  'projects.comments.delete_own': 'Delete my comments',
  'projects.comments.manage': 'Moderate every comment',
  'projects.tenders.view': 'View tenders',
  'projects.tenders.add': 'Create tenders',
  'projects.tenders.change': 'Edit tenders',
  'projects.tenders.delete': 'Delete tenders',
  'projects.tenders.manage': 'Manage tenders, committees and evaluations',
  'projects.financials.view': 'View project financials',
  'projects.financials.manage': 'Manage project budgets',
  'projects.billing.view': 'View project billing and invoices',
  'projects.billing.manage': 'Create project invoices',
  'projects.time.view': 'View all time entries',
  'projects.time.view_own': 'View my time entries',
  'projects.time.add': 'Log time',
  'projects.time.manage': 'Manage and approve time entries',
  'projects.portal.view': 'Use the client portal',
  'projects.portal.manage': 'Manage client portal access',
  'projects.qa.view': 'View QA templates, sessions and reports',
  'projects.qa.run': 'Record QA results',
  'projects.qa.manage': 'Manage QA templates, sessions and decisions',
  'projects.rbac.manage': 'Manage roles and role assignments',
  'projects.workload.view': 'View team workload',
  'projects.workload.manage': 'Set team capacity',
  'projects.baselines.view': 'View baselines and slips',
  'projects.baselines.add': 'Save baselines',
  'projects.baselines.delete': 'Delete baselines',
  'projects.risks.view': 'View the risk register',
  'projects.risks.add': 'Raise risks',
  'projects.risks.change': 'Edit risks',
  'projects.risks.delete': 'Delete risks',
  'projects.change_requests.view': 'View change requests',
  'projects.change_requests.add': 'Raise change requests',
  'projects.change_requests.manage': 'Manage every change request',
  'projects.change_approvals.manage': 'Approve and reject change requests',
  'projects.templates.view': 'View project templates',
  'projects.templates.add': 'Save projects as templates',
  'projects.templates.delete': 'Delete project templates',
  'projects.automation.view': 'View automation rules',
  'projects.automation.manage': 'Manage status rules and automations',
};

export const ALL_PERMISSIONS = Object.values(PERMS) as PermissionCode[];

/** The name of a code, or the code itself when the registry does not know it. */
export function permissionName(code: string): string {
  return PERMISSION_NAMES[code as PermissionCode] ?? code;
}

/**
 * The codes that also grant code, as projects-api's rbac.impliers: the module's manage grants every
 * action of the module, view, change and delete grant their _own form, and QA's run grants view.
 */
export function impliers(code: string): string[] {
  const parts = code.split('.');
  if (parts.length !== 3) return [];
  const prefix = `${parts[0]}.${parts[1]}.`;
  const action = parts[2];
  const out: string[] = [];
  if (action !== 'manage') out.push(`${prefix}manage`);
  if (action === 'view_own') out.push(`${prefix}view`);
  if (action === 'change_own') out.push(`${prefix}change`);
  if (action === 'delete_own') out.push(`${prefix}delete`);
  if (code === PERMS.qaView) out.push(PERMS.qaRun);
  return out;
}

/** The service layer of the profile: what GET /api/v1/{tenant}/auth/me answers. */
export interface ServiceProfile {
  user_id: string;
  email: string;
  name: string;
  tenant_id: string;
  global_roles: string[];
  service_role: string;
  roles: string[];
  permissions: string[];
  is_platform_owner: boolean;
}

/** What a permission check needs: the effective codes and whether the caller bypasses them. */
export interface PermissionSubject {
  permissions: string[];
  /** Platform owner or superuser: every check passes, as projects-api's authz bypass. */
  bypass: boolean;
}

/** Whether subject holds code, directly or through an implying code. */
export function holds(subject: PermissionSubject | null | undefined, code: string): boolean {
  if (!subject) return false;
  if (subject.bypass) return true;
  if (subject.permissions.includes(code)) return true;
  return impliers(code).some((c) => subject.permissions.includes(c));
}

/** Whether subject holds any of the codes (the API's Require takes any of its codes). */
export function holdsAny(subject: PermissionSubject | null | undefined, codes: string | readonly string[]): boolean {
  const list = typeof codes === 'string' ? [codes] : codes;
  return list.some((c) => holds(subject, c));
}

// System roles, in descending rank, with their permission codes (projects-api roles.go). Used only
// when the service has no profile for the user yet (auth/me answered 404).

const PROJECT_MANAGER: string[] = [
  PERMS.projectsView, PERMS.projectsAdd, PERMS.projectsChange,
  PERMS.tasksManage, PERMS.milestonesView, PERMS.milestonesAdd, PERMS.milestonesChange, PERMS.milestonesDelete,
  PERMS.membersView, PERMS.membersManage, PERMS.commentsView, PERMS.commentsAdd, PERMS.commentsManage,
  PERMS.tendersView, PERMS.tendersAdd, PERMS.tendersChange, PERMS.financialsView,
  PERMS.timeView, PERMS.timeAdd, PERMS.timeManage, PERMS.portalManage, PERMS.qaManage,
  PERMS.billingManage,
  PERMS.workloadView, PERMS.baselinesView, PERMS.baselinesAdd, PERMS.baselinesDelete,
  PERMS.risksView, PERMS.risksAdd, PERMS.risksChange, PERMS.risksDelete,
  PERMS.changeRequestsManage, PERMS.changeApprovals, PERMS.templatesView, PERMS.templatesAdd, PERMS.automationManage,
];
const MEMBER: string[] = [
  PERMS.projectsView, PERMS.tasksView, PERMS.tasksAdd, PERMS.tasksChangeOwn,
  PERMS.milestonesView, PERMS.membersView, PERMS.commentsView, PERMS.commentsAdd, PERMS.commentsChangeOwn, PERMS.commentsDeleteOwn,
  PERMS.tendersView, PERMS.timeViewOwn, PERMS.timeAdd, PERMS.qaRun,
  PERMS.baselinesView, PERMS.risksView, PERMS.risksAdd, PERMS.changeRequestsView, PERMS.changeRequestsAdd,
  PERMS.templatesView, PERMS.automationView,
];
const VIEWER: string[] = [
  PERMS.projectsView, PERMS.tasksView, PERMS.milestonesView, PERMS.membersView, PERMS.commentsView, PERMS.tendersView, PERMS.qaView,
  PERMS.baselinesView, PERMS.risksView, PERMS.changeRequestsView,
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  projects_admin: ALL_PERMISSIONS,
  project_manager: PROJECT_MANAGER,
  member: MEMBER,
  viewer: VIEWER,
  client: [PERMS.portalView],
};

/**
 * The default projects role for global auth-api roles, as projects-api's MapGlobalRoles: admin
 * level roles give projects_admin, manager and staff give member, the portal's client role gives
 * client (a staff role beside it wins), anyone else viewer.
 */
export function roleFromGlobalRoles(global: readonly string[]): string {
  let best = 'viewer';
  for (const g of global) {
    switch (g.trim().toLowerCase()) {
      case 'superuser':
      case 'super_admin':
      case 'admin':
      case 'owner':
      case 'tenant_admin':
      case 'administrator':
        return 'projects_admin';
      case 'manager':
      case 'staff':
        best = 'member';
        break;
      case 'client':
        if (best === 'viewer') best = 'client';
        break;
    }
  }
  return best;
}

/** A service profile inferred from the SSO identity, for a user projects-api has not provisioned. */
export function inferProfile(identity: {
  id: string;
  email: string;
  fullName: string;
  tenant_id: string;
  roles: string[];
  isPlatformOwner: boolean;
}): ServiceProfile {
  const role = roleFromGlobalRoles(identity.roles);
  return {
    user_id: identity.id,
    email: identity.email,
    name: identity.fullName,
    tenant_id: identity.tenant_id,
    global_roles: identity.roles,
    service_role: role,
    roles: [role],
    permissions: ROLE_PERMISSIONS[role] ?? [],
    is_platform_owner: identity.isPlatformOwner,
  };
}

/** Plain names for the system roles, for screens that show a role code. */
export const ROLE_NAMES: Record<string, string> = {
  projects_admin: 'Projects administrator',
  project_manager: 'Project manager',
  member: 'Member',
  viewer: 'Viewer',
  client: 'Client',
};

export function roleName(code: string): string {
  return ROLE_NAMES[code] ?? code;
}

// Team and roles screens (sprint 17). The API enforces every rule below; these helpers only keep
// the screens from offering what it would refuse.

/** projects_admin always holds every code and client is the portal's role: both are read only. */
export const RESERVED_ROLES: readonly string[] = ['projects_admin', 'client'];

export function isReservedRole(code: string): boolean {
  return RESERVED_ROLES.includes(code);
}

/** What the permission editor says next to a code with a consequence beyond its name. */
export const PERMISSION_NOTES: Partial<Record<PermissionCode, string>> = {
  'projects.projects.manage':
    'Lifts project membership: the person sees and changes every project, not only the ones they belong to. Only an administrator can give a role with it.',
  'projects.rbac.manage': 'Opens Team and Roles. Changing roles still needs an administrator.',
  'projects.portal.view': 'Client portal only. A role with it cannot hold any staff permission.',
};

/**
 * The selected code that grants code through implication (the module's manage, the full form of an
 * _own code, QA's run for QA view), or null. The editor shows such a code ticked and locked.
 */
export function lockedBy(code: string, selected: readonly string[]): string | null {
  for (const i of impliers(code)) {
    if (selected.includes(i)) return i;
  }
  return null;
}

/** Why a permission set cannot be saved, or null: the portal never sits beside staff codes. */
export function permissionSetProblem(codes: readonly string[]): string | null {
  if (codes.includes(PERMS.portalView) && codes.length > 1) {
    return 'Client portal access cannot sit beside staff permissions. Untick one or the other.';
  }
  return null;
}

/** A role's badge: a default role, the firm's customised copy of one, or the firm's own role. */
export function roleKind(role: { scope: string; is_customized: boolean; is_system_role?: boolean }): 'Default' | 'Customised' | 'Your role' {
  if (role.is_customized) return 'Customised';
  return role.scope === 'global' ? 'Default' : 'Your role';
}

/** Only the firm's own roles can be deleted (a customised default goes back to the default). */
export function roleDeletable(role: { scope: string; is_system_role: boolean; code: string }): boolean {
  return role.scope === 'tenant' && !role.is_system_role && !isReservedRole(role.code);
}

/** Groups registry entries by module in registry order, for the editor. */
export function groupByModule<T extends { module: string }>(perms: readonly T[]): { module: string; perms: T[] }[] {
  const out: { module: string; perms: T[] }[] = [];
  for (const p of perms) {
    const g = out.find((x) => x.module === p.module);
    if (g) g.perms.push(p);
    else out.push({ module: p.module, perms: [p] });
  }
  return out;
}

const MODULE_TITLES: Record<string, string> = {
  rbac: 'Team and roles',
  qa: 'QA and acceptance',
  change_requests: 'Change requests',
  change_approvals: 'Change approvals',
};

export function moduleTitle(module: string): string {
  const t = MODULE_TITLES[module];
  if (t) return t;
  const s = module.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The end of the chosen day (local time) as an ISO time, or null for no end date. */
export function endOfDayISO(date: string): string | null {
  return date ? new Date(`${date}T23:59:59`).toISOString() : null;
}

/** Where a held role stands now. */
export function assignmentState(a: { expires_at: string | null; expired: boolean }, now = Date.now()): 'running' | 'ending' | 'ended' {
  if (a.expired || (a.expires_at && new Date(a.expires_at).getTime() <= now)) return 'ended';
  return a.expires_at ? 'ending' : 'running';
}

/**
 * The roles a person can be given: never client, never one they already hold and that is still
 * running (an ended one can be given again), projects_admin only for an administrator.
 */
export function assignableRoles<T extends { code: string }>(
  roles: readonly T[],
  held: readonly { role_code: string; expired: boolean }[],
  adminTier: boolean,
): T[] {
  const running = new Set(held.filter((a) => !a.expired).map((a) => a.role_code));
  return roles.filter((r) => r.code !== 'client' && !running.has(r.code) && (adminTier || r.code !== 'projects_admin'));
}

/**
 * Whether the caller is an administrator for role changes, as projects-api's admin tier: platform
 * owner, superuser or admin global role, or the projects_admin role.
 */
export function isAdminTier(p: { is_platform_owner?: boolean; global_roles?: string[]; roles?: string[] } | null | undefined, bypass = false): boolean {
  if (!p) return bypass;
  if (bypass || p.is_platform_owner) return true;
  const global = (p.global_roles ?? []).map((g) => g.trim().toLowerCase());
  if (global.includes('admin') || global.includes('superuser')) return true;
  return (p.roles ?? []).includes('projects_admin');
}

const AUDIT_LABELS: Record<string, string> = {
  'role.created': 'Created a role',
  'role.cloned': 'Copied a role',
  'role.customized': 'Customised a default role',
  'role.updated': 'Renamed a role',
  'role.deleted': 'Deleted a role',
  'role.permissions_updated': 'Changed permissions',
  'role.assigned': 'Gave a role',
  'role.revoked': 'Took a role away',
  'user.invited': 'Invited a person',
  'user.deactivated': 'Deactivated a person',
  'user.reactivated': 'Reactivated a person',
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

/** The role or person a change was about, read from its own details. */
export function auditSubject(changes: Record<string, unknown> | null | undefined): string {
  if (!changes) return '';
  const pick = (k: string) => (typeof changes[k] === 'string' ? (changes[k] as string) : '');
  return pick('name') || pick('email') || (pick('role_code') ? roleName(pick('role_code')) : '') || pick('status');
}

/**
 * A project team member's label (projects-api members.Roles): owner and manager lead the project and
 * hear about a client's milestone decisions. What anyone may do comes from their projects role.
 */
export const PROJECT_MEMBER_ROLES: readonly { value: string; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Leads the project; told about client decisions' },
  { value: 'manager', label: 'Manager', description: 'Runs the project day to day; told about client decisions' },
  { value: 'member', label: 'Member', description: 'Works on the project' },
  { value: 'viewer', label: 'Viewer', description: 'Follows the project' },
];

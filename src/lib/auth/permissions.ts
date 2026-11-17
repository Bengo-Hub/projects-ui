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
];
const MEMBER: string[] = [
  PERMS.projectsView, PERMS.tasksView, PERMS.tasksAdd, PERMS.tasksChangeOwn,
  PERMS.milestonesView, PERMS.membersView, PERMS.commentsView, PERMS.commentsAdd, PERMS.commentsChangeOwn, PERMS.commentsDeleteOwn,
  PERMS.tendersView, PERMS.timeViewOwn, PERMS.timeAdd, PERMS.qaRun,
];
const VIEWER: string[] = [
  PERMS.projectsView, PERMS.tasksView, PERMS.milestonesView, PERMS.membersView, PERMS.commentsView, PERMS.tendersView, PERMS.qaView,
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

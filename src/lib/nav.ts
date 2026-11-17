import { ClipboardCheck, Clock, FileText, FolderKanban, KeyRound, LayoutDashboard, ListTodo, PieChart, ShieldCheck, Stamp, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { PERMS } from '@/lib/auth/permissions';

export interface NavItem {
  label: string;
  /** Path under /{orgSlug}. */
  path: string;
  icon: LucideIcon;
  /** Short label for the phone bottom bar. */
  shortLabel?: string;
  /** Subscription feature code: shows an upgrade lock when the tenant's plan lacks it. */
  subFeature?: 'project_management' | 'budget_tracking' | 'task_tracking' | 'workload_planning';
  /** Plan features that must all be on, else the item is hidden rather than locked. */
  requiresFeatures?: readonly HiddenFeature[];
  /** Hidden unless the user holds one of these projects permissions (service auth/me). */
  permission?: readonly string[];
  /** Platform owner only. */
  platformOnly?: boolean;
  /** Shown in the phone bottom bar. */
  bottomNav?: boolean;
}

/**
 * Features that hide an item when off. Time needs ERP's attendance too, since the hours land on
 * ERP timesheets; a lock there would promise something the projects plan alone cannot open.
 */
export type HiddenFeature = 'time_tracking' | 'attendance';

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Dashboard', shortLabel: 'Home', path: '/dashboard', icon: LayoutDashboard, bottomNav: true },
      { label: 'My work', path: '/my-work', icon: ListTodo, subFeature: 'task_tracking', permission: [PERMS.tasksView, PERMS.tasksViewOwn], bottomNav: true },
      // Sprint 16. Off the phone bar (four tabs and More fit 390 px); both sit in More.
      { label: 'Workload', path: '/workload', icon: Users, subFeature: 'workload_planning', permission: [PERMS.workloadView] },
      { label: 'Approvals', path: '/approvals', icon: Stamp, subFeature: 'project_management', permission: [PERMS.changeApprovals] },
      { label: 'Projects', path: '/projects', icon: FolderKanban, subFeature: 'project_management', permission: [PERMS.projectsView], bottomNav: true },
      // Before Portfolio: the phone bar holds four tabs, so with Time on it Portfolio moves to More.
      { label: 'Time', path: '/time', icon: Clock, requiresFeatures: ['time_tracking', 'attendance'], permission: [PERMS.timeViewOwn], bottomNav: true },
      { label: 'Portfolio', path: '/portfolio', icon: PieChart, subFeature: 'budget_tracking', permission: [PERMS.financialsView], bottomNav: true },
    ],
  },
  {
    label: 'Bids and delivery',
    items: [
      // Off the phone bar since My work joined it (four tabs and More fit 390 px); still in More.
      { label: 'Tenders', path: '/tenders', icon: FileText, subFeature: 'project_management', permission: [PERMS.tendersView] },
      { label: 'Acceptance', path: '/qa', icon: ClipboardCheck, subFeature: 'project_management', permission: [PERMS.qaView] },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Team', path: '/settings/team', icon: UsersRound, permission: [PERMS.rbacManage] },
      { label: 'Roles and access', path: '/settings/roles', icon: ShieldCheck, permission: [PERMS.rbacManage] },
    ],
  },
  {
    label: 'Platform',
    items: [{ label: 'Security keys', path: '/platform/security', icon: KeyRound, platformOnly: true }],
  },
];

export interface NavAccess {
  /** Whether the user holds any of the codes (implications and bypass included). */
  can: (codes: readonly string[]) => boolean;
  isPlatformOwner: boolean;
  /** Whether a plan feature is on; items with requiresFeatures stay hidden without it. */
  hasFeature?: (code: HiddenFeature) => boolean;
}

/** The phone bar's tabs at most (four and More fit 390 px). */
export const BOTTOM_NAV_MAX = 4;

export function itemVisible(item: NavItem, access: NavAccess): boolean {
  if (item.requiresFeatures && !item.requiresFeatures.every((f) => access.hasFeature?.(f) ?? false)) return false;
  if (item.permission && !access.can(item.permission)) return false;
  if (item.platformOnly && !access.isPlatformOwner) return false;
  return true;
}

/** The groups and items this user may see; empty groups are dropped. */
export function visibleNav(access: NavAccess): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => itemVisible(i, access)) })).filter((g) => g.items.length > 0);
}

/** Whether a nav path owns the current path after /{orgSlug}. */
export function navPathActive(path: string, pathAfterSlug: string): boolean {
  return pathAfterSlug === path || pathAfterSlug.startsWith(`${path}/`);
}

/** The nav entry that owns a path (longest matching prefix), used for the phone header title. */
export function navItemFor(pathAfterSlug: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const g of NAV) {
    for (const i of g.items) {
      if (navPathActive(i.path, pathAfterSlug) && (!best || i.path.length > best.path.length)) best = i;
    }
  }
  return best;
}

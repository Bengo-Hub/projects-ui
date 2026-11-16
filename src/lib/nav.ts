import { ClipboardCheck, FileText, FolderKanban, KeyRound, LayoutDashboard, PieChart, ShieldCheck, type LucideIcon } from 'lucide-react';
import { PERMS } from '@/lib/auth/permissions';

export interface NavItem {
  label: string;
  /** Path under /{orgSlug}. */
  path: string;
  icon: LucideIcon;
  /** Short label for the phone bottom bar. */
  shortLabel?: string;
  /** Subscription feature code: shows an upgrade lock when the tenant's plan lacks it. */
  subFeature?: 'project_management' | 'budget_tracking';
  /** Hidden unless the user holds one of these projects permissions (service auth/me). */
  permission?: readonly string[];
  /** Platform owner only. */
  platformOnly?: boolean;
  /** Shown in the phone bottom bar. */
  bottomNav?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { label: 'Dashboard', shortLabel: 'Home', path: '/dashboard', icon: LayoutDashboard, bottomNav: true },
      { label: 'Projects', path: '/projects', icon: FolderKanban, subFeature: 'project_management', permission: [PERMS.projectsView], bottomNav: true },
      { label: 'Portfolio', path: '/portfolio', icon: PieChart, subFeature: 'budget_tracking', permission: [PERMS.financialsView], bottomNav: true },
    ],
  },
  {
    label: 'Bids and delivery',
    items: [
      { label: 'Tenders', path: '/tenders', icon: FileText, subFeature: 'project_management', permission: [PERMS.tendersView], bottomNav: true },
      { label: 'Acceptance', path: '/qa', icon: ClipboardCheck, subFeature: 'project_management', permission: [PERMS.qaView] },
    ],
  },
  {
    label: 'Settings',
    items: [{ label: 'Roles and access', path: '/settings/roles', icon: ShieldCheck, permission: [PERMS.rbacManage] }],
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
}

export function itemVisible(item: NavItem, access: NavAccess): boolean {
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Lock, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';
import { useMe } from '@/hooks/useMe';
import { useQAPermissions } from '@/hooks/useQA';
import { navPathActive, visibleNav, type NavGroup, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Which plan features are on. Exempt tenants (platform owner, demo) read every feature as on. */
export function useNavFeatures(): Record<NonNullable<NavItem['subFeature']>, boolean> {
  // The projects workspace (Projects, Tenders, Acceptance) is gated behind `project_management`.
  const project_management = useFeature('project_management');
  const budget_tracking = useFeature('budget_tracking');
  return { project_management, budget_tracking };
}

/** The nav groups this user may see. */
export function useVisibleNav(): NavGroup[] {
  const { canView: canViewQA } = useQAPermissions();
  const { user } = useMe();
  return visibleNav({ canViewQA, isPlatformOwner: !!user?.isPlatformOwner });
}

function ItemLink({
  item,
  orgSlug,
  active,
  locked,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  orgSlug: string;
  active: boolean;
  locked: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  if (locked) {
    return (
      <a
        href={UPGRADE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? `${item.label}: upgrade to unlock` : 'Upgrade to unlock the projects workspace'}
        aria-label={collapsed ? `${item.label}, upgrade to unlock` : undefined}
        className={cn(
          'flex items-center rounded-lg text-sm text-sidebar-muted/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-muted',
          collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-10 gap-3 px-3',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-warning/20 bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Pro
            </span>
          </>
        )}
      </a>
    );
  }
  return (
    <Link
      href={`/${orgSlug}${item.path}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm transition-colors',
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-10 gap-3 px-3',
        active
          ? 'bg-primary font-semibold text-primary-foreground'
          : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NavTree({ orgSlug, collapsed, onNavigate }: { orgSlug: string; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const sub = pathname.slice(orgSlug.length + 1) || '/';
  const groups = useVisibleNav();
  const enabled = useNavFeatures();

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-hide" aria-label="Main">
      {groups.map((g) => (
        <div key={g.label} className={cn(collapsed && 'border-b border-sidebar-border/60 pb-3 last:border-0')}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted/80">{g.label}</p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.path}>
                <ItemLink
                  item={i}
                  orgSlug={orgSlug}
                  active={navPathActive(i.path, sub)}
                  locked={!!i.subFeature && !enabled[i.subFeature]}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ orgSlug, collapsed }: { orgSlug: string; collapsed: boolean }) {
  return (
    <Link
      href={`/${orgSlug}/dashboard`}
      className={cn('flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 sm:h-16', collapsed && 'justify-center px-0')}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-semibold text-primary-foreground" aria-hidden>
        P
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-semibold text-sidebar-foreground">Projects</span>
          <span className="block truncate text-[11px] text-sidebar-muted">{orgSlug}</span>
        </span>
      )}
    </Link>
  );
}

/** Desktop sidebar (lg and up, collapsible) plus the phone and tablet drawer. */
export default function Sidebar({
  orgSlug,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileOpenChange,
}: {
  orgSlug: string;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <aside
        data-testid="desktop-sidebar"
        className={cn(
          'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex',
          collapsed ? 'w-18' : 'w-64',
        )}
      >
        <Brand orgSlug={orgSlug} collapsed={collapsed} />
        <NavTree orgSlug={orgSlug} collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : undefined}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-11 items-center justify-center gap-2 border-t border-sidebar-border text-xs text-sidebar-muted hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <><PanelLeftClose className="h-4 w-4" aria-hidden /> Collapse</>}
        </button>
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar pt-safe pb-safe text-sidebar-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <div className="relative">
              <Brand orgSlug={orgSlug} collapsed={false} />
              <Dialog.Close
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>
            <NavTree orgSlug={orgSlug} collapsed={false} onNavigate={() => onMobileOpenChange(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

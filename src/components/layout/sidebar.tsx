'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, FileText, LayoutDashboard, ChevronRight, Lock, PieChart, Clock } from 'lucide-react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { cn } from '@/lib/utils';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Subscription feature code — shows an upgrade lock badge when not in the tenant's plan. */
  subFeature?: string;
}

const navItems: NavItem[] = [
  { href: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: 'projects', label: 'Projects', icon: FolderKanban, subFeature: 'project_management' },
  { href: 'portfolio', label: 'Portfolio', icon: PieChart, subFeature: 'budget_tracking' },
  { href: 'time', label: 'Time', icon: Clock, subFeature: 'budget_tracking' },
  { href: 'tenders', label: 'Tenders', icon: FileText, subFeature: 'project_management' },
];

interface SidebarProps {
  orgSlug: string;
}

export default function Sidebar({ orgSlug }: SidebarProps) {
  const pathname = usePathname();
  // The whole projects workspace (Projects + Tenders) is gated behind `project_management`.
  // Exempt tenants (platform owner / demo / service_charge) read this as enabled.
  const hasProjectManagement = useFeature('project_management');
  const hasBudgetTracking = useFeature('budget_tracking');
  const enabled: Record<string, boolean> = {
    project_management: hasProjectManagement,
    budget_tracking: hasBudgetTracking,
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0 print:hidden">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-primary">Projects</h1>
        <p className="text-xs text-muted-foreground truncate">{orgSlug}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, subFeature }) => {
          const fullHref = `/${orgSlug}/${href}`;
          const active = pathname.startsWith(fullHref);
          const locked = !!subFeature && !enabled[subFeature];

          if (locked) {
            return (
              <a
                key={href}
                href={`${UPGRADE_URL}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/40 transition-colors"
                title="Upgrade to unlock the projects workspace"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-60" />
                <span className="flex-1">{label}</span>
                <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 border border-amber-500/20 shrink-0">
                  <Lock className="h-2.5 w-2.5" />
                  Pro
                </span>
              </a>
            );
          }

          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-4 w-4" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

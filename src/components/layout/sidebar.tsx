'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, FileText, LayoutDashboard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: 'projects', label: 'Projects', icon: FolderKanban },
  { href: 'tenders', label: 'Tenders', icon: FileText },
];

interface SidebarProps {
  orgSlug: string;
}

export default function Sidebar({ orgSlug }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-primary">Projects</h1>
        <p className="text-xs text-muted-foreground truncate">{orgSlug}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const fullHref = `/${orgSlug}/${href}`;
          const active = pathname.startsWith(fullHref);
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

/** Sessions and Templates, the two sections of the Acceptance area. */
export function QANav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? '';
  const templates = pathname.startsWith(`/${orgSlug}/qa/templates`);
  const items = [
    { href: `/${orgSlug}/qa`, label: 'Sessions', active: !templates },
    { href: `/${orgSlug}/qa/templates`, label: 'Templates', active: templates },
  ];
  return (
    <nav aria-label="Acceptance sections" className="flex gap-1 border-b border-border">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 items-center px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            i.active ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Shown in place of a QA page when the user lacks the permission it needs. */
export function QANoAccess({ permission }: { permission: string }) {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You do not have access to acceptance testing"
      description={`Ask an administrator for the ${permission} permission.`}
    />
  );
}

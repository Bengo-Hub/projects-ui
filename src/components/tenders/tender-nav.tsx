'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** The tender's pages: overview, sections, submissions, documents, committees and evaluations. */
export function TenderNav({ orgSlug, tenderId }: { orgSlug: string; tenderId: string }) {
  const pathname = usePathname();
  const base = `/${orgSlug}/tenders/${tenderId}`;
  const items = [
    { href: base, label: 'Overview' },
    { href: `${base}/sections`, label: 'Sections' },
    { href: `${base}/submissions`, label: 'Submissions' },
    { href: `${base}/documents`, label: 'Documents' },
    { href: `${base}/committees`, label: 'Committees' },
    { href: `${base}/evaluations`, label: 'Evaluations' },
  ];
  return (
    <nav aria-label="Tender" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:px-0">
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:min-h-0',
              active ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

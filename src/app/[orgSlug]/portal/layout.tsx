'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { PortalAuthProvider } from '@/providers/portal-auth-provider';
import { PortalHeader } from '@/components/portal/portal-header';

/**
 * The client portal: no staff shell, sidebar or bottom bar, just the firm's header over a narrow,
 * phone first column. The org layout keeps the tenant branding and the query client and leaves
 * the staff session out (isPortalPath).
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  return (
    <div className="min-h-dvh bg-background">
      <PortalHeader orgSlug={orgSlug} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5">
        <PortalAuthProvider orgSlug={orgSlug}>{children}</PortalAuthProvider>
      </main>
    </div>
  );
}

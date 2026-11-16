'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { SubscriptionProvider } from '@bengo-hub/shared-ui-lib/subscription';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ConsoleShell } from '@/components/layout/console-shell';
import { useSubscription } from '@/hooks/use-subscription';

function OrgShell({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const entitlements = useSubscription();
  return (
    <SubscriptionProvider value={entitlements}>
      <ConsoleShell orgSlug={orgSlug}>{children}</ConsoleShell>
    </SubscriptionProvider>
  );
}

export default function OrgLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';

  return (
    <QueryProvider>
      <AuthProvider>
        <OrgShell orgSlug={orgSlug}>{children}</OrgShell>
      </AuthProvider>
    </QueryProvider>
  );
}

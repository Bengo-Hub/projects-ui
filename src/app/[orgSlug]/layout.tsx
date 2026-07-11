'use client';

import { type ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import { SubscriptionProvider } from '@bengo-hub/shared-ui-lib/subscription';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { PlatformScopeGuard } from '@/components/layout/platform-scope-guard';
import { SubscriptionBanner } from '@/components/subscription/subscription-banner';
import { VerifyEmailPrompt } from '@/components/auth/VerifyEmailPrompt';
import { useSubscription } from '@/hooks/use-subscription';

function OrgShell({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const entitlements = useSubscription();

  return (
    <SubscriptionProvider value={entitlements}>
      <PlatformScopeGuard />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar orgSlug={orgSlug} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header orgSlug={orgSlug} />
          <SubscriptionBanner />
          <VerifyEmailPrompt />
          <main className="flex-1 overflow-y-auto p-6 bg-accent/5">
            {children}
          </main>
        </div>
      </div>
    </SubscriptionProvider>
  );
}

export default function OrgLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const [_sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <QueryProvider>
      <AuthProvider>
        <OrgShell orgSlug={orgSlug}>{children}</OrgShell>
      </AuthProvider>
    </QueryProvider>
  );
}

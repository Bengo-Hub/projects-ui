'use client';

import { type ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import { PlanServiceLock, SubscriptionProvider } from '@bengo-hub/shared-ui-lib/subscription';
import { useAuthStore } from '@/store/auth';
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
  const session = useAuthStore((s) => s.session);

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
            {/* A plan without projects shows the upgrade card instead of a bare 403. */}
            <PlanServiceLock
              serviceTag="projects"
              accessToken={session?.accessToken}
              upgradeBaseUrl={process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL}
            >
              {children}
            </PlanServiceLock>
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

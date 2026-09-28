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
      {/* print: variants let a page (the status report) print as one flowing document. */}
      <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
        <Sidebar orgSlug={orgSlug} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
          <Header orgSlug={orgSlug} />
          <div className="print:hidden">
            <SubscriptionBanner />
            <VerifyEmailPrompt />
          </div>
          <main className="flex-1 overflow-y-auto p-6 bg-accent/5 print:overflow-visible print:p-0 print:bg-white">
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

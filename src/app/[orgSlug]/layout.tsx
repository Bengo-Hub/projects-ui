'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { SubscriptionProvider } from '@bengo-hub/shared-ui-lib/subscription';
import { TenantBrandingProvider } from '@bengo-hub/shared-ui-lib/tenant';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ConsoleShell } from '@/components/layout/console-shell';
import { useSubscription } from '@/hooks/use-subscription';

const SSO_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexafrica.com';

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
      {/* SSO guide step 6: the tenant's brand from auth-api by slug, cached 6 hours. Its colours
          drive --primary and the brand tokens; logo and name are read by the sidebar. Branding is
          edited in the accounts site only. */}
      <TenantBrandingProvider slug={orgSlug} authApiBase={SSO_URL} defaultPrimaryColor="#2563eb" defaultSecondaryColor="#1e3a8a">
        <AuthProvider>
          <OrgShell orgSlug={orgSlug}>{children}</OrgShell>
        </AuthProvider>
      </TenantBrandingProvider>
    </QueryProvider>
  );
}

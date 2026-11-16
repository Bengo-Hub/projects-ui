'use client';

import { useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';

/**
 * Page guard on the projects service permissions: renders the page when the user holds any of the
 * codes, otherwise sends them to /{orgSlug}/unauthorized before any of the page's queries run.
 */
export function RequirePermission({ anyOf, children }: { anyOf: string | readonly string[]; children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const { can, isLoading, isError, profile } = useServicePermissions();
  const allowed = can(anyOf);
  const decided = !isLoading && !!profile;

  useEffect(() => {
    if (decided && !allowed && orgSlug) router.replace(`/${orgSlug}/unauthorized`);
  }, [decided, allowed, orgSlug, router]);

  if (isError && !profile) return <ErrorBanner message="Your access to this page could not be checked. Reload to try again." />;
  if (!decided || !allowed) return <PageLoading />;
  return <>{children}</>;
}

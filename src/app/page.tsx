'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

/**
 * Bare root. There is no tenant in the URL here, so a signed-in user goes to their own tenant's
 * dashboard (the slug comes from the saved profile). Anyone else starts SSO for the tenant they
 * last used, or the platform tenant when nothing is remembered; SSO then sends them to the
 * tenant they belong to.
 */
const FALLBACK_TENANT = 'codevertex';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const { session, user, redirectToSSO } = useAuthStore.getState();
    const signedInSlug = session && user?.tenant_slug ? user.tenant_slug : '';
    if (signedInSlug) {
      router.replace(`/${signedInSlug}/dashboard`);
      return;
    }
    let slug = FALLBACK_TENANT;
    try {
      const stored = localStorage.getItem('tenantSlug');
      if (stored && stored.trim()) slug = stored.trim();
    } catch {
      /* storage blocked */
    }
    void redirectToSSO(slug, `${window.location.origin}/${slug}/dashboard`);
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="animate-pulse text-sm text-muted-foreground">Loading</p>
    </div>
  );
}

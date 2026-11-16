'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { AUTH_STORAGE_KEY } from '@/lib/auth/token-refresh';
import { watchSessionAcrossTabs } from '@bengo-hub/shared-ui-lib/auth';
import { toast } from 'sonner';
import { UPGRADE_URL } from '@/components/subscription/subscription-banner';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initialize, status, logout } = useAuthStore();
  const session = useAuthStore((s) => s.session);
  const qc = useQueryClient();
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = params?.orgSlug as string | undefined;

  // `ready` = initialize() has restored any saved session. Deciding to go to SSO before that sent
  // every full page load through a sign-in round trip, each one opening a new 30-day SSO session.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    initialize().finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [initialize]);

  // Another tab renewed or replaced the session: load it here and point the API client at the
  // new token, so this tab neither sends a rotated-away token nor writes its stale copy back.
  useEffect(
    () =>
      watchSessionAcrossTabs(AUTH_STORAGE_KEY, () => {
        void Promise.resolve(useAuthStore.persist.rehydrate()).then(() => {
          const token = useAuthStore.getState().session?.accessToken;
          if (token) apiClient.setAccessToken(token);
        });
      }),
    [],
  );

  useEffect(() => {
    apiClient.setOn401(() => {
      const { status: s, lastAuthenticatedAt } = useAuthStore.getState();
      if (s === 'syncing' || s === 'loading') return;
      if (lastAuthenticatedAt && Date.now() - lastAuthenticatedAt < 15_000) return;
      qc.clear();
      void logout();
    });
    return () => apiClient.setOn401(null);
  }, [qc, logout]);

  // A subscription 403 (upgrade:true) is never a sign-out or the unauthorized page: it says what
  // the plan lacks and links to the plans (SSO guide, Frontend 403 Discrimination).
  useEffect(() => {
    apiClient.setOnSubscription403((data) => {
      const body = data as { code?: string } | undefined;
      const message =
        body?.code === 'feature_not_available'
          ? 'Your plan does not include this feature. Upgrade to use it.'
          : 'Your subscription is not active. Renew it to keep saving changes.';
      toast.error(message, {
        id: 'subscription-403',
        action: { label: 'See plans', onClick: () => window.open(UPGRADE_URL, '_blank', 'noopener,noreferrer') },
      });
    });
    return () => apiClient.setOnSubscription403(null);
  }, []);

  useEffect(() => {
    const isAuthPath = pathname?.includes('/auth');
    if (ready && status === 'idle' && !isAuthPath && orgSlug) {
      void useAuthStore.getState().redirectToSSO(orgSlug, window.location.href);
    }
  }, [ready, status, pathname, orgSlug]);

  const isAuthCallback = pathname?.includes('/auth');
  // !ready: child effects run before this provider's, so rendering pages before initialize() has set
  // the token sent their first requests with no token (401, then a retry). 'idle' means no session
  // and a redirect to sign-in is on its way, so pages are not rendered then either.
  const isLoading = (!ready || status === 'idle' || status === 'loading' || (!!session && status === 'syncing')) && !isAuthCallback;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing session...</div>
      </div>
    );
  }

  return <>{children}</>;
}

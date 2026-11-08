'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';

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

  useEffect(() => {
    const isAuthPath = pathname?.includes('/auth');
    if (ready && status === 'idle' && !isAuthPath && orgSlug) {
      void useAuthStore.getState().redirectToSSO(orgSlug, window.location.href);
    }
  }, [ready, status, pathname, orgSlug]);

  const isAuthCallback = pathname?.includes('/auth');
  // !ready: child effects run before this provider's, so rendering pages before initialize() has set
  // the token sent their first requests with no token (401, then a retry).
  const isLoading = (!ready || status === 'loading' || (!!session && status === 'syncing')) && !isAuthCallback;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing session...</div>
      </div>
    );
  }

  return <>{children}</>;
}

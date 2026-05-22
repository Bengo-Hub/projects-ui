'use client';

import { useEffect, type ReactNode } from 'react';
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

  useEffect(() => {
    initialize();
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
    if (status === 'idle' && !isAuthPath && orgSlug) {
      void useAuthStore.getState().redirectToSSO(orgSlug, window.location.href);
    }
  }, [status, pathname, orgSlug]);

  const isAuthCallback = pathname?.includes('/auth');
  const isLoading = (status === 'loading' || (!!session && status === 'syncing')) && !isAuthCallback;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing session...</div>
      </div>
    );
  }

  return <>{children}</>;
}

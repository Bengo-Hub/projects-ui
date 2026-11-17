'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { watchSessionAcrossTabs } from '@bengo-hub/shared-ui-lib/auth';
import { setPortalOnUnauthorized, setPortalToken } from '@/lib/api/portal';
import { PORTAL_AUTH_STORAGE_KEY, portalBase } from '@/lib/portal/logic';
import { usePortalAuthStore } from '@/store/portal-auth';

/**
 * The portal's session gate, the counterpart of AuthProvider for the staff app: restores the saved
 * portal session, follows another tab's renewal, and sends a signed-out visitor to the firm's
 * branded sign-in with the projects-portal client. The callback page renders without it.
 */
export function PortalAuthProvider({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const status = usePortalAuthStore((s) => s.status);
  const initialize = usePortalAuthStore((s) => s.initialize);
  const message = usePortalAuthStore((s) => s.error);
  const qc = useQueryClient();
  const pathname = usePathname() ?? '';
  const isCallback = pathname.startsWith(`${portalBase(orgSlug)}/auth`);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    initialize().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [initialize]);

  useEffect(
    () =>
      watchSessionAcrossTabs(PORTAL_AUTH_STORAGE_KEY, () => {
        void Promise.resolve(usePortalAuthStore.persist.rehydrate()).then(() => {
          const token = usePortalAuthStore.getState().session?.accessToken;
          if (token) setPortalToken(token);
        });
      }),
    [],
  );

  useEffect(() => {
    setPortalOnUnauthorized(() => {
      const { status: s, lastAuthenticatedAt } = usePortalAuthStore.getState();
      if (s === 'syncing' || s === 'loading') return;
      if (lastAuthenticatedAt && Date.now() - lastAuthenticatedAt < 15_000) return;
      qc.removeQueries({ queryKey: ['portal'] });
      usePortalAuthStore.setState({ status: 'idle', session: null, user: null });
    });
    return () => setPortalOnUnauthorized(null);
  }, [qc]);

  useEffect(() => {
    if (ready && status === 'idle' && !isCallback && orgSlug) {
      void usePortalAuthStore.getState().redirectToSSO(orgSlug, window.location.href);
    }
  }, [ready, status, isCallback, orgSlug]);

  if (isCallback) return <>{children}</>;
  if (!ready || status === 'idle' || status === 'loading') {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <p className="animate-pulse text-sm text-muted-foreground">Opening your portal</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="text-sm text-muted-foreground">{message || 'Sign-in failed.'}</p>
        <button
          type="button"
          onClick={() => void usePortalAuthStore.getState().redirectToSSO(orgSlug)}
          className="mt-4 h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Sign in again
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

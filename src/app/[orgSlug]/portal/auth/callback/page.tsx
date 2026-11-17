'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { safePortalReturn } from '@/lib/portal/logic';
import { takePortalReturn, usePortalAuthStore } from '@/store/portal-auth';

/** The projects-portal OAuth callback: exchanges the code with the portal's own client id. */
function PortalCallback() {
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const code = search?.get('code');
  const state = search?.get('state') ?? null;
  const ssoError = search?.get('error_description') || search?.get('error');
  const status = usePortalAuthStore((s) => s.status);
  const error = usePortalAuthStore((s) => s.error);
  const handleCallback = usePortalAuthStore((s) => s.handleCallback);
  const started = useRef(false);

  useEffect(() => {
    if (code && orgSlug && !started.current) {
      started.current = true;
      void handleCallback(orgSlug, code, state);
    }
  }, [code, state, orgSlug, handleCallback]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(safePortalReturn(takePortalReturn(), orgSlug, window.location.origin));
    }
  }, [status, orgSlug, router]);

  if (ssoError || error || (!code && status !== 'syncing')) {
    return (
      <div className="mx-auto max-w-sm py-10 text-center">
        <h1 className="text-lg font-semibold">Sign-in did not finish</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ssoError || error || 'The sign-in link is incomplete.'}</p>
        <button
          type="button"
          onClick={() => void usePortalAuthStore.getState().redirectToSSO(orgSlug)}
          className="mt-6 h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <div className="py-16 text-center" aria-busy="true">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">Signing you in</p>
    </div>
  );
}

export default function PortalCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PortalCallback />
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { SSOCallbackError } from '@bengo-hub/shared-ui-lib/auth';
import { consumeState, consumeVerifier } from '@/lib/auth/pkce';
import { PORTAL_PKCE_NS, safePortalReturn } from '@/lib/portal/logic';
import { takePortalReturn, usePortalAuthStore } from '@/store/portal-auth';

/** The projects-portal OAuth callback: exchanges the code with the portal's own client id. */
function PortalCallback() {
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const code = search?.get('code');
  const ssoError = search?.get('error');
  const ssoErrorDescription = search?.get('error_description');
  const status = usePortalAuthStore((s) => s.status);
  const error = usePortalAuthStore((s) => s.error);
  const handleCallback = usePortalAuthStore((s) => s.handleCallback);
  const started = useRef(false);

  useEffect(() => {
    if (code && orgSlug && !started.current) {
      started.current = true;
      // The state sent with the portal's authorize request must come back unchanged (CSRF
      // binding), read from the portal's own PKCE namespace so a staff sign-in in the same tab is
      // never touched. It is checked whenever this tab still holds it; a missing verifier fails in
      // the store before any exchange.
      const returnedState = search?.get('state');
      const expectedState = consumeState(PORTAL_PKCE_NS);
      if (expectedState && returnedState !== expectedState) {
        // The verifier of a forged or stale callback is spent too, and the mismatch is recorded in
        // the portal store, which the error screen below reads.
        consumeVerifier(PORTAL_PKCE_NS);
        usePortalAuthStore.setState({ status: 'error', error: 'Sign-in session mismatch. Please try again.' });
        return;
      }
      void handleCallback(orgSlug, code);
    }
  }, [code, orgSlug, handleCallback, search]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(safePortalReturn(takePortalReturn(), orgSlug, window.location.origin));
    }
  }, [status, orgSlug, router]);

  if (ssoError || error || (!code && status !== 'syncing')) {
    return (
      <SSOCallbackError
        error={ssoError || 'auth_error'}
        errorDescription={ssoErrorDescription || error || (!ssoError && !code ? 'The sign-in link is incomplete.' : null)}
        orgSlug={orgSlug}
        onRetry={() => void usePortalAuthStore.getState().redirectToSSO(orgSlug)}
      />
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

'use client';

import { consumeState } from '@/lib/auth/pkce';
import { useAuthStore } from '@/store/auth';
import { SSOCallbackError } from '@bengo-hub/shared-ui-lib/auth';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const code = searchParams?.get('code');
  const error = searchParams?.get('error');
  const errorDescription = searchParams?.get('error_description');
  const { handleSSOCallback, status, error: authError } = useAuthStore();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (code && orgSlug && !hasStarted.current) {
      hasStarted.current = true;
      // The state sent with the authorize request must come back unchanged (CSRF binding). It is
      // checked whenever this tab still holds it; a missing verifier fails in the exchange itself.
      const returnedState = searchParams?.get('state');
      const expectedState = consumeState();
      if (expectedState && returnedState !== expectedState) {
        // Recorded in the auth store, which the error screen below reads.
        useAuthStore.setState({ status: 'error', error: 'Sign-in session mismatch. Please try again.' });
        return;
      }
      const callbackUrl = `${window.location.origin}/${orgSlug}/auth/callback`;
      void handleSSOCallback(orgSlug, code, callbackUrl);
    }
  }, [code, orgSlug, handleSSOCallback, searchParams]);

  useEffect(() => {
    if (status === 'authenticated') {
      const returnTo = sessionStorage.getItem('sso_return_to');
      sessionStorage.removeItem('sso_return_to');
      router.replace(returnTo || `/${orgSlug}/dashboard`);
    }
  }, [status, orgSlug, router]);

  if (error || authError) {
    const lastKnownTenant = typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null;
    return (
      <SSOCallbackError
        error={error || 'auth_error'}
        errorDescription={errorDescription || authError}
        orgSlug={orgSlug}
        lastKnownTenant={lastKnownTenant}
        onRetry={() => {
          void useAuthStore.getState().redirectToSSO(orgSlug, `${window.location.origin}/${orgSlug}/dashboard`);
        }}
        onSwitchTenant={(slug) => router.replace(`/${slug}`)}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <h1 className="text-xl font-medium">Completing sign-in</h1>
        <p className="text-muted-foreground">Syncing your profile and permissions.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

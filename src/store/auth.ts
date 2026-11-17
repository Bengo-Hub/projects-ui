import { apiClient } from '@/lib/api/client';
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  exchangeCodeForTokens,
  fetchProfile,
  revokeServerSession,
  type UserProfile,
} from '@/lib/auth/api';
import {
  consumeVerifier,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  storeState,
  storeVerifier,
} from '@/lib/auth/pkce';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'error' | 'syncing';
  user: UserProfile | null;
  session: Session | null;
  error: string | null;
  lastAuthenticatedAt: number | null;

  initialize: () => Promise<void>;
  redirectToSSO: (orgSlug: string, returnTo?: string) => Promise<void>;
  handleSSOCallback: (orgSlug: string, code: string, callbackUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      user: null,
      session: null,
      error: null,
      lastAuthenticatedAt: null,

      initialize: async () => {
        const { session, user } = get();
        if (!session) {
          set({ status: 'idle' });
          return;
        }

        apiClient.setAccessToken(session.accessToken);
        if (user) {
          apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
          apiClient.setPlatformOwner(user.isPlatformOwner);
        }

        if (user && session.expiresAt) {
          const expiresAt = new Date(session.expiresAt).getTime();
          if (Date.now() < expiresAt - 60_000) {
            set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
            return;
          }
        }

        set({ status: 'loading' });

        // Expired token on reload: renew it with the refresh token (one small call) instead of a
        // full SSO sign-in; a known profile is kept. Dynamic import: token-refresh imports this store.
        const expiringOnLoad = !session.expiresAt || Date.now() >= new Date(session.expiresAt).getTime() - 60_000;
        const renewedOnLoad = session.refreshToken && expiringOnLoad
          ? await (await import('@/lib/auth/token-refresh')).refreshAccessToken(session.accessToken)
          : null;
        if (renewedOnLoad) {
          apiClient.setAccessToken(renewedOnLoad);
          if (user) {
            set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
            return;
          }
        }
        try {
          // Pass the token: fetchProfile falls back to localStorage.accessToken, which this app never
          // sets, so without it /auth/me went out unauthenticated and the profile never loaded.
          const freshUser = await fetchProfile(renewedOnLoad ?? session.accessToken);
          apiClient.setTenantInfo(freshUser.tenant_id, freshUser.tenant_slug);
          apiClient.setPlatformOwner(freshUser.isPlatformOwner);
          set({ user: freshUser, status: 'authenticated', lastAuthenticatedAt: Date.now() });
        } catch {
          set({ status: 'idle', session: null, user: null });
        }
      },

      redirectToSSO: async (orgSlug: string, returnTo?: string) => {
        set({ status: 'loading', error: null });
        try {
          const verifier = generateCodeVerifier();
          const challenge = await generateCodeChallenge(verifier);
          const state = generateState();

          storeVerifier(verifier);
          storeState(state);

          if (returnTo && typeof window !== 'undefined') {
            sessionStorage.setItem('sso_return_to', returnTo);
          }

          const callbackUrl = `${window.location.origin}/${orgSlug}/auth/callback`;
          const authorizeUrl = buildAuthorizeUrl({
            codeChallenge: challenge,
            state,
            redirectUri: callbackUrl,
            tenant: orgSlug,
          });

          window.location.href = authorizeUrl;
        } catch {
          set({ status: 'error', error: 'Failed to start sign-in' });
        }
      },

      handleSSOCallback: async (orgSlug: string, code: string, callbackUrl: string) => {
        set({ status: 'syncing', error: null });
        const verifier = consumeVerifier();

        if (!verifier) {
          set({ status: 'error', error: 'Session expired' });
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens({
            code,
            codeVerifier: verifier,
            redirectUri: callbackUrl,
          });

          const session: Session = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || '',
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          };

          apiClient.setAccessToken(session.accessToken);
          set({ session });

          let attempts = 0;
          while (attempts < 5) {
            try {
              const user = await fetchProfile(session.accessToken);
              apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
              apiClient.setPlatformOwner(user.isPlatformOwner);
              if (typeof window !== 'undefined' && user.email) {
                localStorage.setItem('sso_last_email', user.email);
              }
              set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
              return;
            } catch {
              attempts++;
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
        } catch {
          set({ status: 'error', error: 'Sign-in failed' });
        }
      },

      logout: async () => {
        // SSO guide step 8. The firm comes first: the path's first segment (every tenant page is
        // /{orgSlug}/...), else the signed-in profile, so signing in again lands on the same
        // organisation. Then the SSO session is revoked on auth-api while the token is still known,
        // the store, the saved session, the tenant keys and the tab's sessionStorage are cleared,
        // and auth-api's logout sends the user back to the firm's own page. The client portal has
        // its own sign out (store/portal-auth.ts).
        let slug = '';
        if (typeof window !== 'undefined') {
          const first = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
          if (first && first !== 'auth') slug = first;
        }
        slug = slug || get().user?.tenant_slug || '';
        await revokeServerSession(get().session?.accessToken);

        set({ status: 'idle', user: null, session: null, lastAuthenticatedAt: null });
        apiClient.setAccessToken(null);
        apiClient.setTenantInfo(null, null);
        apiClient.setPlatformOwner(false);
        if (typeof window !== 'undefined') {
          for (const key of ['projects-auth-storage', 'tenantId', 'tenantSlug']) {
            try { localStorage.removeItem(key); } catch { /* storage blocked */ }
          }
          try { sessionStorage.clear(); } catch { /* storage blocked */ }
          window.location.href = buildLogoutUrl(slug ? `${window.location.origin}/${slug}` : window.location.origin);
        }
      },

      fetchUser: async () => {
        try {
          const user = await fetchProfile(get().session?.accessToken);
          set({ user });
        } catch {
          // silently fail
        }
      },
    }),
    {
      name: 'projects-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
      }),
    }
  )
);

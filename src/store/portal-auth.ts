import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  PORTAL_CLIENT_ID,
  buildAuthorizeUrl,
  buildLogoutUrl,
  exchangeCodeForTokens,
  fetchProfile,
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
import { setPortalTenant, setPortalToken } from '@/lib/api/portal';
import { PORTAL_AUTH_STORAGE_KEY, PORTAL_PKCE_NS, portalBase, portalCallbackUrl } from '@/lib/portal/logic';

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface PortalAuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'error' | 'syncing';
  user: UserProfile | null;
  session: Session | null;
  error: string | null;
  lastAuthenticatedAt: number | null;

  initialize: () => Promise<void>;
  redirectToSSO: (orgSlug: string, returnTo?: string) => Promise<void>;
  /** Exchanges the code; the callback page has already checked the PKCE state. */
  handleCallback: (orgSlug: string, code: string) => Promise<void>;
  logout: (orgSlug: string) => void;
}

const RETURN_KEY = `${PORTAL_PKCE_NS}return_to`;

function point(session: Session | null, user: UserProfile | null) {
  setPortalToken(session?.accessToken ?? null);
  setPortalTenant(user?.tenant_id || null, user?.tenant_slug || null);
}

/**
 * The client portal's sign-in, apart from the staff store (src/store/auth.ts): its own persisted
 * key, its own PKCE namespace and the projects-portal OAuth client. Signing out here leaves a staff
 * session in the same browser untouched, and the other way round.
 */
export const usePortalAuthStore = create<PortalAuthState>()(
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
        point(session, user);
        const expiring = !session.expiresAt || Date.now() >= new Date(session.expiresAt).getTime() - 60_000;
        if (user && !expiring) {
          set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
          return;
        }
        set({ status: 'loading' });
        // Dynamic import: the refresher imports this store.
        const renewed = session.refreshToken && expiring
          ? await (await import('@/lib/auth/portal-token-refresh')).refreshPortalToken(session.accessToken)
          : null;
        if (renewed) setPortalToken(renewed);
        if (renewed && user) {
          set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
          return;
        }
        if (expiring && !renewed) {
          set({ status: 'idle', session: null, user: null });
          return;
        }
        try {
          const fresh = await fetchProfile(renewed ?? session.accessToken);
          point(get().session, fresh);
          set({ user: fresh, status: 'authenticated', lastAuthenticatedAt: Date.now() });
        } catch {
          set({ status: 'idle', session: null, user: null });
        }
      },

      redirectToSSO: async (orgSlug, returnTo) => {
        set({ status: 'loading', error: null });
        try {
          const verifier = generateCodeVerifier();
          const challenge = await generateCodeChallenge(verifier);
          const state = generateState();
          storeVerifier(verifier, PORTAL_PKCE_NS);
          storeState(state, PORTAL_PKCE_NS);
          if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);
          window.location.href = buildAuthorizeUrl({
            codeChallenge: challenge,
            state,
            redirectUri: portalCallbackUrl(window.location.origin, orgSlug),
            tenant: orgSlug,
            clientId: PORTAL_CLIENT_ID,
          });
        } catch {
          set({ status: 'error', error: 'Sign-in could not start. Reload the page to try again.' });
        }
      },

      handleCallback: async (orgSlug, code) => {
        set({ status: 'syncing', error: null });
        const verifier = consumeVerifier(PORTAL_PKCE_NS);
        if (!verifier) {
          set({ status: 'error', error: 'This sign-in link has expired. Start again from the portal.' });
          return;
        }
        try {
          const tokens = await exchangeCodeForTokens({
            code,
            codeVerifier: verifier,
            redirectUri: portalCallbackUrl(window.location.origin, orgSlug),
            clientId: PORTAL_CLIENT_ID,
          });
          const session: Session = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || '',
            expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
          };
          point(session, null);
          set({ session });
          // JIT on auth-api can lag the first sign-in by a moment, so the profile gets a few tries.
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const user = await fetchProfile(session.accessToken);
              point(session, user);
              set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
              return;
            } catch {
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
          set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
        } catch {
          set({ status: 'error', error: 'Sign-in failed. Try again from the portal.' });
        }
      },

      logout: (orgSlug) => {
        set({ status: 'idle', user: null, session: null, lastAuthenticatedAt: null });
        point(null, null);
        if (typeof window === 'undefined') return;
        // Only the portal's own keys: a staff session in this browser stays signed in.
        try {
          localStorage.removeItem(PORTAL_AUTH_STORAGE_KEY);
        } catch {
          /* storage blocked */
        }
        for (const k of [RETURN_KEY, `${PORTAL_PKCE_NS}pkce_verifier`, `${PORTAL_PKCE_NS}pkce_state`]) {
          try {
            sessionStorage.removeItem(k);
          } catch {
            /* storage blocked */
          }
        }
        window.location.href = buildLogoutUrl(`${window.location.origin}${portalBase(orgSlug)}`);
      },
    }),
    {
      name: PORTAL_AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ session: s.session, user: s.user }),
    },
  ),
);

/** The saved return path for after sign-in (read once). */
export function takePortalReturn(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v;
  } catch {
    return null;
  }
}

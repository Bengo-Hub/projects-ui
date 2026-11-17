/**
 * Access-token refresh for the client portal: the same shared cross-tab refresher as the staff app
 * (token-refresh.ts), on the portal's own store key and with the projects-portal client id, so the
 * two sessions never trade tokens.
 */

import { createSessionRefresher } from '@bengo-hub/shared-ui-lib/auth';
import { usePortalAuthStore } from '@/store/portal-auth';
import { PORTAL_CLIENT_ID, refreshTokens } from '@/lib/auth/api';
import { PORTAL_AUTH_STORAGE_KEY } from '@/lib/portal/logic';

const refreshSession = createSessionRefresher({
  lockName: PORTAL_AUTH_STORAGE_KEY,
  getSession: () => usePortalAuthStore.getState().session,
  reloadSession: () => usePortalAuthStore.persist.rehydrate(),
  saveSession: (session) => usePortalAuthStore.setState({ session }),
  refresh: (refreshToken) => refreshTokens(refreshToken, PORTAL_CLIENT_ID),
});

/** A usable portal access token, or null when the portal session is over. */
export async function refreshPortalToken(failedToken?: string | null): Promise<string | null> {
  const outcome = await refreshSession(failedToken);
  return 'token' in outcome ? outcome.token : null;
}

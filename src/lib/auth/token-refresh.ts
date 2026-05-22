import { refreshTokens } from '@/lib/auth/api';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const { useAuthStore } = await import('@/store/auth');
  const { session } = useAuthStore.getState();
  if (!session?.refreshToken) return null;

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = doRefresh(session.refreshToken);

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function doRefresh(currentRefreshToken: string): Promise<string | null> {
  try {
    const { useAuthStore } = await import('@/store/auth');
    const data = await refreshTokens(currentRefreshToken);
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || currentRefreshToken;
    const expiresIn = data.expires_in || 3600;

    useAuthStore.setState({
      session: {
        ...useAuthStore.getState().session!,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    });

    return newAccessToken;
  } catch {
    return null;
  }
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchProfile, type UserProfile } from '@/lib/auth/api';
import { useAuthStore } from '@/store/auth';
import { useServicePermissions } from '@/hooks/usePermissions';

const ME_QUERY_KEY = ['auth', 'me'] as const;
const ME_STALE_MS = 5 * 60 * 1000;

/**
 * The SSO identity (auth-api GET /api/v1/auth/me): who the user is, their tenant and global roles.
 * Projects permissions are not in it; hasPermission reads them from useServicePermissions.
 */
export function useMe(enabled = true) {
  const accessToken = useAuthStore((s) => s.session?.accessToken);
  const { can } = useServicePermissions();

  const query = useQuery<UserProfile>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchProfile(accessToken ?? undefined),
    enabled: enabled && !!accessToken,
    staleTime: ME_STALE_MS,
    gcTime: ME_STALE_MS * 2,
    retry: (failureCount, error: unknown) => {
      const e = error as { response?: { status?: number } };
      if (e?.response?.status === 401 || e?.response?.status === 403) return false;
      return failureCount < 2;
    },
  });

  const user = query.data ?? null;
  const roles = user?.roles ?? [];

  /** A global auth-api role (superuser and admin hold every role). */
  const hasRole = (role: string) => roles.includes(role) || roles.includes('superuser') || roles.includes('admin');

  /** A projects.* permission from the service profile; superuser and platform owner pass. */
  const hasPermission = (permission: string) => can(permission);

  return { ...query, user, hasRole, hasPermission, isAuthenticated: !!user };
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchProfile, type UserProfile } from '@/lib/auth/api';
import { useAuthStore } from '@/store/auth';

const ME_QUERY_KEY = ['auth', 'me'] as const;
const ME_STALE_MS = 5 * 60 * 1000;

export function useMe(enabled = true) {
  const accessToken = useAuthStore((s) => s.session?.accessToken);

  const query = useQuery<UserProfile>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchProfile(accessToken ?? undefined),
    enabled,
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
  const permissions = user?.permissions ?? [];

  const hasRole = (role: string) =>
    roles.includes(role) || roles.includes('super_admin') || roles.includes('admin');

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (roles.includes('super_admin') || roles.includes('admin')) return true;
    return permissions.includes(permission);
  };

  return { ...query, user, hasRole, hasPermission, isAuthenticated: !!user };
}

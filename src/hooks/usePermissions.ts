'use client';

import { useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { rbacApi } from '@/lib/api/rbac';
import { httpStatusOf, isNotFound } from '@/lib/api/errors';
import { holdsAny, inferProfile, type PermissionSubject, type ServiceProfile } from '@/lib/auth/permissions';
import { useAuthStore } from '@/store/auth';

const STALE_MS = 5 * 60 * 1000;

export const SERVICE_ME_KEY = 'service-me';

/**
 * The projects layer of the profile (SSO guide step 4b): projects-api's GET /{tenant}/auth/me with
 * the service role and the projects.* codes. useMe stays the SSO identity; this hook is what the
 * sidebar, page guards and buttons read. A 404 (not provisioned yet) falls back to the role the
 * global roles map to, the same default projects-api gives on first sign-in.
 */
export function useServicePermissions() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const identity = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.session?.accessToken);
  const status = useAuthStore((s) => s.status);
  const enabled = !!orgSlug && !!token && status === 'authenticated';

  const query = useQuery<ServiceProfile & { inferred?: boolean }>({
    queryKey: [SERVICE_ME_KEY, orgSlug, identity?.id ?? ''],
    queryFn: async () => {
      try {
        return await rbacApi.me(orgSlug);
      } catch (err) {
        if (isNotFound(err) && identity) return { ...inferProfile(identity), inferred: true };
        throw err;
      }
    },
    enabled,
    staleTime: STALE_MS,
    gcTime: STALE_MS * 2,
    retry: (failureCount, err) => {
      const s = httpStatusOf(err);
      if (s === 401 || s === 403 || s === 404) return false;
      return failureCount < 2;
    },
  });

  const profile = query.data ?? null;
  const subject = useMemo<PermissionSubject | null>(() => {
    if (!profile) return null;
    // Superuser and platform owner pass every check, as in projects-api's access layer.
    const bypass = profile.is_platform_owner || !!identity?.isPlatformOwner || !!identity?.isSuperUser;
    return { permissions: profile.permissions ?? [], bypass };
  }, [profile, identity?.isPlatformOwner, identity?.isSuperUser]);

  /** Whether the user holds any of the codes. False until the profile has loaded. */
  const can = useCallback((codes: string | readonly string[]) => holdsAny(subject, codes), [subject]);

  return {
    profile,
    subject,
    can,
    serviceRole: profile?.service_role ?? '',
    isPlatformOwner: !!profile?.is_platform_owner || !!identity?.isPlatformOwner,
    /** True until the first answer; a disabled query (signed out) is not loading. */
    isLoading: enabled && query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

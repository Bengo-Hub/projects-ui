'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rbacApi } from '@/lib/api/rbac';
import { onMutationError } from '@/lib/api/errors';
import { roleName } from '@/lib/auth/permissions';
import { SERVICE_ME_KEY } from '@/hooks/usePermissions';

const KEY = 'rbac';

// Every route here needs projects.rbac.manage; callers pass enabled from that check.

export function useRbacRoles(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'roles'],
    queryFn: () => rbacApi.roles(orgSlug),
    enabled: enabled && !!orgSlug,
  });
}

export function useRbacUsers(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'users'],
    queryFn: () => rbacApi.users(orgSlug),
    enabled: enabled && !!orgSlug,
  });
}

function useInvalidateAccess(orgSlug: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
    // Holder counts and anyone's own profile may change with an assignment.
    void qc.invalidateQueries({ queryKey: [SERVICE_ME_KEY, orgSlug] });
  };
}

export function useAssignRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ userId, roleCode }: { userId: string; roleCode: string }) => rbacApi.assignRole(orgSlug, userId, roleCode),
    onSuccess: (_, { roleCode }) => {
      invalidate();
      toast.success(`${roleName(roleCode)} role given`);
    },
    onError: onMutationError('The role could not be given'),
  });
}

export function useRevokeRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ userId, roleCode }: { userId: string; roleCode: string }) => rbacApi.revokeRole(orgSlug, userId, roleCode),
    onSuccess: (_, { roleCode }) => {
      invalidate();
      toast.success(`${roleName(roleCode)} role removed`);
    },
    onError: onMutationError('The role could not be removed'),
  });
}

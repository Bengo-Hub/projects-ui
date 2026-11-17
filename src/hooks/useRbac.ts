'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rbacApi, type InviteInput, type RbacRole, type RoleInput, type UsersParams } from '@/lib/api/rbac';
import { onMutationError } from '@/lib/api/errors';
import { roleName } from '@/lib/auth/permissions';
import { SERVICE_ME_KEY } from '@/hooks/usePermissions';

const KEY = 'rbac';

// Every route here needs projects.rbac.manage; callers pass enabled from that check. Every
// mutation invalidates the whole ['rbac', org] tree and the service profile, since a role change
// may change the caller's own permissions too.

export function useRbacRoles(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'roles'],
    queryFn: () => rbacApi.roles(orgSlug),
    enabled: enabled && !!orgSlug,
  });
}

export function useRbacPermissions(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'permissions'],
    queryFn: () => rbacApi.permissions(orgSlug),
    enabled: enabled && !!orgSlug,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRolePermissionCodes(orgSlug: string, roleId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'role-permissions', roleId],
    queryFn: () => rbacApi.rolePermissions(orgSlug, roleId),
    enabled: !!orgSlug && !!roleId,
  });
}

export function useRbacUsers(orgSlug: string, params: UsersParams = {}, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'users', params],
    queryFn: () => rbacApi.users(orgSlug, params),
    enabled: enabled && !!orgSlug,
    placeholderData: keepPreviousData,
  });
}

export function useRbacUser(orgSlug: string, userId: string) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'user', userId],
    queryFn: () => rbacApi.user(orgSlug, userId),
    enabled: !!orgSlug && !!userId,
  });
}

/** The first page of staff for a picker (GET /people); more are found by searching. */
export function useStaffPeople(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'people'],
    queryFn: () => rbacApi.people(orgSlug, '', 50),
    enabled: enabled && !!orgSlug,
    staleTime: 60_000,
  });
}

export function useRoleChanges(orgSlug: string, page = 1, enabled = true) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'audit', page],
    queryFn: () => rbacApi.auditLogs(orgSlug, { page, limit: 20 }),
    enabled: enabled && !!orgSlug,
    placeholderData: keepPreviousData,
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
    mutationFn: ({ userId, roleCode, expiresAt = null }: { userId: string; roleCode: string; expiresAt?: string | null; label?: string }) =>
      rbacApi.assignRole(orgSlug, userId, roleCode, expiresAt),
    onSuccess: (_, { roleCode, label }) => {
      invalidate();
      toast.success(`${label || roleName(roleCode)} role given`);
    },
    onError: onMutationError('The role could not be given'),
  });
}

export function useRevokeRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ userId, roleCode }: { userId: string; roleCode: string; label?: string }) => rbacApi.revokeRole(orgSlug, userId, roleCode),
    onSuccess: (_, { roleCode, label }) => {
      invalidate();
      toast.success(`${label || roleName(roleCode)} role removed`);
    },
    onError: onMutationError('The role could not be removed'),
  });
}

export function useSetUserStatus(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'inactive' }) => rbacApi.setStatus(orgSlug, userId, status),
    onSuccess: (_, { status }) => {
      invalidate();
      toast.success(status === 'inactive' ? 'Person deactivated' : 'Person reactivated');
    },
    onError: onMutationError('Their access could not be changed'),
  });
}

export function useInvite(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: (input: InviteInput) => rbacApi.invite(orgSlug, input),
    onSuccess: (res) => {
      invalidate();
      toast.success(res.created ? `Invitation sent to ${res.email}` : `${res.email} added to projects`);
    },
    onError: onMutationError('This person could not be invited. Check the email and try again.'),
  });
}

export function useCreateRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ source, input }: { source: RbacRole | null; input: RoleInput }) =>
      source ? rbacApi.cloneRole(orgSlug, source.id, input) : rbacApi.createRole(orgSlug, { ...input, permission_codes: [] }),
    onSuccess: (_, { source }) => {
      invalidate();
      toast.success(source ? 'Role copied' : 'Role created. Choose what it can do.');
    },
    onError: onMutationError('The role could not be saved'),
  });
}

export function useUpdateRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: { name?: string; description?: string } }) => rbacApi.updateRole(orgSlug, roleId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Role saved');
    },
    onError: onMutationError('The role could not be saved'),
  });
}

export function useSetRolePermissions(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: ({ roleId, codes }: { roleId: string; codes: string[] }) => rbacApi.setRolePermissions(orgSlug, roleId, codes),
    onSuccess: (role, { roleId }) => {
      invalidate();
      toast.success(role.id !== roleId ? 'Saved as your own copy of this default role' : 'Permissions saved');
    },
    onError: onMutationError('The permissions could not be saved'),
  });
}

export function useDeleteRole(orgSlug: string) {
  const invalidate = useInvalidateAccess(orgSlug);
  return useMutation({
    mutationFn: (roleId: string) => rbacApi.deleteRole(orgSlug, roleId),
    onSuccess: () => {
      invalidate();
      toast.success('Role deleted');
    },
    onError: onMutationError('The role could not be deleted'),
  });
}

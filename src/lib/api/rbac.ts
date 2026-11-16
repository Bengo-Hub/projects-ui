import { apiClient } from './client';
import type { ServiceProfile } from '@/lib/auth/permissions';

/** A role as GET /rbac/roles lists it: rank order, with its codes and how many users hold it. */
export interface RbacRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  permissions: string[];
  holders: number;
}

/** A registry entry from GET /rbac/permissions. */
export interface RbacPermission {
  code: string;
  name: string;
  module: string;
  action: string;
}

/** A projects user from GET /rbac/users, keyed by the auth-api user id. */
export interface RbacUser {
  user_id: string;
  email?: string;
  name?: string;
  status: string;
  roles: string[];
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}`;
}

export const rbacApi = {
  /** The caller's projects role and effective permission codes (the second step of the profile). */
  me: (orgSlug: string) => apiClient.get<ServiceProfile>(`${base(orgSlug)}/auth/me`),
  roles: (orgSlug: string) =>
    apiClient.get<{ data: RbacRole[] }>(`${base(orgSlug)}/rbac/roles`).then((r) => r.data ?? []),
  permissions: (orgSlug: string) =>
    apiClient.get<{ data: RbacPermission[] }>(`${base(orgSlug)}/rbac/permissions`).then((r) => r.data ?? []),
  /** Up to 500 users (the API caps the limit there). */
  users: (orgSlug: string, limit = 500) =>
    apiClient.get<{ data: RbacUser[] }>(`${base(orgSlug)}/rbac/users`, { limit }).then((r) => r.data ?? []),
  assignRole: (orgSlug: string, authUserId: string, roleCode: string) =>
    apiClient.post<void>(`${base(orgSlug)}/rbac/users/${authUserId}/roles`, { role_code: roleCode }),
  revokeRole: (orgSlug: string, authUserId: string, roleCode: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/rbac/users/${authUserId}/roles/${encodeURIComponent(roleCode)}`),
};

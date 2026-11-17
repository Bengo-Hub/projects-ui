import { apiClient } from './client';
import type { ServiceProfile } from '@/lib/auth/permissions';
import type { PaginatedResponse } from '@/types';

/**
 * A role as GET /rbac/roles lists it, in rank order. scope is global for a default role and tenant
 * for the firm's own; is_customized marks the firm's copy of a default role (same code, new id).
 * holders counts active people whose role has not ended.
 */
export interface RbacRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  scope: 'global' | 'tenant';
  is_customized: boolean;
  permissions: string[];
  holders: number;
}

/** A registry entry from GET /rbac/permissions, with the codes that also grant it. */
export interface RbacPermission {
  code: string;
  name: string;
  module: string;
  action: string;
  implied_by: string[];
}

/** One role a person holds or held. automatic: the default role sign-in gave them. */
export interface RbacAssignment {
  role_id: string;
  role_code: string;
  name: string;
  assigned_at: string;
  expires_at: string | null;
  expired: boolean;
  automatic: boolean;
}

/** A person from GET /rbac/users, keyed by the auth-api user id. roles holds only running roles. */
export interface RbacUser {
  user_id: string;
  email?: string;
  name?: string;
  status: 'active' | 'inactive' | string;
  deactivated_at?: string;
  last_seen_at?: string;
  roles: string[];
  assignments: RbacAssignment[];
}

/** One person with their effective permissions (GET /rbac/users/{id}). */
export interface RbacUserDetail extends RbacUser {
  permissions: string[];
}

/** A role or access change (GET /rbac/audit-logs). */
export interface RbacAuditLog {
  id: string;
  actor_user_id: string;
  actor_email?: string;
  action: string;
  resource_type: 'role' | 'user' | string;
  resource_id: string;
  changes?: Record<string, unknown>;
  created_at: string;
}

/** A staff member for pickers (GET /people). */
export interface PickPerson {
  user_id: string;
  name: string;
  email?: string;
}

export interface RoleInput {
  name: string;
  role_code?: string;
  description?: string;
}

export interface InviteInput {
  email: string;
  role_code?: string;
}

export interface InviteResult {
  user_id: string;
  email: string;
  created: boolean;
  role_code: string;
}

export interface UsersParams {
  search?: string;
  page?: number;
  limit?: number;
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
  /** One page of people (the API caps limit at 500, 50 by default). */
  users: (orgSlug: string, params: UsersParams = {}) =>
    apiClient.get<PaginatedResponse<RbacUser>>(`${base(orgSlug)}/rbac/users`, { ...params } as Record<string, unknown>),
  user: (orgSlug: string, authUserId: string) =>
    apiClient.get<RbacUserDetail>(`${base(orgSlug)}/rbac/users/${authUserId}`),
  /** expiresAt: an ISO time in the future, or null for no end date. */
  assignRole: (orgSlug: string, authUserId: string, roleCode: string, expiresAt: string | null = null) =>
    apiClient.post<void>(`${base(orgSlug)}/rbac/users/${authUserId}/roles`, {
      role_code: roleCode,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }),
  revokeRole: (orgSlug: string, authUserId: string, roleCode: string) =>
    apiClient.delete<void>(`${base(orgSlug)}/rbac/users/${authUserId}/roles/${encodeURIComponent(roleCode)}`),
  setStatus: (orgSlug: string, authUserId: string, status: 'active' | 'inactive') =>
    apiClient.patch<RbacUserDetail>(`${base(orgSlug)}/rbac/users/${authUserId}`, { status }),
  createRole: (orgSlug: string, input: RoleInput & { permission_codes: string[] }) =>
    apiClient.post<RbacRole>(`${base(orgSlug)}/rbac/roles`, input),
  cloneRole: (orgSlug: string, roleId: string, input: RoleInput) =>
    apiClient.post<RbacRole>(`${base(orgSlug)}/rbac/roles/${roleId}/clone`, input),
  updateRole: (orgSlug: string, roleId: string, input: { name?: string; description?: string }) =>
    apiClient.patch<RbacRole>(`${base(orgSlug)}/rbac/roles/${roleId}`, input),
  rolePermissions: (orgSlug: string, roleId: string) =>
    apiClient
      .get<{ permission_codes: string[] }>(`${base(orgSlug)}/rbac/roles/${roleId}/permissions`)
      .then((r) => r.permission_codes ?? []),
  /** Answers the role now holding the codes: a new id the first time a default role is edited. */
  setRolePermissions: (orgSlug: string, roleId: string, codes: string[]) =>
    apiClient.put<RbacRole>(`${base(orgSlug)}/rbac/roles/${roleId}/permissions`, { permission_codes: codes }),
  deleteRole: (orgSlug: string, roleId: string) => apiClient.delete<void>(`${base(orgSlug)}/rbac/roles/${roleId}`),
  auditLogs: (orgSlug: string, params: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResponse<RbacAuditLog>>(`${base(orgSlug)}/rbac/audit-logs`, { ...params } as Record<string, unknown>),
  /** Invites a person by email through auth-api and gives them a projects role. */
  invite: (orgSlug: string, input: InviteInput) => apiClient.post<InviteResult>(`${base(orgSlug)}/users`, input),
  /** Staff for pickers (never portal clients); needs members.manage or rbac.manage. */
  people: (orgSlug: string, search = '', limit = 20) =>
    apiClient
      .get<PaginatedResponse<PickPerson>>(`${base(orgSlug)}/people`, { limit, ...(search ? { search } : {}) })
      .then((r) => r.data ?? []),
};

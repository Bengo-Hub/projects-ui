import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@/types';
import type {
  PortalFile,
  PortalInvoices,
  PortalMilestone,
  PortalProjectListItem,
  PortalSummary,
  PortalTask,
  ThreadComment,
} from '@/types/portal';
import type { Decision } from '@/lib/portal/logic';

// The client portal's own HTTP client. It never shares the staff apiClient: the portal token (OAuth
// client projects-portal, role client) lives here, so a staff member trying the portal in the same
// browser keeps two sessions that never overwrite each other.

let accessToken: string | null = null;
let tenantId: string | null = null;
let tenantSlug: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const portalHttp: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

portalHttp.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) config.headers['X-Tenant-ID'] = tenantId;
  if (tenantSlug) config.headers['X-Tenant-Slug'] = tenantSlug;
  return config;
});

portalHttp.interceptors.response.use(
  (r: AxiosResponse) => r,
  async (error: unknown) => {
    const e = error as { response?: { status?: number }; config?: InternalAxiosRequestConfig & { _retried?: boolean } };
    if (e.response?.status === 401 && e.config && !e.config._retried && accessToken) {
      const sent = String(e.config.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '');
      const { refreshPortalToken } = await import('@/lib/auth/portal-token-refresh');
      const fresh = await refreshPortalToken(sent || accessToken);
      if (fresh) {
        accessToken = fresh;
        e.config._retried = true;
        e.config.headers.Authorization = `Bearer ${fresh}`;
        return portalHttp.request(e.config);
      }
      onUnauthorized?.();
    } else if (e.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export function setPortalToken(token: string | null) {
  accessToken = token;
}
export function setPortalTenant(id: string | null, slug: string | null) {
  tenantId = id;
  tenantSlug = slug;
}
export function setPortalOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb;
}

const enc = encodeURIComponent;
const base = (orgSlug: string) => `/api/v1/${enc(orgSlug)}/portal/projects`;

export interface PageParams {
  limit?: number;
  page?: number;
}

export interface PortalProjectsAnswer {
  page: PaginatedResponse<PortalProjectListItem>;
  /** Lower-cased header names; X-Client-Invites says when invites wait for a verified email. */
  headers: Record<string, string>;
}

function lowerHeaders(r: AxiosResponse): Record<string, string> {
  return Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
}

/** The client routes (projects.portal.view). Every project route answers 404 outside the caller's projects. */
export const portalApi = {
  projects: (orgSlug: string, params?: PageParams): Promise<PortalProjectsAnswer> =>
    portalHttp
      .get<PaginatedResponse<PortalProjectListItem>>(base(orgSlug), { params })
      .then((r) => ({ page: r.data, headers: lowerHeaders(r) })),
  summary: (orgSlug: string, id: string) => portalHttp.get<PortalSummary>(`${base(orgSlug)}/${enc(id)}`).then((r) => r.data),
  milestones: (orgSlug: string, id: string) =>
    portalHttp.get<{ data: PortalMilestone[] }>(`${base(orgSlug)}/${enc(id)}/milestones`).then((r) => r.data.data ?? []),
  decide: (orgSlug: string, id: string, milestoneId: string, body: { decision: Decision; comment: string }) =>
    portalHttp
      .post<{ id: string; status: string; decision: Decision }>(`${base(orgSlug)}/${enc(id)}/milestones/${enc(milestoneId)}/decision`, body)
      .then((r) => r.data),
  tasks: (orgSlug: string, id: string, params?: PageParams) =>
    portalHttp.get<PaginatedResponse<PortalTask>>(`${base(orgSlug)}/${enc(id)}/tasks`, { params }).then((r) => r.data),
  files: (orgSlug: string, id: string, params?: PageParams) =>
    portalHttp.get<PaginatedResponse<PortalFile>>(`${base(orgSlug)}/${enc(id)}/files`, { params }).then((r) => r.data),
  invoices: (orgSlug: string, id: string) => portalHttp.get<PortalInvoices>(`${base(orgSlug)}/${enc(id)}/invoices`).then((r) => r.data),
  thread: (orgSlug: string, id: string, params?: PageParams) =>
    portalHttp.get<PaginatedResponse<ThreadComment>>(`${base(orgSlug)}/${enc(id)}/thread`, { params }).then((r) => r.data),
  post: (orgSlug: string, id: string, content: string, idempotencyKey: string) =>
    portalHttp
      .post<ThreadComment>(`${base(orgSlug)}/${enc(id)}/thread`, { content }, { headers: { 'Idempotency-Key': idempotencyKey } })
      .then((r) => r.data),
};

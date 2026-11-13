import axios, { type AxiosInstance } from 'axios';
import type { QAAccessGrant, QAAccessInfo, QAInviteeSession, QARecordOutcome, QAVerdictInput } from '@/types/qa';

// Invitee routes (projects-api docs/api.md, "Invitee routes"). These carry no tenant JWT: the access
// token is the HttpOnly qa_access cookie, and for browsers that block a cross-site cookie the same
// token goes in the X-QA-Access header. The token is kept for this tab only (sessionStorage).

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexafrica.com';

const http: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15000,
});

const TOKEN_PREFIX = 'qa-access:';

export function readAccessToken(code: string): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_PREFIX + code);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw) as { token?: string; expiresAt?: string };
    if (!token || (expiresAt && Date.parse(expiresAt) <= Date.now())) {
      sessionStorage.removeItem(TOKEN_PREFIX + code);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function storeAccessToken(code: string, grant: QAAccessGrant) {
  try {
    sessionStorage.setItem(TOKEN_PREFIX + code, JSON.stringify({ token: grant.access_token, expiresAt: grant.expires_at }));
  } catch {
    // Storage blocked: the cookie still carries the access.
  }
}

export function clearAccessToken(code: string) {
  try {
    sessionStorage.removeItem(TOKEN_PREFIX + code);
  } catch {
    // nothing to clear
  }
}

function accessHeaders(code: string): Record<string, string> {
  const token = readAccessToken(code);
  return token ? { 'X-QA-Access': token } : {};
}

const enc = encodeURIComponent;

export const qaInviteeApi = {
  accessInfo: (code: string) => http.get<QAAccessInfo>(`/api/v1/qa/access/${enc(code)}`).then((r) => r.data),

  /** Lets in an address proven with auth-api's email code. */
  accessByEmail: (code: string, otpToken: string) =>
    http.post<QAAccessGrant>(`/api/v1/qa/access/${enc(code)}/email`, { otp_token: otpToken }).then((r) => r.data),

  /** Lets in a signed-in user whose token email holds an invite. */
  accessBySSO: (code: string, bearer: string) =>
    http
      .post<QAAccessGrant>(`/api/v1/qa/access/${enc(code)}/sso`, null, { headers: { Authorization: `Bearer ${bearer}` } })
      .then((r) => r.data),

  session: (code: string) =>
    http.get<QAInviteeSession>('/api/v1/qa/invitee/session', { headers: accessHeaders(code) }).then((r) => r.data),

  recordResult: (code: string, criterionId: string, body: QAVerdictInput) =>
    http
      .put<QARecordOutcome>(`/api/v1/qa/invitee/results/${enc(criterionId)}`, body, { headers: accessHeaders(code) })
      .then((r) => r.data),

  report: (code: string) =>
    http
      .get<Blob>('/api/v1/qa/invitee/report.pdf', { headers: accessHeaders(code), responseType: 'blob', timeout: 60000 })
      .then((r) => r.data),

  logout: (code: string) =>
    http.post<void>('/api/v1/qa/invitee/logout', null, { headers: accessHeaders(code) }).then(() => undefined),
};

// auth-api email code (POST /api/v1/auth/public-otp/send and /verify). projects-api never sees the
// code, only the one-time otp_token that /verify returns.
export const emailCodeApi = {
  send: (email: string, tenantSlug?: string) =>
    axios
      .post<{ sent: boolean }>(`${SSO_BASE_URL}/api/v1/auth/public-otp/send`, { email, tenant_slug: tenantSlug || undefined }, { timeout: 15000 })
      .then((r) => r.data),
  verify: (email: string, otp: string) =>
    axios
      .post<{ verified: boolean; otp_token: string }>(`${SSO_BASE_URL}/api/v1/auth/public-otp/verify`, { email, otp }, { timeout: 15000 })
      .then((r) => r.data),
};

export function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/** The message an API or auth-api error carries ({error} or {message}), or the fallback. */
export function errorText(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const d = data as { error?: unknown; message?: unknown };
    if (typeof d.message === 'string' && d.message) return d.message;
    if (typeof d.error === 'string' && d.error) return d.error;
  }
  return fallback;
}

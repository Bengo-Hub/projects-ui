import { apiClient } from './client';
import { useAuthStore } from '@/store/auth';
import type { FieldKeyHealth } from '@/lib/security/field-keys';

// Platform owner only (projects-api docs/api.md, "Platform: field keys"). Backup and rotation need a
// fresh email code: auth-api emails the signed-in owner a code (POST /api/v1/auth/otp/send), the
// code turns into a one-time otp_token (POST /api/v1/auth/otp/verify), and projects-api checks that
// token with auth-api and that it proves the owner's own address.

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexafrica.com';

async function sso<T>(path: string, body: unknown): Promise<T> {
  const token = useAuthStore.getState().session?.accessToken;
  const res = await fetch(`${SSO_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw Object.assign(new Error(data.message || data.error || 'Request failed'), { status: res.status });
  }
  return data;
}

export const fieldKeysApi = {
  health: () => apiClient.get<FieldKeyHealth>('/api/v1/platform/field-keys'),

  /** Emails the signed-in owner a 6 digit code. */
  sendCode: () => sso<{ sent: boolean }>('/api/v1/auth/otp/send', {}),

  /** Trades the emailed code for a one-time otp_token (valid 10 minutes, one use). */
  verifyCode: (otp: string) =>
    sso<{ verified: boolean; otp_token: string }>('/api/v1/auth/otp/verify', { otp }).then((r) => r.otp_token),

  backup: (otpToken: string) => apiClient.postBlob('/api/v1/platform/field-keys/backup', { otp_token: otpToken }),

  rotate: (otpToken: string) =>
    apiClient.post<FieldKeyHealth>('/api/v1/platform/field-keys/rotate', { otp_token: otpToken }),
};

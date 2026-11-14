// Pure helpers for the Security keys page (projects-api docs/api.md, "Platform: field keys"). No
// React, no aliases and no runtime imports, so node-tests can load this file directly.

export interface FieldKeyInfo {
  id: string;
  fingerprint: string;
  status: 'current' | 'previous' | 'retired';
  created_at: string;
  retired_at?: string;
  values: number;
}

export interface FieldKeyRotation {
  state: 'idle' | 'resealing' | 'done';
  key_id?: string;
  started_at?: string;
  finished_at?: string;
  heartbeat_at?: string;
  resealed: number;
  failed: number;
  remaining: number;
}

export interface FieldKeyHealth {
  configured: boolean;
  root_fingerprint?: string;
  current_key_id?: string;
  current_fingerprint?: string;
  sealed_values: number;
  on_current: number;
  on_older: number;
  on_root: number;
  keys: FieldKeyInfo[];
  last_backup_at?: string;
  last_backup_by?: string;
  last_rotated_at?: string;
  rotation: FieldKeyRotation;
}

/** Whether the Rotate button may be offered: a root key, and no rotation still re-sealing. */
export function canRotate(h: FieldKeyHealth | null | undefined): boolean {
  return !!h && h.configured && h.rotation.state !== 'resealing';
}

/** One plain sentence for the rotation block of the health card. */
export function describeRotation(h: FieldKeyHealth): string {
  const r = h.rotation;
  if (!h.configured) return 'No root key is configured, so nothing is sealed.';
  if (r.state === 'idle') return 'Never rotated. Values are sealed under the root key.';
  if (r.state === 'done') return `Done. Every value is under key ${r.key_id} and older keys are retired.`;
  if (r.failed > 0) {
    return `Re-sealing under ${r.key_id}: ${r.failed} value${r.failed === 1 ? '' : 's'} could not be opened, so older keys stay until that is fixed.`;
  }
  if (r.remaining > 0) return `Re-sealing under ${r.key_id}: ${r.resealed} moved, ${r.remaining} left on older keys.`;
  return `Re-sealing under ${r.key_id}: every value is moved. Older keys retire after a short wait for every server to catch up.`;
}

/** Share of sealed values already under the current key, 0 to 100. */
export function currentShare(h: FieldKeyHealth): number {
  if (!h.sealed_values) return 100;
  return Math.round((h.on_current / h.sealed_values) * 100);
}

/** The file name from a Content-Disposition header, or a safe fallback. */
export function fileNameFrom(disposition: string | null | undefined, fallback = 'projects-api-field-keys.json'): string {
  const m = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  const name = m?.[1]?.trim() ?? '';
  return /^[\w.-]+$/.test(name) ? name : fallback;
}

/** The API's error code from an axios error whose body may be JSON or, for a blob request, a Blob. */
export async function errorCode(err: unknown): Promise<string | undefined> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) return undefined;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return (JSON.parse(await data.text()) as { code?: string }).code;
    } catch {
      return undefined;
    }
  }
  return (data as { code?: string }).code;
}

/** What to tell the owner for an API error code. */
export function errorMessage(code: string | undefined): string {
  switch (code) {
    case 'otp_required':
      return 'Enter the code we emailed you first.';
    case 'otp_invalid':
      return 'That code is not valid any more. Codes work once and expire after 10 minutes; request a new one.';
    case 'otp_unavailable':
      return 'Email codes are not available right now. Try again shortly.';
    case 'rotation_running':
      return 'The last rotation is still re-sealing values. Wait for it to finish.';
    case 'not_configured':
      return 'FIELD_ENCRYPTION_KEY is not set on projects-api.';
    case 'platform_owner_required':
      return 'Only the platform owner can do this.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

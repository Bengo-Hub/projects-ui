import { toast } from 'sonner';
import { permissionName } from '@/lib/auth/permissions';

/** The body projects-api sends with an error. */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  upgrade?: boolean;
  required_permission?: string;
  required_feature?: string;
}

/** How a 403 was refused: the plan (upgrade), a missing permission, or another organisation. */
export type ForbiddenKind = 'subscription' | 'permission' | 'tenant';

export function httpStatusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

export function errorBody(err: unknown): ApiErrorBody | undefined {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  return data && typeof data === 'object' ? (data as ApiErrorBody) : undefined;
}

/** Classifies a 403 by its body; null for any other answer or a 403 without a known code. */
export function forbiddenKind(err: unknown): ForbiddenKind | null {
  if (httpStatusOf(err) !== 403) return null;
  const body = errorBody(err);
  if (body?.upgrade === true || body?.code === 'subscription_inactive' || body?.code === 'feature_not_available') return 'subscription';
  if (body?.code === 'permission_denied') return 'permission';
  if (body?.code === 'tenant_forbidden') return 'tenant';
  return null;
}

export function isNotFound(err: unknown): boolean {
  return httpStatusOf(err) === 404;
}

/** The names of the permissions a permission 403 asked for ("a | b" means any of them). */
export function missingPermissionText(err: unknown): string {
  const codes = (errorBody(err)?.required_permission ?? '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) return 'a permission your role does not include';
  return codes.map((c) => `"${permissionName(c)}"`).join(' or ');
}

/** The API's own message when it sent one, else fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const status = httpStatusOf(err) ?? 0;
  const text = errorBody(err)?.error;
  return typeof text === 'string' && text && status >= 400 && status < 500 ? text : fallback;
}

/**
 * The toast for a refused save, shown once for every mutation by the query client. Subscription
 * refusals are left to the API client's upgrade notice.
 */
export function notifyForbiddenMutation(err: unknown) {
  const kind = forbiddenKind(err);
  if (kind === 'permission') {
    toast.error(`You need the ${missingPermissionText(err)} permission to do this. Ask a projects administrator.`, { id: 'permission-403' });
  } else if (kind === 'tenant') {
    toast.error('That belongs to another organisation, so it was not saved.', { id: 'tenant-403' });
  }
}

/**
 * onError for a mutation hook: a toast with the API's message or fallback. A classified 403 is
 * skipped, since the query client and the API client already said why it was refused.
 */
export function onMutationError(fallback: string) {
  return (err: unknown) => {
    if (forbiddenKind(err)) return;
    toast.error(apiErrorMessage(err, fallback));
  };
}

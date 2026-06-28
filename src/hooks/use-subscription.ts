'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import type { SubscriptionEntitlements } from '@bengo-hub/shared-ui-lib/subscription';

/**
 * Decodes a JWT payload without verifying the signature (the server already verified it
 * on issue; the UI only reads non-sensitive entitlement claims for gating). Returns an
 * empty object on any malformed token so gating fails open rather than crashing the shell.
 */
function decodeJwt(token: string | undefined | null): Record<string, unknown> {
  if (!token) return {};
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('binary');
    // Handle UTF-8 payloads correctly.
    const decoded = decodeURIComponent(
      json
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asNumberRecord(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

/**
 * useSubscription derives the tenant's SubscriptionEntitlements from the current access-token
 * JWT claims (with the SSO profile / tenant object as a fallback source for the same claims).
 *
 * Claims read: subscription_features, tier_limits / subscription_limits, subscription_status,
 * is_demo, is_platform_owner, billing_mode.
 *
 * `isExempt` mirrors the backend IsGatingExempt funnel: platform owner OR demo OR
 * billing_mode === 'service_charge'. When exempt, every feature reads enabled downstream.
 */
export function useSubscription(): SubscriptionEntitlements {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  return useMemo<SubscriptionEntitlements>(() => {
    const claims = decodeJwt(session?.accessToken);
    // The tenant claims may live either at the top level of the JWT or under a `tenant` object,
    // and the SSO profile mirrors a subset onto user / user.tenant. Merge with the JWT winning.
    const tenant = (user?.tenant ?? {}) as Record<string, unknown>;
    const claimTenant = (claims.tenant ?? {}) as Record<string, unknown>;
    const src = { ...tenant, ...claimTenant, ...claims };

    const features = asStringArray(src.subscription_features);
    const limits = {
      ...asNumberRecord(src.subscription_limits),
      ...asNumberRecord(src.tier_limits),
    };

    const isPlatformOwner =
      src.is_platform_owner === true ||
      (user?.isPlatformOwner ?? false) ||
      (user?.isSuperUser ?? false);
    const isDemo = src.is_demo === true;
    const isServiceCharge = src.billing_mode === 'service_charge';
    const isExempt = isPlatformOwner || isDemo || isServiceCharge;

    const subStatus =
      typeof src.subscription_status === 'string'
        ? (src.subscription_status as string)
        : null;

    // Loading: authenticated but the token/claims haven't resolved yet (no session token).
    const isLoading = status === 'loading' || status === 'syncing' || !session?.accessToken;

    return {
      features,
      limits,
      isExempt,
      status: subStatus,
      isLoading,
    };
  }, [session?.accessToken, user, status]);
}

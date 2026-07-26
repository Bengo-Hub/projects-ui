'use client';

import { SubscriptionBanner as SharedSubscriptionBanner } from '@bengo-hub/shared-ui-lib/subscription';
import { useSubscription } from '@/hooks/use-subscription';

const SUBSCRIPTIONS_UI_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || 'https://pricing.codevertexafrica.com';

export const UPGRADE_URL = `${SUBSCRIPTIONS_UI_URL}/plans?service=projects`;
export const BILLING_URL = `${SUBSCRIPTIONS_UI_URL}/billing`;

/**
 * Thin wrapper that feeds projects-ui entitlements into the shared SubscriptionBanner.
 * Platform-owner / demo / service-charge tenants are exempt (the shared banner no-ops for
 * them), so this only ever surfaces for commercial tenants whose plan needs attention.
 */
export function SubscriptionBanner() {
  const sub = useSubscription();
  const status = sub.status ?? null;
  const normalized = (status ?? '').toUpperCase();

  return (
    <SharedSubscriptionBanner
      status={status}
      plan={null}
      isExpired={normalized === 'EXPIRED' || normalized === 'CANCELLED'}
      isInGracePeriod={false}
      expiresAt={null}
      gracePeriodEndsAt={null}
      daysUntilExpiry={null}
      needsSubscription={(normalized === 'NONE' || normalized === '') && !sub.isExempt}
      isPlatformOwner={sub.isExempt}
      isServiceCharge={sub.isExempt}
      isDemo={sub.isExempt}
      isCommercialTenant={!sub.isExempt}
      isLoading={!!sub.isLoading}
      isHydrated={!sub.isLoading}
      upgradeUrl={UPGRADE_URL}
      billingUrl={BILLING_URL}
    />
  );
}

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

/**
 * PlatformScopeGuard — confines any cross-tenant "platform drill-in" to the
 * `/platform` section, so every normal business page is always scoped to the
 * platform owner's OWN tenant (codevertex).
 *
 * Model "Dedicated Platform section" (see
 * .claude/plans/platform-owner-self-tenant-separation.md): the main app
 * `/{orgSlug}/*` = the owner's own business by default; cross-tenant
 * administration is confined to `/{orgSlug}/platform/*`. Leaving `/platform`
 * must clear the drill-in.
 *
 * projects-ui has NO `/platform` route and NO `?tenantId=` cross-tenant
 * selector today. The only platform-scoped lever on the API client is
 * `setPlatformOwner()`, which (when true) suppresses the `X-Tenant-*` headers.
 * The auth store eagerly sets that lever true for the platform owner on login,
 * which would drop the own-tenant headers on EVERY business page. This guard
 * pins the lever OFF on every non-platform route so the owner's business pages
 * always carry their own-tenant scope, and provides the canonical home for
 * clearing a future cross-tenant drill-in when one is added.
 */
export function PlatformScopeGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const onPlatform = !!pathname && pathname.includes('/platform');
    if (!onPlatform) {
      apiClient.setPlatformOwner(false);
    }
  }, [pathname]);

  return null;
}

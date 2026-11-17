'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { MediaImage } from '@bengo-hub/shared-ui-lib/media';
import { useTenantBranding } from '@bengo-hub/shared-ui-lib/tenant';
import { portalBase } from '@/lib/portal/logic';
import { usePortalAuthStore } from '@/store/portal-auth';

/** The portal's only chrome: the firm's logo and name, who is signed in, and sign out. */
export function PortalHeader({ orgSlug }: { orgSlug: string }) {
  const { tenant } = useTenantBranding();
  const firm = tenant?.orgName || tenant?.name || orgSlug;
  const user = usePortalAuthStore((s) => s.user);
  const signedIn = usePortalAuthStore((s) => s.status === 'authenticated');
  const logout = usePortalAuthStore((s) => s.logout);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <Link href={portalBase(orgSlug)} className="flex min-w-0 flex-1 items-center gap-3" data-testid="portal-brand">
          {tenant?.logoUrl ? (
            <MediaImage src={tenant.logoUrl} displayWidth={64} loading="eager" alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
              {firm.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold">{firm}</span>
            <span className="block truncate text-[11px] text-muted-foreground">Client portal</span>
          </span>
        </Link>
        {signedIn && (
          <div className="flex shrink-0 items-center gap-2">
            {user?.fullName && <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">{user.fullName}</span>}
            <button
              type="button"
              onClick={() => logout(orgSlug)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

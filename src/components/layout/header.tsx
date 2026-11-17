'use client';

import { useState } from 'react';
import { Menu, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useVisibleServices, serviceTagsFromAccessToken, AppSwitcherGrid, AppSwitcherTrigger, type ServiceKey } from '@bengo-hub/shared-ui-lib/app-switcher';
import { AccountPanel } from '@bengo-hub/shared-ui-lib/account-panel';
import { TimerPill } from '@/components/time/timer';

// 'projects' itself is omitted (never links to itself, mirrors every other *-ui).
const SERVICE_URLS: Partial<Record<ServiceKey, string>> = {
  pos: process.env.NEXT_PUBLIC_POS_UI_URL ?? 'https://pos.codevertexafrica.com',
  inventory: process.env.NEXT_PUBLIC_INVENTORY_UI_URL ?? 'https://inventory.codevertexafrica.com',
  treasury: process.env.NEXT_PUBLIC_TREASURY_UI_URL ?? 'https://books.codevertexafrica.com',
  marketflow: process.env.NEXT_PUBLIC_MARKETFLOW_UI_URL ?? 'https://marketflow.codevertexafrica.com',
  erp: process.env.NEXT_PUBLIC_ERP_UI_URL ?? 'https://erp.codevertexafrica.com',
  ordering: process.env.NEXT_PUBLIC_ORDERING_UI_URL ?? 'https://ordering.codevertexafrica.com',
  subscriptions: process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL ?? 'https://pricing.codevertexafrica.com',
  auth: process.env.NEXT_PUBLIC_AUTH_UI_URL ?? 'https://accounts.codevertexafrica.com',
  afya: process.env.NEXT_PUBLIC_HOSPITAL_UI_URL ?? 'https://afya.codevertexafrica.com',
};

interface HeaderProps {
  orgSlug: string;
  /** Page name shown on phones, where the sidebar is hidden. */
  title?: string;
  onMenu: () => void;
}

export default function Header({ orgSlug, title, onMenu }: HeaderProps) {
  const { user, logout, session } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const name = user?.email?.split('@')[0] ?? 'Account';
  // The App Store shows every real service to every authenticated user in the tenant; each
  // destination service enforces its own RBAC and subscription gating on arrival. A service
  // outside the plan stays visible as "Not in your plan" with a link to the plans page.
  const services = useVisibleServices({
    orgSlug,
    urls: SERVICE_URLS,
    canManageLinks: true,
    activeServiceTags: serviceTagsFromAccessToken(session?.accessToken),
    upgradeUrl: SERVICE_URLS.subscriptions ? `${SERVICE_URLS.subscriptions}/${orgSlug}` : null,
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 pt-safe sm:h-16 sm:px-5">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {title && <span className="truncate font-display text-base font-semibold lg:hidden">{title}</span>}
        <span className="hidden truncate text-sm text-muted-foreground lg:block">
          <span className="font-medium text-foreground">{orgSlug}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {user && <TimerPill orgSlug={orgSlug} />}
        {user && <AppSwitcherTrigger services={services} />}
        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <span className="hidden max-w-48 truncate md:block">{user.email}</span>
            </button>

            <AccountPanel
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              user={{ name, email: user.email ?? '' }}
              onSignOut={() => {
                setProfileOpen(false);
                void logout();
              }}
            >
              <AppSwitcherGrid services={services} onNavigate={() => setProfileOpen(false)} />
            </AccountPanel>
          </div>
        )}
      </div>
    </header>
  );
}

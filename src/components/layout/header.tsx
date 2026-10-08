'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useVisibleServices, AppSwitcherGrid, AppSwitcherTrigger, type ServiceKey } from '@bengo-hub/shared-ui-lib/app-switcher';
import { AccountPanel } from '@bengo-hub/shared-ui-lib/account-panel';

// projects-ui never wired the shared app-switcher before — this is its first adoption.
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
  className?: string;
}

export default function Header({ orgSlug, className }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const name = user?.email?.split('@')[0] ?? 'Account';
  // The App Store shows every real service to every authenticated user in the tenant — each
  // destination service already enforces its own RBAC + subscription gating on arrival.
  const services = useVisibleServices({ orgSlug, urls: SERVICE_URLS, canManageLinks: true });

  return (
    <header
      className={cn(
        'h-14 border-b border-border bg-white flex items-center justify-between px-6 shrink-0 print:hidden',
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{orgSlug}</span>
      </div>
      <div className="flex items-center gap-1">
        {user && <AppSwitcherTrigger services={services} />}
        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="hidden sm:block">{user.email}</span>
            </button>

            <AccountPanel
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              user={{ name, email: user.email ?? '' }}
              onSignOut={() => { setProfileOpen(false); void logout(); }}
            >
              <AppSwitcherGrid services={services} onNavigate={() => setProfileOpen(false)} />
            </AccountPanel>
          </div>
        )}
      </div>
    </header>
  );
}

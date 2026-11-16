'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileBottomNav, type MobileNavTab } from '@bengo-hub/shared-ui-lib/navigation';
import { PlanServiceLock } from '@bengo-hub/shared-ui-lib/subscription';
import { useAuthStore } from '@/store/auth';
import Sidebar, { useNavFeatures, useVisibleNav } from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { PlatformScopeGuard } from '@/components/layout/platform-scope-guard';
import { SubscriptionBanner } from '@/components/subscription/subscription-banner';
import { VerifyEmailPrompt } from '@/components/auth/VerifyEmailPrompt';
import { OfflineQueueBar } from '@/components/work/offline-queue-bar';
import { navItemFor, navPathActive } from '@/lib/nav';

const COLLAPSE_KEY = 'projects-sidebar-collapsed';
const COLLAPSE_EVENT = 'projects-sidebar-collapsed-change';

// The collapsed flag lives in localStorage so it survives reloads; storage may be blocked
// (private mode, policies), in which case the sidebar simply stays expanded.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The signed-in console: collapsible sidebar on desktop, a drawer and the shared bottom bar on
 * phones and tablets. The shell owns page padding; pages add only their own content.
 */
export function ConsoleShell({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const pathname = usePathname() ?? '';
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const groups = useVisibleNav();
  const enabled = useNavFeatures();
  const toggle = () => writeCollapsed(!collapsed);

  const base = `/${orgSlug}`;
  const sub = pathname.slice(base.length) || '/';
  const item = navItemFor(sub);

  const tabs: MobileNavTab[] = groups
    .flatMap((g) => g.items)
    .filter((i) => i.bottomNav && (!i.subFeature || enabled[i.subFeature]))
    .map((i) => ({
      key: i.path,
      label: i.shortLabel ?? i.label,
      href: `${base}${i.path}`,
      icon: i.icon,
      active: navPathActive(i.path, sub),
    }));

  return (
    <>
      <PlatformScopeGuard />
      <div className="fixed inset-0 flex overflow-hidden bg-background">
        <Sidebar orgSlug={orgSlug} collapsed={collapsed} onToggle={toggle} mobileOpen={drawer} onMobileOpenChange={setDrawer} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header orgSlug={orgSlug} title={item?.label} onMenu={() => setDrawer(true)} />
          <OfflineQueueBar userId={userId} />
          <SubscriptionBanner />
          <VerifyEmailPrompt />
          {/* min-h-0 lets the main area scroll; the bottom padding clears the phone bottom bar. */}
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:pb-8">
              {/* A plan without projects shows the upgrade card instead of a bare 403. */}
              <PlanServiceLock
                serviceTag="projects"
                accessToken={session?.accessToken}
                upgradeBaseUrl={process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL}
              >
                {children}
              </PlanServiceLock>
            </div>
          </main>
        </div>
        <div className="lg:hidden" data-testid="mobile-bottom-nav">
          <MobileBottomNav tabs={tabs} onOpenMore={() => setDrawer(true)} LinkComponent={Link} />
        </div>
      </div>
    </>
  );
}

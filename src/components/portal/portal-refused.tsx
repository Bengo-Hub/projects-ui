'use client';

import { ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { usePortalAuthStore } from '@/store/portal-auth';

/**
 * A signed-in account the portal will not serve: not a client of this firm (a staff account, or
 * someone else's), or the firm's plan has no client portal.
 */
export function PortalRefused({ kind, firm }: { kind: 'not_client' | 'no_feature'; firm: string }) {
  const email = usePortalAuthStore((s) => s.user?.email ?? '');
  return (
    <EmptyState
      icon={ShieldOff}
      title={kind === 'no_feature' ? 'The client portal is not open' : 'This account is not a client here'}
      description={
        kind === 'no_feature'
          ? `${firm} does not offer the client portal at the moment. Contact them directly for updates.`
          : `${email || 'This account'} has no client access with ${firm}. Sign in with the email address they invited, or ask them to send the invite again.`
      }
    />
  );
}

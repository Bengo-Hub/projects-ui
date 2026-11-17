'use client';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useSetUserStatus } from '@/hooks/useRbac';
import type { RbacUser } from '@/lib/api/rbac';
import { personLabel } from './member-roles-dialog';

/** Confirms deactivating an active person or reactivating an inactive one (admin tier only). */
export function PersonStatusDialog({ orgSlug, person, onClose }: { orgSlug: string; person: RbacUser | null; onClose: () => void }) {
  const setStatus = useSetUserStatus(orgSlug);
  const deactivating = person?.status !== 'inactive';
  return (
    <ConfirmDialog
      open={!!person}
      onOpenChange={(o) => !o && onClose()}
      title={deactivating ? 'Deactivate this person?' : 'Reactivate this person?'}
      description={
        person
          ? deactivating
            ? `${personLabel(person)} keeps their roles but can do nothing in projects until reactivated.`
            : `${personLabel(person)} gets back what their roles allow.`
          : undefined
      }
      confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
      variant={deactivating ? 'danger' : 'info'}
      loading={setStatus.isPending}
      onConfirm={() => {
        if (!person) return;
        setStatus.mutate({ userId: person.user_id, status: deactivating ? 'inactive' : 'active' }, { onSettled: onClose });
      }}
    />
  );
}

'use client';

import { useMemo, useState } from 'react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { QADialog } from '@/components/qa/qa-dialog';
import { Button } from '@/components/ui/button';
import { useInvite } from '@/hooks/useRbac';
import { assignableRoles, roleName } from '@/lib/auth/permissions';
import type { RbacRole } from '@/lib/api/rbac';

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm';

/**
 * Invites a person by email through auth-api (a new account gets a sign-in email from it) and gives
 * them a projects role. Someone already in the organisation keeps their account.
 */
export function InviteDialog({
  orgSlug,
  open,
  roles,
  adminTier,
  onClose,
}: {
  orgSlug: string;
  open: boolean;
  roles: RbacRole[];
  adminTier: boolean;
  onClose: () => void;
}) {
  const invite = useInvite(orgSlug);
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('member');
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  const options = useMemo<ComboboxOption[]>(
    () => assignableRoles(roles, [], adminTier).map((r) => ({ value: r.code, label: r.name || roleName(r.code), description: r.description })),
    [roles, adminTier],
  );

  function close() {
    setEmail('');
    setRoleCode('member');
    onClose();
  }

  return (
    <QADialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Invite a person"
      description="They sign in with this email. Someone already on the platform keeps their account."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || !roleCode) return;
          invite.mutate({ email: email.trim(), role_code: roleCode }, { onSuccess: close });
        }}
      >
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Role</span>
          <SearchableCombobox options={options} value={roleCode} onChange={(v) => setRoleCode(v || 'member')} clearable={false} searchPlaceholder="Find a role" />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || !roleCode || invite.isPending}>
            {invite.isPending ? 'Inviting...' : 'Send invite'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

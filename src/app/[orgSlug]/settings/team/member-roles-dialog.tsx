'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { QADialog } from '@/components/qa/qa-dialog';
import { Button } from '@/components/ui/button';
import { useAssignRole, useRevokeRole } from '@/hooks/useRbac';
import { assignableRoles, assignmentState, endOfDayISO, roleName } from '@/lib/auth/permissions';
import type { RbacAssignment, RbacRole, RbacUser } from '@/lib/api/rbac';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm';

export function personLabel(u: Pick<RbacUser, 'name' | 'email' | 'user_id'>): string {
  return u.name || u.email || 'Not signed in yet';
}

function HeldRow({ a, canRemove, busy, onRemove }: { a: RbacAssignment; canRemove: boolean; busy: boolean; onRemove: () => void }) {
  const state = assignmentState(a);
  const label = a.name || roleName(a.role_code);
  return (
    <li className={cn('flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2', state === 'ended' && 'opacity-70')}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {state === 'ended'
            ? `Ended ${formatDate(a.expires_at as string)}`
            : state === 'ending'
              ? `Until ${formatDate(a.expires_at as string)}`
              : a.automatic
                ? 'From their organisation role, until you give them one'
                : 'No end date'}
        </p>
      </div>
      {state === 'ended' ? (
        <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">Ended</span>
      ) : canRemove && !a.automatic ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          aria-label={`Remove the ${label} role`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/** A person's roles: the ones they hold (with end dates), give one more, take one away. */
export function MemberRolesDialog({
  orgSlug,
  user,
  roles,
  adminTier,
  onClose,
}: {
  orgSlug: string;
  user: RbacUser | null;
  roles: RbacRole[];
  adminTier: boolean;
  onClose: () => void;
}) {
  const assign = useAssignRole(orgSlug);
  const revoke = useRevokeRole(orgSlug);
  const [roleCode, setRoleCode] = useState('');
  const [until, setUntil] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const options = useMemo<ComboboxOption[]>(
    () =>
      assignableRoles(roles, user?.assignments ?? [], adminTier).map((r) => ({
        value: r.code,
        label: r.name || roleName(r.code),
        description: r.description,
      })),
    [roles, user, adminTier],
  );

  function close() {
    setRoleCode('');
    setUntil('');
    onClose();
  }

  const nameOf = (code: string) => roles.find((r) => r.code === code)?.name || roleName(code);

  return (
    <QADialog
      open={!!user}
      onOpenChange={(o) => !o && close()}
      title="Roles"
      description={user ? `${personLabel(user)}${user.name && user.email ? ` (${user.email})` : ''}` : undefined}
    >
      {user && (
        <div className="space-y-4">
          {user.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No role yet. Give one below.</p>
          ) : (
            <ul className="space-y-2" aria-label="Roles held">
              {user.assignments.map((a) => (
                <HeldRow
                  key={`${a.role_id}-${a.assigned_at}`}
                  a={a}
                  canRemove={adminTier}
                  busy={revoke.isPending}
                  onRemove={() => revoke.mutate({ userId: user.user_id, roleCode: a.role_code, label: a.name })}
                />
              ))}
            </ul>
          )}
          {!adminTier && <p className="text-xs text-muted-foreground">Only an administrator can take a role away.</p>}

          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!roleCode) return;
              assign.mutate(
                { userId: user.user_id, roleCode, expiresAt: endOfDayISO(until), label: nameOf(roleCode) },
                {
                  onSuccess: () => {
                    setRoleCode('');
                    setUntil('');
                  },
                },
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium">Give a role</span>
                {options.length === 0 ? (
                  <p className="text-sm text-muted-foreground">They already hold every role you can give.</p>
                ) : (
                  <SearchableCombobox options={options} value={roleCode} onChange={setRoleCode} placeholder="Choose a role" searchPlaceholder="Find a role" />
                )}
              </div>
              <div>
                <label htmlFor="role-until" className="mb-1 block text-sm font-medium">
                  End date
                </label>
                <input id="role-until" type="date" min={today} className={inputClass} value={until} onChange={(e) => setUntil(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Leave empty to keep the role with no end.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Button type="submit" disabled={!roleCode || assign.isPending}>
                {assign.isPending ? 'Saving...' : 'Give role'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </QADialog>
  );
}

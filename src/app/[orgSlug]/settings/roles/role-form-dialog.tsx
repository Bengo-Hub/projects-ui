'use client';

import { useState } from 'react';
import { QADialog } from '@/components/qa/qa-dialog';
import { Button } from '@/components/ui/button';
import { useCreateRole, useUpdateRole } from '@/hooks/useRbac';
import type { RbacRole } from '@/lib/api/rbac';

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm';

export type RoleFormMode = { kind: 'new' } | { kind: 'copy'; source: RbacRole } | { kind: 'rename'; role: RbacRole };

const TITLES = { new: 'New role', copy: 'Copy role', rename: 'Rename role' } as const;

/** A new empty role, a copy of a role, or a new name and description for one. */
function RoleForm({ orgSlug, mode, onClose, onSaved }: { orgSlug: string; mode: RoleFormMode; onClose: () => void; onSaved: (code: string) => void }) {
  const start = mode.kind === 'rename' ? mode.role : null;
  const [name, setName] = useState(mode.kind === 'copy' ? `${mode.source.name} copy` : (start?.name ?? ''));
  const [description, setDescription] = useState(start?.description ?? '');
  const create = useCreateRole(orgSlug);
  const update = useUpdateRole(orgSlug);
  const pending = create.isPending || update.isPending;

  function submit() {
    const input = { name: name.trim(), description: description.trim() || undefined };
    if (mode.kind === 'rename') {
      update.mutate({ roleId: mode.role.id, input: { name: input.name, description: description.trim() } }, { onSuccess: (r) => { onSaved(r.code); onClose(); } });
      return;
    }
    create.mutate(
      { source: mode.kind === 'copy' ? mode.source : null, input },
      {
        onSuccess: (r) => {
          onSaved(r.code);
          onClose();
        },
      },
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) submit();
      }}
    >
      <div>
        <label htmlFor="role-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input id="role-name" className={inputClass} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="role-description" className="mb-1 block text-sm font-medium">
          Description
        </label>
        <input id="role-description" className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || pending}>
          {pending ? 'Saving...' : mode.kind === 'copy' ? 'Copy role' : mode.kind === 'rename' ? 'Save' : 'Create role'}
        </Button>
      </div>
    </form>
  );
}

export function RoleFormDialog({ orgSlug, mode, onClose, onSaved }: { orgSlug: string; mode: RoleFormMode | null; onClose: () => void; onSaved: (code: string) => void }) {
  const description =
    mode?.kind === 'copy'
      ? 'The new role starts with the same permissions.'
      : mode?.kind === 'rename'
        ? mode.role.scope === 'global'
          ? 'Renaming a default role makes your organisation’s own copy.'
          : undefined
        : 'You choose its permissions next.';
  return (
    <QADialog open={!!mode} onOpenChange={(o) => !o && onClose()} title={mode ? TITLES[mode.kind] : ''} description={description}>
      {mode && <RoleForm key={mode.kind + (mode.kind === 'copy' ? mode.source.id : mode.kind === 'rename' ? mode.role.id : '')} orgSlug={orgSlug} mode={mode} onClose={onClose} onSaved={onSaved} />}
    </QADialog>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { useMembers, useAddMember, useRemoveMember } from '@/hooks/useMembers';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { useServicePermissions } from '@/hooks/usePermissions';
import { isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import type { AddMemberInput } from '@/lib/api/members';
import type { ProjectMember } from '@/types';

const ROLE_OPTIONS: ComboboxOption[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

function AddMemberModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: AddMemberInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<AddMemberInput>({ user_id: '', role_code: 'member' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-xl bg-card p-4 shadow-lg sm:mx-4 sm:rounded-xl sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Add member</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="member-user" className="mb-1 block text-sm font-medium">User ID *</label>
            <input
              id="member-user"
              type="text"
              value={form.user_id}
              onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm"
              placeholder="User ID"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Role</span>
            <SearchableCombobox
              options={ROLE_OPTIONS}
              value={form.role_code}
              onChange={(v) => setForm((f) => ({ ...f, role_code: v || 'member' }))}
              clearable={false}
              searchPlaceholder="Find a role"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !form.user_id.trim()}>
              {isPending ? 'Adding...' : 'Add member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);

  const { data, isLoading, isError, error } = useMembers(orgSlug, projectId);
  const addMember = useAddMember(orgSlug, projectId);
  const removeMember = useRemoveMember(orgSlug, projectId);
  const { can } = useServicePermissions();
  const canManage = can(PERMS.membersManage);

  const members = data?.data ?? [];

  const columns = useMemo<DataTableColumn<ProjectMember>[]>(() => {
    const base: DataTableColumn<ProjectMember>[] = [
      {
        key: 'user_id',
        header: 'User ID',
        primary: true,
        render: (m) => <span className="break-all font-mono text-xs text-muted-foreground">{m.user_id}</span>,
      },
      {
        key: 'role_code',
        header: 'Role',
        sortable: true,
        filterable: true,
        render: (m) => <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize">{m.role_code}</span>,
      },
      { key: 'joined_at', header: 'Joined', sortable: true, render: (m) => <span className="text-muted-foreground">{formatDate(m.joined_at)}</span> },
    ];
    if (!canManage) return base;
    return [
      ...base,
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        exportable: false,
        mobileAction: true,
        render: (m) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRemoving(m);
            }}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove member"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ),
      },
    ];
  }, [canManage]);

  function handleAdd(input: AddMemberInput) {
    addMember.mutate(input, { onSuccess: () => setShowAdd(false) });
  }

  if (isLoading) return <PageLoading />;
  if (isNotFound(error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (isError) return <ErrorBanner message="Failed to load team members." />;

  const addButton = canManage ? (
    <Button size="sm" onClick={() => setShowAdd(true)}>
      <Plus className="h-4 w-4" />
      Add member
    </Button>
  ) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Team (${members.length})`}
        back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
        className="mb-0"
        actions={addButton}
      />

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description={canManage ? 'Add people to collaborate on this project.' : 'Nobody has been added to this project yet.'}
          action={addButton}
        />
      ) : (
        <DataTable columns={columns} rows={members} rowKey={(m) => m.id} gridLines="rows" storageKey="projects-team-columns" />
      )}

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} isPending={addMember.isPending} />}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this member?"
        description="They lose access to the project. You can add them again later."
        confirmLabel="Remove"
        variant="danger"
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!removing) return;
          removeMember.mutate(removing.user_id, { onSettled: () => setRemoving(null) });
        }}
      />
    </div>
  );
}

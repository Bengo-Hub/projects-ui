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
import { QADialog } from '@/components/qa/qa-dialog';
import { useServicePermissions } from '@/hooks/usePermissions';
import { StaffPicker } from '@/components/common/staff-picker';
import { isNotFound } from '@/lib/api/errors';
import { PERMS, PROJECT_MEMBER_ROLES } from '@/lib/auth/permissions';
import type { AddMemberInput } from '@/lib/api/members';
import type { ProjectMember } from '@/types';

const ROLE_OPTIONS: ComboboxOption[] = PROJECT_MEMBER_ROLES.map((r) => ({ value: r.value, label: r.label, description: r.description }));

/**
 * Adds a teammate to the project: picked from the organisation's staff by name or email (never a
 * raw id, never a portal client), with a project role the API accepts.
 */
function AddMemberDialog({
  orgSlug,
  open,
  existing,
  onClose,
  onSubmit,
  isPending,
}: {
  orgSlug: string;
  open: boolean;
  existing: readonly string[];
  onClose: () => void;
  onSubmit: (data: AddMemberInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<AddMemberInput>({ user_id: '', role_code: 'member' });

  function close() {
    setForm({ user_id: '', role_code: 'member' });
    onClose();
  }

  return (
    <QADialog open={open} onOpenChange={(o) => !o && close()} title="Add member" description="Pick someone from your organisation. Invite new people from Team.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.user_id) onSubmit(form);
        }}
      >
        <div>
          <span className="mb-1 block text-sm font-medium">Person</span>
          <StaffPicker
            orgSlug={orgSlug}
            value={form.user_id}
            onChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
            exclude={existing}
            enabled={open}
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Project role</span>
          <SearchableCombobox
            options={ROLE_OPTIONS}
            value={form.role_code}
            onChange={(v) => setForm((f) => ({ ...f, role_code: v || 'member' }))}
            clearable={false}
            searchPlaceholder="Find a role"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !form.user_id}>
            {isPending ? 'Adding...' : 'Add member'}
          </Button>
        </div>
      </form>
    </QADialog>
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

  const members = useMemo(() => data?.data ?? [], [data]);
  const memberIds = useMemo(() => members.filter((m) => !m.left_at).map((m) => m.user_id), [members]);

  const columns = useMemo<DataTableColumn<ProjectMember>[]>(() => {
    const base: DataTableColumn<ProjectMember>[] = [
      {
        key: 'name',
        header: 'Member',
        primary: true,
        sortable: true,
        accessor: (m) => m.name || m.email || m.user_id,
        render: (m) => (
          <span className="min-w-0">
            <span className="block truncate font-medium">{m.name || m.email || 'Not signed in yet'}</span>
            <span className="block truncate text-xs text-muted-foreground">{m.name && m.email ? m.email : m.user_id}</span>
          </span>
        ),
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
        title={`Team (${data?.total ?? members.length})`}
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

      {canManage && (
        <AddMemberDialog
          orgSlug={orgSlug}
          open={showAdd}
          existing={memberIds}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
          isPending={addMember.isPending}
        />
      )}

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

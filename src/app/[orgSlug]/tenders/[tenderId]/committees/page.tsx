'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import {
  useTenderCommittees,
  useCreateCommittee,
  useAddCommitteeMember,
  useRemoveCommitteeMember,
} from '@/hooks/useTenders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';

const COMMITTEE_ROLES: ComboboxOption[] = [
  { value: 'chair', label: 'Chair' },
  { value: 'member', label: 'Member' },
  { value: 'secretary', label: 'Secretary' },
];

export default function CommitteesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const tenderId = (params?.tenderId as string) ?? '';

  const { data, isLoading, isError } = useTenderCommittees(orgSlug, tenderId);
  const createCommittee = useCreateCommittee(orgSlug, tenderId);
  const { can } = useServicePermissions();
  // Committees and their members are tender management (projects.tenders.manage).
  const canManage = can(PERMS.tendersManage);

  const [newCommitteeName, setNewCommitteeName] = useState('');
  const [addMemberState, setAddMemberState] = useState<Record<string, { userId: string; role: string }>>({});

  const committees = data?.data ?? [];

  function handleCreateCommittee(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommitteeName.trim()) return;
    createCommittee.mutate({ name: newCommitteeName }, {
      onSuccess: () => setNewCommitteeName(''),
    });
  }

  if (isLoading) return <PageLoading />;
  if (isError) return <ErrorBanner message="Failed to load committees." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Committees" back={{ href: `/${orgSlug}/tenders/${tenderId}`, label: 'Tender' }} className="mb-0" />

      {/* Create committee */}
      {canManage && (
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleCreateCommittee} className="flex gap-2">
            <input
              type="text"
              value={newCommitteeName}
              onChange={(e) => setNewCommitteeName(e.target.value)}
              className="flex-1 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="New committee name"
            />
            <Button type="submit" size="sm" disabled={!newCommitteeName.trim() || createCommittee.isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {committees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No committees yet"
          description="Create a committee to manage tender evaluation groups."
        />
      ) : (
        <div className="space-y-4">
          {committees.map((committee) => (
            <CommitteeCard
              key={committee.id}
              orgSlug={orgSlug}
              tenderId={tenderId}
              committee={committee}
              canManage={canManage}
              addMemberState={addMemberState}
              setAddMemberState={setAddMemberState}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommitteeCard({
  orgSlug,
  tenderId,
  committee,
  canManage,
  addMemberState,
  setAddMemberState,
}: {
  orgSlug: string;
  tenderId: string;
  committee: { id: string; name: string; edges?: { members?: Array<{ id: string; user_id: string; role: string }> } };
  canManage: boolean;
  addMemberState: Record<string, { userId: string; role: string }>;
  setAddMemberState: React.Dispatch<React.SetStateAction<Record<string, { userId: string; role: string }>>>;
}) {
  const addMember = useAddCommitteeMember(orgSlug, tenderId, committee.id);
  const removeMember = useRemoveCommitteeMember(orgSlug, tenderId, committee.id);
  const members = committee.edges?.members ?? [];
  const localState = addMemberState[committee.id] ?? { userId: '', role: 'member' };
  const [removing, setRemoving] = useState<string | null>(null);

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!localState.userId.trim()) return;
    addMember.mutate({ user_id: localState.userId, role: localState.role }, {
      onSuccess: () => setAddMemberState((s) => ({ ...s, [committee.id]: { userId: '', role: 'member' } })),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{committee.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length > 0 ? (
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                <span className="font-mono text-xs text-muted-foreground">{m.user_id}</span>
                <div className="flex items-center gap-2">
                  <span className="capitalize text-xs">{m.role}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setRemoving(m.user_id)}
                      aria-label="Remove member"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No members yet</p>
        )}

        {canManage && (
        <form onSubmit={handleAddMember} className="flex flex-col gap-2 pt-1 sm:flex-row">
          <input
            type="text"
            aria-label="User ID"
            value={localState.userId}
            onChange={(e) => setAddMemberState((s) => ({ ...s, [committee.id]: { ...localState, userId: e.target.value } }))}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-xs"
            placeholder="User ID"
          />
          <SearchableCombobox
            options={COMMITTEE_ROLES}
            value={localState.role}
            onChange={(v) => setAddMemberState((s) => ({ ...s, [committee.id]: { ...localState, role: v || 'member' } }))}
            clearable={false}
            searchPlaceholder="Find a role"
            className="w-full text-xs sm:w-36"
          />
          <Button type="submit" size="sm" disabled={!localState.userId.trim() || addMember.isPending}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
        )}
        <ConfirmDialog
          open={!!removing}
          onOpenChange={(o) => !o && setRemoving(null)}
          title="Remove this committee member?"
          description="They stop taking part in this committee's evaluations."
          confirmLabel="Remove"
          variant="danger"
          loading={removeMember.isPending}
          onConfirm={() => removing && removeMember.mutate(removing, { onSettled: () => setRemoving(null) })}
        />
      </CardContent>
    </Card>
  );
}

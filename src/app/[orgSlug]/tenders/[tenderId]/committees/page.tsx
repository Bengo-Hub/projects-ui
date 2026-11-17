'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import {
  useTenderCommittees,
  useCreateCommittee,
  useAddCommitteeMember,
  useRemoveCommitteeMember,
} from '@/hooks/useTenders';
import { useStaffPeople } from '@/hooks/useRbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoading } from '@/components/ui/loading';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { PageHeader } from '@/components/common/page-header';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { StaffPicker } from '@/components/common/staff-picker';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { TenderNav } from '@/components/tenders/tender-nav';
import type { PickPerson } from '@/lib/api/rbac';
import type { TenderCommittee } from '@/types';

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
  // Committees and their members are tender management (projects.tenders.manage), which also
  // opens the people search (GET /people) the member picker uses.
  const canManage = can(PERMS.tendersManage);
  // Member rows carry their names from the committee list; the people list (managers only) fills
  // in anyone the list could not name. A row with neither shows the id.
  const staff = useStaffPeople(orgSlug, canManage);
  const names = useMemo(() => new Map((staff.data ?? []).map((p) => [p.user_id, p])), [staff.data]);

  const [newCommitteeName, setNewCommitteeName] = useState('');

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
      <TenderNav orgSlug={orgSlug} tenderId={tenderId} />

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
              names={names}
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
  names,
}: {
  orgSlug: string;
  tenderId: string;
  committee: TenderCommittee;
  canManage: boolean;
  names: ReadonlyMap<string, PickPerson>;
}) {
  const addMember = useAddCommitteeMember(orgSlug, tenderId, committee.id);
  const removeMember = useRemoveCommitteeMember(orgSlug, tenderId, committee.id);
  const members = useMemo(() => committee.edges?.members ?? [], [committee.edges?.members]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [removing, setRemoving] = useState<string | null>(null);

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    // The API contract is unchanged: { user_id, role }.
    addMember.mutate({ user_id: userId, role }, {
      onSuccess: () => {
        setUserId('');
        setRole('member');
      },
    });
  }

  return (
    <Card data-testid="committee-card">
      <CardHeader>
        <CardTitle className="text-sm">{committee.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length > 0 ? (
          <div className="space-y-1">
            {members.map((m) => {
              // The list's own names first; the people list only fills a gap.
              const person = names.get(m.user_id);
              const name = m.user_name || person?.name || '';
              const email = m.email || person?.email || '';
              const label = name || email;
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border last:border-0">
                  {label ? (
                    <span className="min-w-0">
                      <span className="block truncate">{label}</span>
                      {name && email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
                    </span>
                  ) : (
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{m.user_id}</span>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="capitalize text-xs">{m.role}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setRemoving(m.user_id)}
                        aria-label={`Remove ${label || 'member'}`}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No members yet</p>
        )}

        {canManage && (
        <form onSubmit={handleAddMember} className="flex flex-col gap-2 pt-1 sm:flex-row">
          <StaffPicker orgSlug={orgSlug} value={userId} onChange={setUserId} exclude={memberIds} className="min-w-0 flex-1" />
          <SearchableCombobox
            options={COMMITTEE_ROLES}
            value={role}
            onChange={(v) => setRole(v || 'member')}
            clearable={false}
            searchPlaceholder="Find a role"
            className="w-full text-xs sm:w-36"
          />
          <Button type="submit" size="sm" disabled={!userId || addMember.isPending} aria-label={`Add to ${committee.name}`}>
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

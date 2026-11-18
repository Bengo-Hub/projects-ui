'use client';

import { useState } from 'react';
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ListError } from '@/components/common/list-parts';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
import { StaffPicker } from '@/components/common/staff-picker';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDeleteGovernanceRole, useGovernanceRoles, useSaveGovernanceRole } from '@/hooks/useGovernance';
import type { Person } from '@/hooks/usePeople';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { ROLE_KINDS, roleKindLabel, seatError, seatHolder } from '@/lib/governance/logic';
import type { GovernanceRole, GovernanceRoleInput, GovernanceRoleKind } from '@/types/governance';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm min-h-11 sm:min-h-9';
const ROLE_OPTIONS: ComboboxOption[] = ROLE_KINDS.map((k) => ({ value: k, label: roleKindLabel(k) }));

/** The project's governance seats: sponsor, steering committee, board and the rest. */
export function GovernanceRoles({ orgSlug, projectId, canManage, people }: { orgSlug: string; projectId: string; canManage: boolean; people: Person[] }) {
  const q = useGovernanceRoles(orgSlug, projectId);
  const del = useDeleteGovernanceRole(orgSlug, projectId);
  const [editing, setEditing] = useState<GovernanceRole | 'new' | null>(null);
  const [removing, setRemoving] = useState<GovernanceRole | null>(null);

  if (q.isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (q.isError) return <ListError error={q.error} title="The governance roles could not be loaded." onRetry={() => void q.refetch()} />;
  const list = q.data ?? [];

  return (
    <section className="space-y-3" aria-label="Governance roles" data-testid="governance-roles">
      {canManage && (
        <Button className="h-11 sm:h-9" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden />
          Add seat
        </Button>
      )}
      {list.length === 0 ? (
        <EmptyState icon={Landmark} title="No governance roles yet" description={canManage ? 'Add the sponsor, the steering committee and anyone else who steers the project.' : 'Nobody has set out who steers this project yet.'} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-4" data-testid="governance-seat">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{roleKindLabel(r.role)}</p>
                  <p className="font-medium wrap-break-word">{seatHolder(r)}</p>
                  {r.title && <p className="text-sm text-muted-foreground">{r.title}</p>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => setEditing(r)} aria-label={`Edit ${roleKindLabel(r.role)} ${seatHolder(r)}`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" className="h-10 w-10 p-0 text-destructive sm:h-8 sm:w-8" onClick={() => setRemoving(r)} aria-label={`Remove ${roleKindLabel(r.role)} ${seatHolder(r)}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
              {r.responsibilities && <RichTextView value={r.responsibilities} className="text-muted-foreground" />}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SeatDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgSlug={orgSlug}
          projectId={projectId}
          seat={editing === 'new' ? null : editing}
          people={people}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing ? `${roleKindLabel(removing.role)} ${seatHolder(removing)}` : 'this seat'}?`}
        description="The seat leaves the project's governance. The person stays on the team."
        confirmLabel="Remove seat"
        variant="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </section>
  );
}

interface SeatForm {
  role: GovernanceRoleKind;
  title: string;
  who: 'teammate' | 'outside';
  user_id: string;
  person_name: string;
  organisation: string;
  responsibilities: string;
}

function seatFormOf(s: GovernanceRole | null): SeatForm {
  return {
    role: s?.role ?? 'sponsor',
    title: s?.title ?? '',
    who: s && !s.user_id && s.person_name ? 'outside' : 'teammate',
    user_id: s?.user_id ?? '',
    person_name: s?.person_name ?? '',
    organisation: s?.organisation ?? '',
    responsibilities: s?.responsibilities ?? '',
  };
}

/**
 * Adds or edits a seat: the role, an optional seat name, a teammate (the staff picker, or the
 * project team for someone who cannot search the organisation's people) or a person outside the
 * team with their organisation, and their responsibilities.
 */
function SeatDialog({
  orgSlug,
  projectId,
  seat,
  people,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  seat: GovernanceRole | null;
  people: Person[];
  onClose: () => void;
}) {
  const [f, setF] = useState<SeatForm>(() => seatFormOf(seat));
  const [tried, setTried] = useState(false);
  const save = useSaveGovernanceRole(orgSlug, projectId);
  const { can } = useServicePermissions();
  // GET /people takes members.manage, rbac.manage or tenders.manage; anyone else picks from the project team.
  const canSearchStaff = can([PERMS.membersManage, PERMS.rbacManage, PERMS.tendersManage]);
  const set = <K extends keyof SeatForm>(k: K, v: SeatForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const error = seatError({ role: f.role, user_id: f.who === 'teammate' ? f.user_id : '', person_name: f.who === 'outside' ? f.person_name : '' });
  const teamOptions: ComboboxOption[] = people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const teammate = f.who === 'teammate';
    const body: GovernanceRoleInput = {
      role: f.role,
      title: f.title.trim(),
      user_id: teammate ? f.user_id : '',
      person_name: teammate ? '' : f.person_name.trim(),
      organisation: f.organisation.trim(),
      responsibilities: f.responsibilities,
    };
    if (!seat) {
      // A new seat leaves out what is empty.
      for (const k of Object.keys(body) as (keyof GovernanceRoleInput)[]) if (body[k] === '') delete body[k];
    }
    save.mutate({ id: seat?.id, body }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={seat ? 'Edit seat' : 'Add seat'} className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <span className="block font-medium">Role</span>
            <SearchableCombobox options={ROLE_OPTIONS} value={f.role} onChange={(v) => v && set('role', v as GovernanceRoleKind)} clearable={false} searchPlaceholder="Role" />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Seat name (optional)</span>
            <input className={inputClass} value={f.title} onChange={(e) => set('title', e.target.value)} aria-label="Seat name" placeholder="For example: Chair" />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Who holds it</legend>
          <div role="radiogroup" aria-label="Who holds it" className="grid grid-cols-2 gap-2">
            {(['teammate', 'outside'] as const).map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={f.who === w}
                onClick={() => set('who', w)}
                className={cn('min-h-11 rounded-md border px-3 text-sm font-medium sm:min-h-9', f.who === w ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}
              >
                {w === 'teammate' ? 'A teammate' : 'Someone outside'}
              </button>
            ))}
          </div>
          {f.who === 'teammate' ? (
            canSearchStaff ? (
              <StaffPicker orgSlug={orgSlug} value={f.user_id} onChange={(id) => set('user_id', id)} />
            ) : (
              <SearchableCombobox
                options={teamOptions}
                value={f.user_id}
                valueLabel={f.user_id && !people.some((p) => p.userId === f.user_id) ? seat?.user_name || 'A teammate' : undefined}
                onChange={(v) => set('user_id', v ?? '')}
                placeholder="Choose a person"
                searchPlaceholder="Find a project member"
                emptyText="Only the project team is listed"
              />
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Name</span>
                <input className={inputClass} value={f.person_name} onChange={(e) => set('person_name', e.target.value)} aria-label="Person's name" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Organisation</span>
                <input className={inputClass} value={f.organisation} onChange={(e) => set('organisation', e.target.value)} aria-label="Organisation" placeholder="For example: the client's board" />
              </label>
            </div>
          )}
        </fieldset>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Responsibilities</span>
          <RichTextField value={f.responsibilities} onChange={(html) => set('responsibilities', html)} ariaLabel="Responsibilities" placeholder="What this seat decides, signs off or is told about" />
        </div>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : seat ? 'Save seat' : 'Add seat'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

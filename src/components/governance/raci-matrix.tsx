'use client';

import { useState } from 'react';
import { Grid3x3, Pencil, Plus, Trash2 } from 'lucide-react';
import { MultiSelectCombobox, SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ListError } from '@/components/common/list-parts';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDeleteRaci, useRaci, useSaveRaci } from '@/hooks/useGovernance';
import type { Person } from '@/hooks/usePeople';
import { RACI_LETTER_LABEL, raciColumns, raciDraftOf, raciError, type RaciDraft, type RaciLetter } from '@/lib/governance/logic';
import type { RaciEntry } from '@/types/governance';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm min-h-11 sm:min-h-9';

const LETTER_CLASS: Record<RaciLetter, string> = {
  A: 'bg-primary text-primary-foreground',
  R: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  I: 'bg-muted text-muted-foreground',
};

function Letter({ letter }: { letter: RaciLetter }) {
  return (
    <span className={cn('inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold', LETTER_CLASS[letter])} title={RACI_LETTER_LABEL[letter]} aria-hidden>
      {letter}
    </span>
  );
}

/**
 * The RACI matrix: one row per activity with the one person accountable and who is responsible,
 * consulted and informed. A table from 640 px; each row is a card on a phone.
 */
export function RaciMatrix({
  orgSlug,
  projectId,
  canManage,
  people,
  nameOf,
}: {
  orgSlug: string;
  projectId: string;
  canManage: boolean;
  people: Person[];
  nameOf: (userId: string, known?: string) => string;
}) {
  const q = useRaci(orgSlug, projectId);
  const del = useDeleteRaci(orgSlug, projectId);
  const [editing, setEditing] = useState<RaciEntry | 'new' | null>(null);
  const [removing, setRemoving] = useState<RaciEntry | null>(null);

  if (q.isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (q.isError) return <ListError error={q.error} title="The RACI matrix could not be loaded." onRetry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  const names = (e: RaciEntry, ids: string[]) => ids.map((id) => nameOf(id, e.people?.[id])).join(', ');

  const actions = (e: RaciEntry) =>
    canManage && (
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => setEditing(e)} aria-label={`Edit ${e.activity}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="ghost" className="h-10 w-10 p-0 text-destructive sm:h-8 sm:w-8" onClick={() => setRemoving(e)} aria-label={`Remove ${e.activity}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );

  return (
    <section className="space-y-3" aria-label="RACI matrix" data-testid="raci-matrix">
      <p className="text-xs text-muted-foreground">
        A accountable (one person), R responsible, C consulted, I informed.
      </p>
      {canManage && (
        <Button className="h-11 sm:h-9" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden />
          Add activity
        </Button>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Grid3x3} title="No activities yet" description={canManage ? 'Add an activity and say who is accountable, responsible, consulted and informed.' : 'Nobody has set out the RACI matrix for this project yet.'} />
      ) : (
        <>
          {/* Phone: one card per row. */}
          <ul className="grid gap-3 sm:hidden" data-testid="raci-cards">
            {rows.map((e) => (
              <li key={e.id} className="space-y-2 rounded-lg border border-border bg-card p-4" data-testid="raci-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium wrap-break-word">{e.activity}</p>
                    {e.task_title && <p className="text-xs text-muted-foreground">Task: {e.task_title}</p>}
                  </div>
                  {actions(e)}
                </div>
                <dl className="space-y-1.5 text-sm">
                  {raciColumns(e)
                    .filter((c) => c.ids.length > 0)
                    .map((c) => (
                      <div key={c.letter} className="flex items-start gap-2">
                        <dt className="flex items-center gap-2">
                          <Letter letter={c.letter} />
                          <span className="sr-only">{RACI_LETTER_LABEL[c.letter]}</span>
                        </dt>
                        <dd className="min-w-0 pt-0.5 wrap-break-word">{names(e, c.ids)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
          {/* From 640 px: the matrix as a table. */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full text-sm" data-testid="raci-table">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Activity</th>
                  {(['A', 'R', 'C', 'I'] as const).map((l) => (
                    <th key={l} scope="col" className="px-3 py-2 font-semibold">
                      {RACI_LETTER_LABEL[l]}
                    </th>
                  ))}
                  {canManage && (
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-3 py-2">
                      <span className="font-medium">{e.activity}</span>
                      {e.task_title && <span className="block text-xs text-muted-foreground">Task: {e.task_title}</span>}
                    </td>
                    {raciColumns(e).map((c) => (
                      <td key={c.letter} className="px-3 py-2">
                        {c.ids.length ? names(e, c.ids) : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                    {canManage && <td className="px-3 py-2">{actions(e)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <RaciDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgSlug={orgSlug}
          projectId={projectId}
          entry={editing === 'new' ? null : editing}
          people={people}
          nameOf={nameOf}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove "${removing?.activity ?? 'activity'}"?`}
        description="The row leaves the RACI matrix."
        confirmLabel="Remove row"
        variant="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </section>
  );
}

/** Adds or edits a row. The same rules as the API are checked before it is sent. */
function RaciDialog({
  orgSlug,
  projectId,
  entry,
  people,
  nameOf,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  entry: RaciEntry | null;
  people: Person[];
  nameOf: (userId: string, known?: string) => string;
  onClose: () => void;
}) {
  const [d, setD] = useState<RaciDraft>(() => raciDraftOf(entry));
  const [tried, setTried] = useState(false);
  const save = useSaveRaci(orgSlug, projectId);
  const error = raciError(d);
  const set = <K extends keyof RaciDraft>(k: K, v: RaciDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  // The project team, plus anyone already on the row who has since left it, so they show by name.
  const known = new Set(people.map((p) => p.userId));
  const onRow = [d.accountable_id, ...d.responsible_ids, ...d.consulted_ids, ...d.informed_ids].filter((id) => id && !known.has(id));
  const options: ComboboxOption[] = [
    ...people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name })),
    ...[...new Set(onRow)].map((id) => ({ value: id, label: nameOf(id, entry?.people?.[id]) })),
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    save.mutate(
      {
        id: entry?.id,
        body: {
          activity: d.activity.trim(),
          accountable_id: d.accountable_id,
          responsible_ids: d.responsible_ids,
          consulted_ids: d.consulted_ids,
          informed_ids: d.informed_ids,
        },
      },
      { onSuccess: onClose },
    );
  }

  const multi = (k: 'responsible_ids' | 'consulted_ids' | 'informed_ids', placeholder: string) => (
    <MultiSelectCombobox options={options} values={d[k]} onChange={(ids) => set(k, ids)} placeholder={placeholder} searchPlaceholder="Find a project member" emptyText="Only the project team can be named" />
  );

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={entry ? 'Edit activity' : 'Add activity'} className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Activity</span>
          <input className={inputClass} value={d.activity} onChange={(e) => set('activity', e.target.value)} aria-label="Activity" placeholder="For example: approve the design" />
        </label>
        <div className="space-y-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Letter letter="A" /> Accountable (one person)
          </span>
          <SearchableCombobox options={options} value={d.accountable_id} onChange={(v) => set('accountable_id', v ?? '')} placeholder="Pick who is accountable" searchPlaceholder="Find a project member" emptyText="Only the project team can be named" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Letter letter="R" /> Responsible (at least one)
          </span>
          {multi('responsible_ids', 'Pick who is responsible')}
        </div>
        <div className="space-y-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Letter letter="C" /> Consulted
          </span>
          {multi('consulted_ids', 'Pick who is consulted')}
        </div>
        <div className="space-y-1 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Letter letter="I" /> Informed
          </span>
          {multi('informed_ids', 'Pick who is informed')}
        </div>
        <p className="text-xs text-muted-foreground">Each person holds one letter on a row; the accountable person may also be responsible.</p>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive" data-testid="raci-error">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : entry ? 'Save row' : 'Add row'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

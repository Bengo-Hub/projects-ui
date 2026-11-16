'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useSetStatuses } from '@/hooks/useTasks';
import type { BoardCount, ProjectStatus } from '@/types';

const CATEGORY_OPTIONS: ComboboxOption[] = [
  { value: 'todo', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

/** A snake case key from a label, as the API requires. */
export function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * The board columns editor (projects.projects.change). Keeps a done status, at most 20 columns, and
 * never removes a status tasks still hold (the API refuses it too; this says why before saving).
 */
export function StatusEditor({
  orgSlug,
  projectId,
  statuses,
  counts,
  open,
  onOpenChange,
}: {
  orgSlug: string;
  projectId: string;
  statuses: ProjectStatus[];
  counts: BoardCount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = useState<ProjectStatus[]>(statuses);
  const [label, setLabel] = useState('');
  const save = useSetStatuses(orgSlug, projectId);
  const held = (key: string) => counts.find((c) => c.status === key)?.count ?? 0;
  const hasDone = rows.some((r) => r.key === 'done');
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const next = [...r];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x);
      return next;
    });
  const newKey = keyFromLabel(label);
  const clash = rows.some((r) => r.key === newKey);

  return (
    <QADialog
      open={open}
      onOpenChange={(o) => {
        if (o) setRows(statuses);
        onOpenChange(o);
      }}
      title="Board columns"
      description="The statuses a task moves through on this project. Done must stay, and a column that still holds tasks cannot be removed."
    >
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const count = held(r.key);
          const locked = r.key === 'done' || count > 0;
          return (
            <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_10rem_auto]">
              <input
                value={r.label}
                onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, label: e.target.value } : y)))}
                className="h-11 min-w-0 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm"
                aria-label={`Name of ${r.key}`}
              />
              <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                {r.key === 'done' ? (
                  <span className="text-xs text-muted-foreground">Done (required)</span>
                ) : (
                  <SearchableCombobox
                    options={CATEGORY_OPTIONS.filter((o) => o.value !== 'done')}
                    value={r.category}
                    onChange={(v) => v && setRows((x) => x.map((y) => (y.key === r.key ? { ...y, category: v as ProjectStatus['category'] } : y)))}
                    clearable={false}
                    searchPlaceholder="Stage"
                  />
                )}
              </div>
              <div className="flex items-center gap-1 sm:col-start-3">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-accent disabled:opacity-30" aria-label={`Move ${r.label} up`}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-accent disabled:opacity-30" aria-label={`Move ${r.label} down`}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={locked}
                  title={r.key === 'done' ? 'Done is required' : count > 0 ? `${count} tasks are in this column` : undefined}
                  onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-30"
                  aria-label={`Remove ${r.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newKey || clash || rows.length >= 20) return;
          setRows((r) => [...r.filter((x) => x.key !== 'done'), { key: newKey, label: label.trim(), category: 'in_progress', order: r.length }, ...r.filter((x) => x.key === 'done')]);
          setLabel('');
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New column, such as Blocked" className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm" aria-label="New column name" />
        <Button type="submit" variant="outline" className="h-11 sm:h-9" disabled={!newKey || clash || rows.length >= 20}>
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </form>
      {clash && <p className="mt-1 text-xs text-destructive">A column with that name already exists.</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          className="h-11 sm:h-9"
          disabled={!hasDone || save.isPending || rows.some((r) => !r.label.trim())}
          onClick={() =>
            save.mutate(
              rows.map((r, i) => ({ ...r, label: r.label.trim(), order: i, category: r.key === 'done' ? 'done' : r.category })),
              { onSuccess: () => onOpenChange(false) },
            )
          }
        >
          {save.isPending ? 'Saving...' : 'Save columns'}
        </Button>
      </div>
    </QADialog>
  );
}

'use client';

import { useState } from 'react';
import { SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { RichTextField } from '@/components/common/rich-text';
import { AssigneePicker } from '@/components/work/assignees';
import { PRIORITY_OPTIONS } from '@/components/work/status-pill';
import { useCreateTask, useProjectStatuses } from '@/hooks/useTasks';
import { useProjectPeople } from '@/hooks/usePeople';
import type { CreateTaskInput } from '@/lib/api/tasks';

const inputClass =
  'h-11 w-full rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:h-9 sm:text-sm';

/** New task: title, description, status column, priority, assignees (members only) and dates. */
export function CreateTaskDialog({
  orgSlug,
  projectId,
  open,
  onOpenChange,
  initial,
}: {
  orgSlug: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill, such as the column a card is added to or the day clicked on the calendar. */
  initial?: Partial<CreateTaskInput>;
}) {
  const statuses = useProjectStatuses(orgSlug, projectId).data ?? [];
  const { people } = useProjectPeople(orgSlug, projectId);
  const create = useCreateTask(orgSlug, projectId);
  const [form, setForm] = useState<CreateTaskInput>({ title: '', priority: 'medium', assignee_ids: [], ...initial });
  const statusOptions: ComboboxOption[] = statuses.map((s) => ({ value: s.key, label: s.label }));
  const set = (patch: Partial<CreateTaskInput>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <QADialog open={open} onOpenChange={onOpenChange} title="New task">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) return;
          create.mutate(
            { ...form, title: form.title.trim(), status: form.status || statuses[0]?.key },
            {
              onSuccess: () => {
                setForm({ title: '', priority: 'medium', assignee_ids: [], ...initial });
                onOpenChange(false);
              },
            },
          );
        }}
      >
        <div>
          <label htmlFor="task-title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="task-title" value={form.title} onChange={(e) => set({ title: e.target.value })} className={inputClass} placeholder="What needs doing" required autoFocus />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Description</span>
          <RichTextField value={form.description ?? ''} onChange={(html) => set({ description: html })} ariaLabel="Description" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-medium">Status</span>
            <SearchableCombobox options={statusOptions} value={form.status ?? statuses[0]?.key ?? ''} onChange={(v) => set({ status: v || undefined })} clearable={false} searchPlaceholder="Find a status" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Priority</span>
            <SearchableCombobox options={PRIORITY_OPTIONS} value={form.priority ?? 'medium'} onChange={(v) => set({ priority: v || 'medium' })} clearable={false} searchPlaceholder="Find a priority" />
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Assignees</span>
            <AssigneePicker people={people} value={form.assignee_ids ?? []} onChange={(ids) => set({ assignee_ids: ids })} />
          </div>
          <div>
            <label htmlFor="task-start" className="mb-1 block text-sm font-medium">
              Start date
            </label>
            <input id="task-start" type="date" value={form.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value || undefined })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm font-medium">
              Due date
            </label>
            <input id="task-due" type="date" value={form.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || undefined })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="task-estimate" className="mb-1 block text-sm font-medium">
              Estimate (hours)
            </label>
            <input
              id="task-estimate"
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              value={form.estimated_hours ?? ''}
              onChange={(e) => set({ estimated_hours: e.target.value === '' ? undefined : Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={create.isPending || !form.title.trim()}>
            {create.isPending ? 'Creating...' : 'Create task'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@bengo-hub/shared-ui-lib/data-table';
import { Button } from '@/components/ui/button';
import { useChecklistOp } from '@/hooks/useTasks';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { addOp, applyOp, checklistProgress, MAX_TEXT, readChecklist, renameOp, toggleOp, type ChecklistOp } from '@/lib/work/checklist';
import { pendingChecklistOps } from '@/lib/work/offline-queue';
import type { TaskDetail } from '@/types';

/**
 * The checklist kept in task metadata. Each tick, add, rename or removal is one operation the API
 * applies under the task row lock, so concurrent edits never lose a tick. Changes show at once,
 * and operations made offline stay applied here until they are sent (re-applying one is harmless).
 */
export function TaskChecklist({ orgSlug, projectId, task, editable }: { orgSlug: string; projectId: string; task: TaskDetail; editable: boolean }) {
  const queue = useOfflineQueue();
  const items = pendingChecklistOps(queue, task.id).reduce(applyOp, readChecklist(task.metadata));
  const send = useChecklistOp(orgSlug, projectId, task.id);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const progress = checklistProgress(items);
  const commit = (op: ChecklistOp | null) => {
    if (op) send.mutate(op);
  };

  return (
    <section aria-labelledby="checklist-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="checklist-heading" className="text-sm font-semibold">
          Checklist
        </h3>
        {progress.total > 0 && (
          <span className="text-xs text-muted-foreground">
            {progress.done} of {progress.total} done
          </span>
        )}
      </div>
      {progress.total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
          <div className="h-full bg-success transition-[width]" style={{ width: `${progress.pct}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex min-h-11 items-center gap-3 rounded-md px-1 hover:bg-accent/50">
            <Checkbox checked={item.done} disabled={!editable} onChange={() => commit(toggleOp(item))} aria-label={`${item.done ? 'Untick' : 'Tick'} ${item.text}`} />
            {editing === item.id ? (
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => {
                  setEditing(null);
                  commit(renameOp(item, editText));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(null);
                }}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-base sm:text-sm"
                aria-label="Checklist item"
              />
            ) : (
              <button
                type="button"
                disabled={!editable}
                onClick={() => {
                  setEditing(item.id);
                  setEditText(item.text);
                }}
                className={`min-w-0 flex-1 break-words text-left text-sm ${item.done ? 'text-muted-foreground line-through' : ''}`}
              >
                {item.text}
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => commit({ op: 'remove', item_id: item.id })}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                aria-label={`Remove ${item.text}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const op = addOp(draft);
            if (!op) return;
            commit(op);
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an item"
            maxLength={MAX_TEXT}
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm"
            aria-label="New checklist item"
          />
          <Button type="submit" variant="outline" className="h-11 sm:h-9" disabled={!draft.trim()}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </form>
      )}
    </section>
  );
}

'use client';

import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { AIErrorBlock, AIWorking, DraftNotice } from '@/components/ai/ai-parts';
import { aiError, useAcceptDraftTasks, useTaskBreakdown } from '@/hooks/useAI';
import { allIndexes, hoursLabel, newRequestKey, tasksToCreate, toggleIndex, type DraftTask } from '@/lib/ai/drafts';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

/**
 * Task breakdown (sprint 10): the person writes a brief, the assistant drafts tasks, and only the
 * ticked drafts are created through the ordinary task create. Titles stay editable before saving.
 */
export function TaskBreakdownSheet({
  orgSlug,
  projectId,
  open,
  onOpenChange,
  parentTask,
}: {
  orgSlug: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTask?: { id: string; title: string } | null;
}) {
  const [brief, setBrief] = useState('');
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const ask = useTaskBreakdown(orgSlug, projectId);
  const accept = useAcceptDraftTasks(orgSlug, projectId);
  const err = aiError(ask.error);

  const run = (key: string) =>
    ask.mutate(
      { brief: brief.trim(), parentTaskId: parentTask?.id, key },
      {
        onSuccess: (d) => {
          setDrafts(d.tasks);
          setSelected(allIndexes(d.tasks.length));
        },
      },
    );

  const save = () => {
    const bodies = tasksToCreate(drafts, selected, parentTask?.id);
    if (bodies.length === 0) return;
    accept.mutate(bodies, {
      onSuccess: () => {
        setDrafts([]);
        setSelected([]);
        ask.reset();
        onOpenChange(false);
      },
    });
  };

  const edit = (i: number, title: string) => setDrafts((cur) => cur.map((d, j) => (j === i ? { ...d, title } : d)));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={parentTask ? `Draft subtasks of "${parentTask.title}"` : 'Draft tasks from a brief'}
      description="The assistant suggests tasks. You pick which ones to add."
    >
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Brief</span>
          <textarea
            className={`${inputClass} min-h-32`}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={4000}
            placeholder="For example: Run the client onboarding workshop, gather requirements and agree the delivery plan."
            aria-label="Brief"
          />
        </label>
        <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => run(newRequestKey())} disabled={!brief.trim() || ask.isPending}>
          <ListPlus className="h-4 w-4" aria-hidden />
          {drafts.length ? 'Draft again' : 'Draft tasks'}
        </Button>

        {ask.isPending && <AIWorking text="Drafting tasks..." />}
        {err && !ask.isPending && <AIErrorBlock info={err} onRetry={() => ask.variables && run(ask.variables.key)} retrying={ask.isPending} />}

        {drafts.length > 0 && !ask.isPending && (
          <section className="space-y-3" aria-label="Draft tasks">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>
                {selected.length} of {drafts.length} selected
              </span>
              <Button variant="ghost" className="h-10 sm:h-8" onClick={() => setSelected(selected.length === drafts.length ? [] : allIndexes(drafts.length))}>
                {selected.length === drafts.length ? 'Select none' : 'Select all'}
              </Button>
            </div>
            <ul className="space-y-2">
              {drafts.map((d, i) => (
                <li key={i} className="flex gap-3 rounded-md border border-border p-3" data-testid="draft-task">
                  <input
                    type="checkbox"
                    className="mt-2.5 h-5 w-5 shrink-0 accent-primary"
                    checked={selected.includes(i)}
                    onChange={() => setSelected((cur) => toggleIndex(cur, i))}
                    aria-label={`Add ${d.title}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <input className={inputClass} value={d.title} onChange={(e) => edit(i, e.target.value)} aria-label={`Title of draft ${i + 1}`} />
                    {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      Priority {d.priority} · Estimate {hoursLabel(d.estimated_hours)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <DraftNotice credits={ask.data?.credits} review={ask.data} />
            <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={save} disabled={selected.length === 0 || accept.isPending}>
              {accept.isPending ? 'Adding...' : selected.length === 1 ? 'Add 1 task' : `Add ${selected.length} tasks`}
            </Button>
          </section>
        )}
      </div>
    </Sheet>
  );
}

'use client';

import { useState } from 'react';
import { ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { AIErrorBlock, AIWorking, DraftNotice } from '@/components/ai/ai-parts';
import { aiError, useAcceptDraftRisks, useRiskSuggestions } from '@/hooks/useAI';
import { allIndexes, newRequestKey, risksToCreate, toggleIndex, type DraftRisk } from '@/lib/ai/drafts';
import { SCORE_CLASS, scoreBand } from '@/lib/planning/risks';
import { cn } from '@/lib/utils';

/**
 * Risk suggestions (sprint 10): the assistant reads the project's schedule, overdue and unassigned
 * work and the register, and suggests risks the register does not hold. Only the ticked ones are
 * added, as ordinary open risks the team then owns.
 */
export function RiskSuggestionsSheet({
  orgSlug,
  projectId,
  open,
  onOpenChange,
}: {
  orgSlug: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [drafts, setDrafts] = useState<DraftRisk[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const ask = useRiskSuggestions(orgSlug, projectId);
  const accept = useAcceptDraftRisks(orgSlug, projectId);
  const err = aiError(ask.error);

  const run = (key: string) =>
    ask.mutate(
      { key },
      {
        onSuccess: (d) => {
          setDrafts(d.risks);
          setSelected([]);
        },
      },
    );

  const save = () => {
    const bodies = risksToCreate(drafts, selected);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Suggest risks" description="The assistant reads this project and suggests risks to consider.">
      <div className="space-y-4">
        <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => run(newRequestKey())} disabled={ask.isPending}>
          <ShieldPlus className="h-4 w-4" aria-hidden />
          {drafts.length ? 'Suggest again' : 'Suggest risks'}
        </Button>

        {ask.isPending && <AIWorking text="Reading the project..." />}
        {err && !ask.isPending && <AIErrorBlock info={err} onRetry={() => ask.variables && run(ask.variables.key)} />}

        {drafts.length > 0 && !ask.isPending && (
          <section className="space-y-3" aria-label="Suggested risks">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>
                {selected.length} of {drafts.length} selected
              </span>
              <Button variant="ghost" className="h-10 sm:h-8" onClick={() => setSelected(selected.length === drafts.length ? [] : allIndexes(drafts.length))}>
                {selected.length === drafts.length ? 'Select none' : 'Select all'}
              </Button>
            </div>
            <ul className="space-y-2">
              {drafts.map((d, i) => {
                const score = d.likelihood * d.impact;
                return (
                  <li key={i} className="rounded-md border border-border p-3" data-testid="draft-risk">
                    <label className="flex cursor-pointer gap-3">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                        checked={selected.includes(i)}
                        onChange={() => setSelected((cur) => toggleIndex(cur, i))}
                        aria-label={`Add risk ${d.title}`}
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{d.title}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', SCORE_CLASS[scoreBand(score)])} title={`Likelihood ${d.likelihood} x impact ${d.impact}`}>
                            {score}
                          </span>
                          <span className="text-xs text-muted-foreground">{d.category}</span>
                        </span>
                        {d.description && <span className="block text-sm text-muted-foreground">{d.description}</span>}
                        {d.mitigation && (
                          <span className="block text-sm">
                            <span className="font-medium">Mitigation: </span>
                            {d.mitigation}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <DraftNotice credits={ask.data?.credits} review={ask.data} />
            <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={save} disabled={selected.length === 0 || accept.isPending}>
              {accept.isPending ? 'Adding...' : selected.length === 1 ? 'Add 1 risk' : `Add ${selected.length} risks`}
            </Button>
          </section>
        )}
      </div>
    </Sheet>
  );
}

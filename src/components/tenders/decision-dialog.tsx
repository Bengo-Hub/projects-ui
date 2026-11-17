'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDecideTender } from '@/hooks/useTenders';
import type { TenderCriterion, TenderEvaluationSummary, TenderGoDecision } from '@/types';
import {
  DEFAULT_GO_THRESHOLD,
  MAX_CRITERION_SCORE,
  RECOMMENDATION_LABEL,
  criterionKey,
  decisionError,
  scoreCriteria,
} from '@/lib/tenders/logic';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

const REC_CLASS = { go: 'bg-success/15 text-success', review: 'bg-warning/15 text-warning', no_go: 'bg-destructive/15 text-destructive' } as const;

/**
 * The scored go/no-go decision (US-1.6). Starts from the last decision, else the house criteria
 * with no scores. The weighted score and recommendation update as the scores move, by the same
 * rule projects-api applies; a decision against the recommendation needs a comment.
 */
export function DecisionDialog({
  orgSlug,
  tenderId,
  summary,
  previous,
  onClose,
}: {
  orgSlug: string;
  tenderId: string;
  summary: TenderEvaluationSummary | undefined;
  previous: TenderGoDecision | undefined;
  onClose: () => void;
}) {
  const [criteria, setCriteria] = useState<TenderCriterion[]>(() =>
    previous?.criteria?.length ? previous.criteria.map((c) => ({ ...c })) : (summary?.default_criteria ?? []).map((c) => ({ ...c, score: 0 })),
  );
  const [threshold, setThreshold] = useState<number>(() => previous?.threshold ?? summary?.default_threshold ?? DEFAULT_GO_THRESHOLD);
  const [decision, setDecision] = useState<'go' | 'no_go' | ''>('');
  const [comment, setComment] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [tried, setTried] = useState(false);
  const decide = useDecideTender(orgSlug, tenderId);

  const scored = scoreCriteria(criteria, threshold);
  const error = decisionError(criteria, decision, comment, threshold);
  const set = (i: number, patch: Partial<TenderCriterion>) => setCriteria((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  function addCriterion() {
    const label = newLabel.trim();
    if (!label) return;
    setCriteria((list) => [...list, { key: criterionKey(label, list.map((c) => c.key)), label, weight: 10, score: 0 }]);
    setNewLabel('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error || !decision) return;
    decide.mutate({ criteria, threshold, decision, comment: comment.trim() }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="Go or no go" description={summary?.criteria_note} className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {summary && summary.count > 0 && (
          <p className="text-sm text-muted-foreground">
            The committee scored it {summary.count} {summary.count === 1 ? 'time' : 'times'}, average {summary.average_score} (from {summary.min_score} to {summary.max_score}).
          </p>
        )}
        <ul className="space-y-3" aria-label="Criteria">
          {criteria.map((c, i) => (
            <li key={c.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.label}</span>
                <Button type="button" variant="ghost" className="h-10 w-10 p-0 sm:h-8 sm:w-8" aria-label={`Remove ${c.label}`} onClick={() => setCriteria((list) => list.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_7rem]">
                <div role="radiogroup" aria-label={`${c.label} score`} className="grid grid-cols-6 gap-1">
                  {Array.from({ length: MAX_CRITERION_SCORE + 1 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={c.score === n}
                      aria-label={`${c.label} ${n}`}
                      onClick={() => set(i, { score: n })}
                      className={cn('min-h-11 rounded-md border text-sm font-semibold sm:min-h-9', c.score === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Weight
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={inputClass}
                    value={c.weight}
                    onChange={(e) => set(i, { weight: Number(e.target.value) })}
                    aria-label={`${c.label} weight`}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className={inputClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Add a criterion" aria-label="New criterion" />
          <Button type="button" variant="outline" className="h-11 shrink-0 sm:h-9" onClick={addCriterion} disabled={!newLabel.trim()}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div data-testid="decision-score">
            <p className="text-sm">
              Weighted score <span className="font-semibold tabular-nums">{scored ? scored.weighted_score : '-'}</span> of 100
            </p>
            {scored && (
              <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', REC_CLASS[scored.recommendation])}>
                Recommendation: {RECOMMENDATION_LABEL[scored.recommendation]}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Go at
            <input type="number" min={1} max={100} className={`${inputClass} w-20`} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Go threshold" />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Decision</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['go', 'no_go'] as const).map((d) => (
              <label key={d} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium', decision === d ? 'border-primary bg-primary/10' : 'border-border')}>
                <input type="radio" name="decision" className="sr-only" checked={decision === d} onChange={() => setDecision(d)} />
                {d === 'go' ? 'Go, prepare the bid' : 'No go'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Comment</span>
          <textarea className={`${inputClass} min-h-20`} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Decision comment" placeholder="Why we go, or why not" />
        </label>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={decide.isPending}>
            {decide.isPending ? 'Saving' : 'Record decision'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

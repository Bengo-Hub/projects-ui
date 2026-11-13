'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Check, CloudOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useQAChecklist, type SaveState } from '@/hooks/useQAInvitee';
import { WeightBadge } from './qa-badges';
import { VerdictForm } from './verdict-form';
import type { QAInviteeSession, QASnapshotCriterion } from '@/types/qa';

function SaveStatus({ state, error, onRetry }: { state?: SaveState; error?: string; onRetry: () => void }) {
  if (!state) return null;
  const map: Record<SaveState, { icon: React.ReactNode; text: string; cls: string }> = {
    saved: { icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Saved', cls: 'text-green-700' },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />, text: 'Saving', cls: 'text-muted-foreground' },
    pending: { icon: <Loader2 className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Waiting to save', cls: 'text-muted-foreground' },
    offline: { icon: <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Kept on this device; it is sent when you are back online', cls: 'text-amber-800' },
    incomplete: { icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />, text: 'Not saved yet: finish the verdict', cls: 'text-amber-800' },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />, text: error || 'Not saved', cls: 'text-destructive' },
  };
  const m = map[state];
  return (
    <p className={cn('flex flex-wrap items-center gap-1 text-xs', m.cls)} role="status" aria-live="polite">
      {m.icon}
      {m.text}
      {(state === 'error' || state === 'offline') && (
        <Button type="button" variant="link" size="sm" className="h-auto px-1 py-0 text-xs" onClick={onRetry}>
          Try again
        </Button>
      )}
    </p>
  );
}

function CriterionCard({
  c,
  index,
  total,
  children,
}: {
  c: QASnapshotCriterion;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {index + 1} of {total}
              {c.area_code ? `, ${c.area_code}` : ''}
              {c.requirement_ref ? `, ${c.requirement_ref}` : ''}
            </p>
            <h3 className="font-semibold">{c.title}</h3>
          </div>
          <WeightBadge weight={c.weight} />
        </div>
        {(c.preconditions || c.steps || c.expected_result) && (
          <dl className="space-y-2 text-sm">
            {c.preconditions && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Before you start</dt>
                <dd className="whitespace-pre-wrap">{c.preconditions}</dd>
              </div>
            )}
            {c.steps && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Steps</dt>
                <dd className="whitespace-pre-wrap">{c.steps}</dd>
              </div>
            )}
            {c.expected_result && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Expected result</dt>
                <dd className="whitespace-pre-wrap">{c.expected_result}</dd>
              </div>
            )}
          </dl>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/** The tester's checklist: one criterion at a time (phones) or the whole list, saved as you go. */
export function InviteeChecklist({ code, session }: { code: string; session: QAInviteeSession }) {
  const list = useMemo(() => [...(session.criteria ?? [])].sort((a, b) => a.sort_order - b.sort_order), [session.criteria]);
  const { editable, verdicts, states, errors, pendingCount, change, retry } = useQAChecklist(code, session);
  const [mode, setMode] = useState<'one' | 'all'>('one');
  const [at, setAt] = useState(0);

  const recorded = list.filter((c) => {
    const v = verdicts[c.id];
    return v && v.result !== 'not_run';
  }).length;
  const firstOpen = list.findIndex((c) => !verdicts[c.id]);

  const render = (c: QASnapshotCriterion, i: number) => (
    <CriterionCard key={c.id} c={c} index={i} total={list.length}>
      <VerdictForm label={c.title} value={verdicts[c.id]} onChange={(v) => change(c.id, v)} disabled={!editable} />
      <SaveStatus state={states[c.id]} error={errors[c.id]} onRetry={() => void retry(c.id)} />
    </CriterionCard>
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium" aria-live="polite">
            {recorded} of {list.length} checked
            {pendingCount > 0 && <span className="font-normal text-muted-foreground">, {pendingCount} not sent yet</span>}
          </p>
          <div role="group" aria-label="Layout" className="flex rounded-md border border-border p-0.5">
            {(['one', 'all'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-9 rounded px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {m === 'one' ? 'One at a time' : 'Whole list'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Criteria checked" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={recorded}>
          <div className="h-full bg-primary transition-all" style={{ width: `${list.length ? (recorded / list.length) * 100 : 0}%` }} />
        </div>
      </div>

      {!editable && (
        <p role="note" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {session.status === 'open' ? 'Only testers record verdicts.' : 'The session is not open, so verdicts can no longer change.'}
        </p>
      )}

      {mode === 'all' ? (
        <div className="space-y-3">{list.map(render)}</div>
      ) : list.length ? (
        <div className="space-y-3">
          {render(list[Math.min(at, list.length - 1)], Math.min(at, list.length - 1))}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" disabled={at === 0} onClick={() => setAt((n) => Math.max(0, n - 1))}>
              Previous
            </Button>
            {firstOpen >= 0 && firstOpen !== at && (
              <Button variant="ghost" className="h-11" onClick={() => setAt(firstOpen)}>
                Next unchecked
              </Button>
            )}
            <Button className="h-11 flex-1 sm:flex-none" disabled={at >= list.length - 1} onClick={() => setAt((n) => Math.min(list.length - 1, n + 1))}>
              Next
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This session has no criteria.</p>
      )}
    </div>
  );
}

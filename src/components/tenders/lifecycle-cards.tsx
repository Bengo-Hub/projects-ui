'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { formatCurrency, formatDate, formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QADialog } from '@/components/qa/qa-dialog';
import { useChangeTenderStatus, usePushConversionBudget } from '@/hooks/useTenders';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import { BUDGET_STATE_LABEL, RECOMMENDATION_LABEL, canRetryBudget, moveLabel, tenderStatusLabel } from '@/lib/tenders/logic';
import type { Tender } from '@/types';
import { cn } from '@/lib/utils';

/** The manual status moves open to the tender (allowed_moves), each with an optional note. */
export function StatusActions({ orgSlug, tender }: { orgSlug: string; tender: Tender }) {
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const change = useChangeTenderStatus(orgSlug, tender.id);
  const moves = tender.allowed_moves ?? [];
  if (moves.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Status actions">
        {moves.map((m) => (
          <Button
            key={m}
            variant={m === 'cancelled' ? 'outline' : 'secondary'}
            className={cn('h-11 sm:h-9', m === 'cancelled' && 'text-destructive')}
            onClick={() => {
              setNote('');
              setTo(m);
            }}
          >
            {moveLabel(m)}
          </Button>
        ))}
      </div>
      {to && (
        <QADialog open onOpenChange={(o) => !o && setTo(null)} title={moveLabel(to)} description={`From ${tenderStatusLabel(tender.status)} to ${tenderStatusLabel(to)}.`}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              change.mutate({ status: to, note: note.trim() || undefined }, { onSuccess: () => setTo(null) });
            }}
          >
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Note (optional)</span>
              <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Status note" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setTo(null)}>
                Back
              </Button>
              <Button type="submit" className="h-11 sm:h-9" disabled={change.isPending}>
                {change.isPending ? 'Saving' : 'Confirm'}
              </Button>
            </div>
          </form>
        </QADialog>
      )}
    </>
  );
}

/** The last go/no-go decision, read only. */
export function DecisionSummary({ tender }: { tender: Tender }) {
  const d = tender.metadata?.go_decision;
  if (!d) return <p className="text-sm text-muted-foreground">No go/no-go decision yet.</p>;
  return (
    <div className="space-y-2 text-sm" data-testid="go-decision">
      <p>
        <span className="font-semibold">{d.decision === 'go' ? 'Go' : 'No go'}</span> on a weighted score of{' '}
        <span className="tabular-nums">{d.weighted_score}</span> (go at {d.threshold}; recommended {RECOMMENDATION_LABEL[d.recommendation] ?? d.recommendation}).
      </p>
      {d.comment && <p className="text-muted-foreground">{d.comment}</p>}
      <p className="text-xs text-muted-foreground">Decided {formatDateTime(d.decided_at)}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {d.criteria.map((c) => (
          <li key={c.key} className="flex justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
            <span className="truncate">{c.label}</span>
            <span className="tabular-nums">
              {c.score}/5, weight {c.weight}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The award or loss, read only. */
export function OutcomeSummary({ tender }: { tender: Tender }) {
  const o = tender.metadata?.outcome;
  if (!o) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{o.outcome === 'won' ? 'Won' : 'Lost'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {o.outcome === 'won' ? (
          <>
            {o.award_value != null && <p>Award {formatCurrency(o.award_value, tender.currency || 'KES')}{o.award_date ? `, ${formatDate(o.award_date)}` : ''}</p>}
            {o.contract_reference && <p>Contract {o.contract_reference}</p>}
            {(o.contract_start || o.contract_end) && (
              <p className="text-muted-foreground">
                {o.contract_start ? formatDate(o.contract_start) : '?'} to {o.contract_end ? formatDate(o.contract_end) : '?'}
              </p>
            )}
          </>
        ) : (
          <>
            <p>{o.loss_reason}</p>
            {o.competitor && <p className="text-muted-foreground">Won by {o.competitor}{o.competitor_price != null ? ` at ${formatCurrency(o.competitor_price, tender.currency || 'KES')}` : ''}</p>}
          </>
        )}
        {o.lessons && <p className="text-muted-foreground">Lessons: {o.lessons}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * The project a converted tender became: the link only for someone on that project
 * (can_open_project), and the treasury budget state with a retry for a budget manager on a plan
 * with budget tracking.
 */
export function ConversionCard({ orgSlug, tender }: { orgSlug: string; tender: Tender }) {
  const conv = tender.metadata?.conversion;
  const hasBudgets = useFeature('budget_tracking');
  const { can } = useServicePermissions();
  const push = usePushConversionBudget(orgSlug, tender.id);
  if (!conv) return null;
  const budget = conv.budget;
  const mayRetry = hasBudgets && can(PERMS.financialsManage) && can(PERMS.tendersManage) && canRetryBudget(budget?.status);
  return (
    <Card data-testid="conversion-card">
      <CardHeader>
        <CardTitle className="text-base">Project</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {tender.can_open_project ? (
          <Link href={`/${orgSlug}/projects/${conv.project_id}`} className="font-medium text-primary hover:underline">
            {conv.project_name}
          </Link>
        ) : (
          <p>
            {conv.project_name} <span className="text-muted-foreground">(you are not on this project)</span>
          </p>
        )}
        <p className="text-muted-foreground">
          Converted {formatDateTime(conv.converted_at)}: {conv.members_added} team {conv.members_added === 1 ? 'member' : 'members'}, {conv.documents_linked}{' '}
          {conv.documents_linked === 1 ? 'document' : 'documents'} linked{conv.template_name ? `, plan from ${conv.template_name}` : ''}.
        </p>
        {budget && (
          <div className="flex flex-wrap items-center gap-2" data-testid="conversion-budget">
            <span>Budget: {BUDGET_STATE_LABEL[budget.status] ?? budget.status}</span>
            {budget.error && <span className="text-destructive">({budget.error})</span>}
            {mayRetry && (
              <Button variant="outline" className="h-11 sm:h-8" disabled={push.isPending} onClick={() => push.mutate()}>
                {push.isPending ? 'Sending' : 'Send to treasury again'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

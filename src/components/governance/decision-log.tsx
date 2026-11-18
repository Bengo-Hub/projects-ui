'use client';

import { useState } from 'react';
import { Check, Clock, Gavel, Pencil, Plus, Trash2, X } from 'lucide-react';
import { MultiSelectCombobox, SearchableCombobox, type ComboboxOption } from '@bengo-hub/shared-ui-lib/combobox';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ListError, ShowMore } from '@/components/common/list-parts';
import { RichTextField, RichTextView } from '@/components/common/rich-text';
import { QADialog } from '@/components/qa/qa-dialog';
import { useDecide, useDecisions, useDeleteDecision, useSaveDecision, useSupersedeDecision } from '@/hooks/useGovernance';
import type { Person } from '@/hooks/usePeople';
import {
  DECISION_IMPACTS,
  DECISION_STATUS_CLASS,
  IMPACT_LABEL,
  approverState,
  decisionActions,
  decisionFormError,
  decisionRef,
  decisionStatusLabel,
  verdictError,
} from '@/lib/governance/logic';
import type { Decision, DecisionImpact, DecisionInput, DecisionStatus } from '@/types/governance';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
const STATUS_OPTIONS: ComboboxOption[] = (['proposed', 'approved', 'rejected', 'superseded'] as const).map((s) => ({ value: s, label: decisionStatusLabel(s) }));
const IMPACT_OPTIONS: ComboboxOption[] = DECISION_IMPACTS.map((i) => ({ value: i, label: IMPACT_LABEL[i] }));

type Name = (userId: string, known?: string) => string;

/**
 * The decision log, newest first: each decision with its number, status, impact and approvers. A
 * decision that names the reader as an approver, and that they have not answered, offers Approve
 * and Reject (a rejection needs a comment). A manager logs, edits and deletes proposed decisions
 * and supersedes approved ones.
 */
export function DecisionLog({
  orgSlug,
  projectId,
  canManage,
  people,
  nameOf,
  me,
}: {
  orgSlug: string;
  projectId: string;
  canManage: boolean;
  people: Person[];
  nameOf: Name;
  me: string;
}) {
  const [status, setStatus] = useState<DecisionStatus | ''>('');
  const q = useDecisions(orgSlug, projectId, status);
  const del = useDeleteDecision(orgSlug, projectId);
  const [editing, setEditing] = useState<Decision | 'new' | null>(null);
  const [answering, setAnswering] = useState<{ d: Decision; verdict: 'approve' | 'reject' } | null>(null);
  const [superseding, setSuperseding] = useState<Decision | null>(null);
  const [removing, setRemoving] = useState<Decision | null>(null);

  return (
    <section className="space-y-3" aria-label="Decision log" data-testid="decision-log">
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="sm:w-56">
          <SearchableCombobox options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus((v ?? '') as DecisionStatus | '')} placeholder="Every status" searchPlaceholder="Status" />
        </div>
        {canManage && (
          <Button className="h-11 sm:h-9" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            Log a decision
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : q.isError ? (
        <ListError error={q.error} title="The decision log could not be loaded." onRetry={() => void q.refetch()} />
      ) : q.items.length === 0 ? (
        <EmptyState icon={Gavel} title={status ? 'No decisions match' : 'No decisions yet'} description={status ? 'Pick another status.' : 'Decisions taken on the project, with who approved them, are kept here.'} />
      ) : (
        <>
          <ul className="space-y-3">
            {q.items.map((d) => {
              const can = decisionActions(d, me, canManage);
              const approvers = d.approver_ids ?? [];
              return (
                <li key={d.id} className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="decision">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">{decisionRef(d.number)}</p>
                      <p className="font-medium wrap-break-word">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Logged by {nameOf(d.proposed_by, d.people?.[d.proposed_by])} on {formatDate(d.created_at)}
                        {d.decided_at ? `, decided ${formatDate(d.decided_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.impact && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{IMPACT_LABEL[d.impact as Exclude<DecisionImpact, ''>] ?? d.impact}</span>}
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', DECISION_STATUS_CLASS[d.status] ?? '')} data-testid="decision-status">
                        {decisionStatusLabel(d.status)}
                      </span>
                    </div>
                  </div>

                  {approvers.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label="Approvers">
                      {approvers.map((id) => {
                        const st = approverState(d, id);
                        const comment = (d.approvals ?? []).find((a) => a.user_id === id)?.comment;
                        const Icon = st === 'approved' ? Check : st === 'rejected' ? X : Clock;
                        return (
                          <li
                            key={id}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                              st === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200' : st === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200' : 'bg-muted text-muted-foreground',
                            )}
                            title={comment || undefined}
                          >
                            <Icon className="h-3 w-3" aria-hidden />
                            {nameOf(id, d.people?.[id])}
                            <span className="sr-only">{st === 'waiting' ? ', waiting' : `, ${st}`}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {(d.approvals ?? [])
                    .filter((a) => a.comment)
                    .map((a) => (
                      <p key={`${a.user_id}-${a.at}`} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{nameOf(a.user_id, d.people?.[a.user_id])}</span>: {a.comment}
                      </p>
                    ))}

                  {(d.context || d.decision || d.rationale) && (
                    <details className="group text-sm">
                      <summary className="flex min-h-10 cursor-pointer items-center text-primary">Context, decision and rationale</summary>
                      <div className="space-y-3 pt-2">
                        {d.context && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</p>
                            <RichTextView value={d.context} />
                          </div>
                        )}
                        {d.decision && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
                            <RichTextView value={d.decision} />
                          </div>
                        )}
                        {d.rationale && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rationale</p>
                            <RichTextView value={d.rationale} />
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {(can.answer || can.edit || can.delete || can.supersede) && (
                    <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                      {can.answer && (
                        <>
                          <Button className="h-11 sm:h-8" onClick={() => setAnswering({ d, verdict: 'approve' })}>
                            <Check className="h-4 w-4" aria-hidden />
                            Approve
                          </Button>
                          <Button variant="outline" className="h-11 text-destructive sm:h-8" onClick={() => setAnswering({ d, verdict: 'reject' })}>
                            <X className="h-4 w-4" aria-hidden />
                            Reject
                          </Button>
                        </>
                      )}
                      {can.edit && (
                        <Button variant="outline" className="h-11 sm:h-8" onClick={() => setEditing(d)} aria-label={`Edit ${decisionRef(d.number)}`}>
                          <Pencil className="h-4 w-4" aria-hidden />
                          Edit
                        </Button>
                      )}
                      {can.supersede && (
                        <Button variant="outline" className="h-11 sm:h-8" onClick={() => setSuperseding(d)}>
                          Supersede
                        </Button>
                      )}
                      {can.delete && (
                        <Button variant="ghost" className="h-11 text-destructive sm:h-8" onClick={() => setRemoving(d)} aria-label={`Delete ${decisionRef(d.number)}`}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="grid">
            <ShowMore show={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
          </div>
        </>
      )}

      {editing && (
        <DecisionDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgSlug={orgSlug}
          projectId={projectId}
          decision={editing === 'new' ? null : editing}
          people={people}
          nameOf={nameOf}
          onClose={() => setEditing(null)}
        />
      )}
      {answering && (
        <VerdictDialog
          key={`${answering.d.id}-${answering.verdict}`}
          orgSlug={orgSlug}
          projectId={projectId}
          decision={answering.d}
          initial={answering.verdict}
          onClose={() => setAnswering(null)}
        />
      )}
      {superseding && (
        <SupersedeDialog
          key={superseding.id}
          orgSlug={orgSlug}
          projectId={projectId}
          decision={superseding}
          others={q.items.filter((x) => x.id !== superseding.id && x.status !== 'superseded')}
          onClose={() => setSuperseding(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing ? decisionRef(removing.number) : 'the decision'}?`}
        description="Only a decision still waiting for approval can be deleted. It leaves the log for good."
        confirmLabel="Delete decision"
        variant="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </section>
  );
}

interface DecisionForm {
  title: string;
  impact: DecisionImpact;
  context: string;
  decision: string;
  rationale: string;
  approver_ids: string[];
}

function decisionFormOf(d: Decision | null): DecisionForm {
  return {
    title: d?.title ?? '',
    impact: d?.impact ?? '',
    context: d?.context ?? '',
    decision: d?.decision ?? '',
    rationale: d?.rationale ?? '',
    approver_ids: [...(d?.approver_ids ?? [])],
  };
}

/** Logs a decision or edits a proposed one. Changing the approvers clears the answers so far. */
function DecisionDialog({
  orgSlug,
  projectId,
  decision,
  people,
  nameOf,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  decision: Decision | null;
  people: Person[];
  nameOf: Name;
  onClose: () => void;
}) {
  const [initial] = useState(() => decisionFormOf(decision));
  const [f, setF] = useState<DecisionForm>(initial);
  const [tried, setTried] = useState(false);
  const save = useSaveDecision(orgSlug, projectId);
  const error = decisionFormError(f);
  const set = <K extends keyof DecisionForm>(k: K, v: DecisionForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const known = new Set(people.map((p) => p.userId));
  const options: ComboboxOption[] = [
    ...people.map((p) => ({ value: p.userId, label: p.isMe ? `${p.name} (you)` : p.name })),
    ...f.approver_ids.filter((id) => !known.has(id)).map((id) => ({ value: id, label: nameOf(id, decision?.people?.[id]) })),
  ];
  const approversChanged = !!decision && JSON.stringify([...initial.approver_ids].sort()) !== JSON.stringify([...f.approver_ids].sort());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    const body: DecisionInput = {
      title: f.title.trim(),
      impact: f.impact,
      context: f.context,
      decision: f.decision,
      rationale: f.rationale,
    };
    if (!decision || approversChanged) body.approver_ids = f.approver_ids;
    save.mutate({ id: decision?.id, body }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={decision ? `Edit ${decisionRef(decision.number)}` : 'Log a decision'} className="sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={`${inputClass} min-h-11 sm:min-h-9`} value={f.title} onChange={(e) => set('title', e.target.value)} aria-label="Decision title" placeholder="For example: switch to precast slabs" />
        </label>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Impact</span>
          <SearchableCombobox options={IMPACT_OPTIONS} value={f.impact} onChange={(v) => set('impact', (v ?? '') as DecisionImpact)} placeholder="No particular impact" searchPlaceholder="Impact" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Context</span>
          <RichTextField value={f.context} onChange={(html) => set('context', html)} ariaLabel="Context" placeholder="What led to the decision" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Decision</span>
          <RichTextField value={f.decision} onChange={(html) => set('decision', html)} ariaLabel="Decision" placeholder="What was decided" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Rationale</span>
          <RichTextField value={f.rationale} onChange={(html) => set('rationale', html)} ariaLabel="Rationale" placeholder="Why, and what else was considered" />
        </div>
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Approvers</span>
          <MultiSelectCombobox options={options} values={f.approver_ids} onChange={(ids) => set('approver_ids', ids)} placeholder="Pick approvers" searchPlaceholder="Find a project member" emptyText="Only the project team can approve" />
          <p className="text-xs text-muted-foreground">
            {f.approver_ids.length === 0 ? 'Without approvers the decision is recorded as approved.' : 'It waits until every approver approves; the first rejection rejects it.'}
            {approversChanged ? ' Changing the approvers clears the answers given so far.' : ''}
          </p>
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
            {save.isPending ? 'Saving...' : decision ? 'Save decision' : 'Log decision'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

/** An approver's answer. A rejection needs a comment, as the API asks. */
function VerdictDialog({
  orgSlug,
  projectId,
  decision,
  initial,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  decision: Decision;
  initial: 'approve' | 'reject';
  onClose: () => void;
}) {
  const [verdict, setVerdict] = useState(initial);
  const [comment, setComment] = useState('');
  const [tried, setTried] = useState(false);
  const decide = useDecide(orgSlug, projectId);
  const error = verdictError(verdict, comment);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (error) return;
    decide.mutate({ id: decision.id, decision: verdict, comment }, { onSuccess: onClose });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={`${decisionRef(decision.number)}: ${decision.title}`} description="Your answer is recorded with your name.">
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="Your answer" className="grid grid-cols-2 gap-2">
          {(['approve', 'reject'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={verdict === v}
              onClick={() => setVerdict(v)}
              className={cn(
                'min-h-11 rounded-md border px-3 text-sm font-medium sm:min-h-9',
                verdict === v ? (v === 'approve' ? 'border-primary bg-primary text-primary-foreground' : 'border-destructive bg-destructive text-destructive-foreground') : 'border-border hover:bg-accent',
              )}
            >
              {v === 'approve' ? 'Approve' : 'Reject'}
            </button>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{verdict === 'reject' ? 'Why you reject it' : 'Comment (optional)'}</span>
          <textarea className={`${inputClass} min-h-24`} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" maxLength={2000} />
        </label>
        {tried && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant={verdict === 'reject' ? 'destructive' : 'default'} className="h-11 sm:h-9" disabled={decide.isPending}>
            {decide.isPending ? 'Saving...' : verdict === 'approve' ? 'Approve decision' : 'Reject decision'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

/** Marks an approved decision as superseded, optionally by another decision of the project. */
function SupersedeDialog({
  orgSlug,
  projectId,
  decision,
  others,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  decision: Decision;
  others: Decision[];
  onClose: () => void;
}) {
  const [by, setBy] = useState('');
  const supersede = useSupersedeDecision(orgSlug, projectId);
  const options: ComboboxOption[] = others.map((d) => ({ value: d.id, label: `${decisionRef(d.number)} ${d.title}` }));
  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title={`Supersede ${decisionRef(decision.number)}?`} description="The decision stays in the log, marked as superseded.">
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Replaced by (optional)</span>
          <SearchableCombobox options={options} value={by} onChange={(v) => setBy(v ?? '')} placeholder="No particular decision" searchPlaceholder="Find a decision" emptyText="No other decision on this page" />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={supersede.isPending}>
            Cancel
          </Button>
          <Button type="button" className="h-11 sm:h-9" disabled={supersede.isPending} onClick={() => supersede.mutate({ id: decision.id, supersededBy: by || undefined }, { onSuccess: onClose })}>
            {supersede.isPending ? 'Saving...' : 'Mark superseded'}
          </Button>
        </div>
      </div>
    </QADialog>
  );
}

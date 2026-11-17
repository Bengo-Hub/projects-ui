'use client';

import { useState } from 'react';
import { ExternalLink, RotateCw } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ChangeStatusPill } from '@/components/planning/change-status-pill';
import { useApproveChange, useChangeRequest, usePushBudget, useRejectChange, useWithdrawChange } from '@/hooks/useChangeRequests';
import { useServicePermissions } from '@/hooks/usePermissions';
import { useTaskTitles } from '@/hooks/useTaskTitles';
import { TREASURY_UI } from '@/lib/api/billing';
import type { ChangeRequest } from '@/lib/api/planning';
import { PERMS } from '@/lib/auth/permissions';
import { KIND_LABEL, TREASURY_LABEL, canRetryPush, changeActions, pushStatus, shiftText, validAmount } from '@/lib/planning/changes';
import { cn } from '@/lib/utils';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Decide({ orgSlug, cr }: { orgSlug: string; cr: ChangeRequest }) {
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState(false);
  const approve = useApproveChange(orgSlug);
  const reject = useRejectChange(orgSlug);
  const busy = approve.isPending || reject.isPending;
  return (
    <section className="space-y-2 rounded-md border border-border p-3" aria-label="Decision" data-testid="change-decide">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Comment</span>
        <textarea
          className={`${inputClass} min-h-20`}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (e.target.value.trim()) setMissing(false);
          }}
          maxLength={2000}
          aria-label="Decision comment"
          aria-invalid={missing}
          placeholder="Optional when approving, required when rejecting"
        />
      </label>
      {missing && (
        <p role="alert" className="text-xs text-destructive">
          Say why the change is rejected.
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className="h-11 text-destructive sm:h-9"
          disabled={busy}
          onClick={() => {
            if (!comment.trim()) {
              setMissing(true);
              return;
            }
            reject.mutate({ projectId: cr.project_id, id: cr.id, comment });
          }}
        >
          {reject.isPending ? 'Rejecting...' : 'Reject'}
        </Button>
        <Button className="h-11 sm:h-9" disabled={busy} onClick={() => approve.mutate({ projectId: cr.project_id, id: cr.id, comment })}>
          {approve.isPending ? 'Approving...' : 'Approve'}
        </Button>
      </div>
    </section>
  );
}

function Body({ orgSlug, cr }: { orgSlug: string; cr: ChangeRequest }) {
  const { can, profile } = useServicePermissions();
  const canApprove = can(PERMS.changeApprovals);
  const acts = changeActions(cr, profile?.user_id ?? '', { canApprove, canManage: can(PERMS.changeRequestsManage), canAdd: can(PERMS.changeRequestsAdd) });
  const titleOf = useTaskTitles(orgSlug, cr.project_id);
  const withdraw = useWithdrawChange(orgSlug);
  const push = usePushBudget(orgSlug);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const meta = cr.metadata ?? {};
  const treasury = meta.treasury;
  const status = pushStatus(meta);
  const budget = meta.budget;
  const total = (budget?.lines ?? []).reduce((s, l) => s + (validAmount(String(l.planned_amount)) ? Number(l.planned_amount) : 0), 0);
  const budgetsHref = `${TREASURY_UI}/${orgSlug}/budgets?project_id=${cr.project_id}`;

  return (
    <div className="space-y-5">
      <dl className="space-y-2">
        <Row label="Status">
          <ChangeStatusPill status={cr.status} />
        </Row>
        <Row label="Kind">{KIND_LABEL[cr.kind] ?? cr.kind}</Row>
        <Row label="Raised by">
          {cr.requested_by_name || 'Former member'}, {formatDateTime(cr.created_at)}
        </Row>
        {cr.decided_at && (
          <Row label={cr.status === 'withdrawn' ? 'Withdrawn' : 'Decided by'}>
            {cr.decided_by_name || 'Former member'}, {formatDateTime(cr.decided_at)}
          </Row>
        )}
        {cr.decision_comment && <Row label="Comment">{cr.decision_comment}</Row>}
      </dl>

      {cr.description && <p className="whitespace-pre-wrap text-sm">{cr.description}</p>}

      {(meta.date_shifts?.length ?? 0) > 0 && (
        <section className="space-y-2" aria-label="Date shifts">
          <h3 className="text-sm font-semibold">Tasks to move</h3>
          <ul className="divide-y divide-border rounded-md border border-border" data-testid="change-shifts">
            {meta.date_shifts!.map((s) => (
              <li key={s.task_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{titleOf(s.task_id) ?? `Task ${s.task_id.slice(0, 8)}`}</span>
                <span className={cn('shrink-0 font-medium', (s.shift_days ?? 0) > 0 ? 'text-destructive' : 'text-success')}>
                  {s.shift_days != null ? shiftText(s.shift_days) : [s.start_date && `start ${s.start_date}`, s.due_date && `due ${s.due_date}`].filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {cr.status === 'approved' && <p className="text-xs text-muted-foreground">Applied to {meta.applied_task_ids?.length ?? 0} tasks.</p>}
        </section>
      )}

      {(budget || meta.budget_id) && (
        <section className="space-y-2" aria-label="Budget change">
          <h3 className="text-sm font-semibold">Budget</h3>
          {budget ? (
            <>
              <p className="text-sm text-muted-foreground">
                {budget.name}, {budget.fiscal_year}, {budget.start_date} to {budget.end_date}
              </p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {budget.lines.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {l.name} <span className="text-xs text-muted-foreground">({l.category})</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(Number(l.planned_amount) || 0, budget.currency)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-right text-sm">
                Total <span className="font-semibold tabular-nums">{formatCurrency(total, budget.currency)}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Submits the project&apos;s existing budget in treasury for approval.</p>
          )}
          <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm" data-testid="treasury-status">
            <p>
              <span className="text-muted-foreground">Treasury: </span>
              <span className={cn('font-medium', status === 'failed' && 'text-destructive', status === 'submitted' && 'text-success')}>{TREASURY_LABEL[status] ?? status}</span>
              {treasury?.attempts ? <span className="text-xs text-muted-foreground"> after {treasury.attempts} {treasury.attempts === 1 ? 'try' : 'tries'}</span> : null}
            </p>
            {treasury?.error && <p className="text-xs text-destructive">{treasury.error}</p>}
            <div className="flex flex-wrap gap-2">
              {canApprove && canRetryPush(treasury) && (
                <Button variant="outline" className="h-11 sm:h-8" disabled={push.isPending} onClick={() => push.mutate({ projectId: cr.project_id, id: cr.id })}>
                  <RotateCw className="h-4 w-4" aria-hidden />
                  {push.isPending ? 'Sending...' : 'Retry the push'}
                </Button>
              )}
              {(treasury?.budget_id || meta.budget_id) && (
                <a href={budgetsHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-8">
                  Open budgets in treasury
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {cr.status === 'pending' && canApprove && acts.ownRequest && (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground" data-testid="own-request-note">
          You raised this change, so someone else has to approve or reject it.
        </p>
      )}
      {acts.decide && <Decide orgSlug={orgSlug} cr={cr} />}
      {acts.withdraw && (
        <div className="border-t border-border pt-4">
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => setConfirmWithdraw(true)}>
            Withdraw the change
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmWithdraw}
        onOpenChange={setConfirmWithdraw}
        title="Withdraw this change?"
        description="It stays on record as withdrawn and can no longer be approved."
        confirmLabel="Withdraw"
        variant="warning"
        loading={withdraw.isPending}
        onConfirm={() => withdraw.mutate({ projectId: cr.project_id, id: cr.id }, { onSuccess: () => setConfirmWithdraw(false) })}
      />
    </div>
  );
}

/** One change request in a side sheet: what it changes, the decision, and the treasury push. */
export function ChangeRequestDetail({ orgSlug, projectId, id, onClose }: { orgSlug: string; projectId: string; id: string; onClose: () => void }) {
  const { data, isLoading, isError } = useChangeRequest(orgSlug, projectId, id);
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()} title={data ? <span className="break-words">{data.title}</span> : isLoading ? 'Loading change' : 'Change request'}>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">This change request was not found or is not shared with you.</p>
      ) : (
        <Body orgSlug={orgSlug} cr={data} />
      )}
    </Sheet>
  );
}

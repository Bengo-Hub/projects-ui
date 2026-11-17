'use client';

import { useState } from 'react';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextView } from '@/components/common/rich-text';
import { DecisionNote } from '@/components/portal/decision-note';
import { usePortalDecision } from '@/hooks/usePortal';
import { errorBody, httpStatusOf } from '@/lib/api/errors';
import { MAX_DECISION_COMMENT, decisionProblem, milestoneLabel, portalRefusal, type Decision } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { PortalMilestone } from '@/types/portal';

/** One milestone for the client, with the approve or request changes form while can_decide. */
export function MilestoneReview({
  orgSlug,
  projectId,
  milestone: m,
  highlighted,
}: {
  orgSlug: string;
  projectId: string;
  milestone: PortalMilestone;
  highlighted?: boolean;
}) {
  const decide = usePortalDecision(orgSlug, projectId);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const problem = decision ? decisionProblem(decision, comment) : null;
  const commentId = `decision-comment-${m.id}`;

  const submit = () => {
    setTouched(true);
    if (!decision || problem) return;
    decide.mutate(
      { milestoneId: m.id, decision, comment },
      {
        onSuccess: () => {
          setDecision(null);
          setComment('');
          setTouched(false);
        },
        onError: (err) => {
          if (portalRefusal(httpStatusOf(err), errorBody(err)?.code) === 'not_ready') setNotReady(true);
        },
      },
    );
  };

  return (
    <li
      id={`milestone-${m.id}`}
      data-testid="portal-milestone"
      className={cn('rounded-lg border bg-card p-4', highlighted ? 'border-primary ring-2 ring-primary/20' : 'border-border')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="wrap-break-word text-sm font-semibold">{m.name}</h3>
          {m.target_date && <p className="mt-0.5 text-xs text-muted-foreground">Due {formatDate(m.target_date)}</p>}
        </div>
        <Badge status={m.status} className="shrink-0">
          {milestoneLabel(m.status)}
        </Badge>
      </div>
      {m.description && <RichTextView value={m.description} className="mt-2 text-sm text-muted-foreground" />}

      {m.last_decision && <DecisionNote decision={m.last_decision} className="mt-3" />}

      {notReady && (
        <p role="alert" className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          This milestone is no longer waiting for your review. Someone may have decided already, or the team took it back to keep working. The list now
          shows where it stands.
        </p>
      )}

      {m.can_decide && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">The team says this milestone is ready. What do you think?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Your decision">
            {(
              [
                ['approve', 'Approve'],
                ['request_changes', 'Request changes'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={decision === value}
                onClick={() => {
                  setDecision(value);
                  setNotReady(false);
                }}
                className={cn(
                  'h-11 rounded-md border text-sm font-medium transition-colors',
                  decision === value ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {decision && (
            <div className="space-y-1">
              <label htmlFor={commentId} className="text-sm">
                {decision === 'request_changes' ? 'What should change?' : 'Comment (optional)'}
              </label>
              <textarea
                id={commentId}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={MAX_DECISION_COMMENT}
                rows={4}
                aria-invalid={touched && !!problem}
                aria-describedby={touched && problem ? `${commentId}-problem` : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm"
              />
              {touched && problem && (
                <p id={`${commentId}-problem`} className="text-sm text-destructive">
                  {problem}
                </p>
              )}
            </div>
          )}
          {decision && (
            <Button className="h-11 w-full sm:w-auto" disabled={decide.isPending} onClick={submit}>
              {decide.isPending ? 'Sending...' : decision === 'approve' ? 'Approve milestone' : 'Send change request'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

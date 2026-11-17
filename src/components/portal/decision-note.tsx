import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { decisionSummary } from '@/lib/portal/logic';
import { cn } from '@/lib/utils';
import type { MilestoneDecision } from '@/types/portal';

/** A client's last decision on a milestone with their comment: the portal and the team's list. */
export function DecisionNote({ decision: d, className }: { decision: MilestoneDecision; className?: string }) {
  const approved = d.decision === 'approved';
  return (
    <div className={cn('rounded-md bg-muted/60 p-3 text-sm', className)} data-testid="milestone-decision">
      <p className="flex items-center gap-1.5 font-medium">
        {approved ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <MessageSquareWarning className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        )}
        {decisionSummary(d)}
      </p>
      {d.decided_at && <p className="text-xs text-muted-foreground">{formatDateTime(d.decided_at)}</p>}
      {d.comment && <p className="mt-1 whitespace-pre-line wrap-break-word">{d.comment}</p>}
    </div>
  );
}

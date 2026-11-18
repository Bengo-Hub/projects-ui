'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useShareReport } from '@/hooks/useStatusReports';
import type { StatusReport } from '@/types/reports';

/**
 * Shares a published report with the project's clients in the portal. "Include financials" shows
 * only for someone who may see the money (projects.financials.view on a plan with budget_tracking);
 * for anyone else the report goes without it. Sharing again only changes that choice.
 */
export function ShareReportDialog({
  orgSlug,
  projectId,
  report,
  canIncludeFinancials,
  onClose,
}: {
  orgSlug: string;
  projectId: string;
  report: StatusReport;
  canIncludeFinancials: boolean;
  onClose: () => void;
}) {
  const [include, setInclude] = useState(canIncludeFinancials && report.include_financials);
  const share = useShareReport(orgSlug, projectId, report.id);
  const again = report.client_visible;

  return (
    <QADialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={again ? 'Change what the client sees' : 'Share with the client'}
      description={
        again
          ? 'The report is already in the portal. Only the financials choice changes; clients are not told again.'
          : "Every client on the project finds it under Reports in the portal and gets a notice with a link to it."
      }
    >
      <div className="space-y-4">
        {canIncludeFinancials ? (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-primary" checked={include} onChange={(e) => setInclude(e.target.checked)} aria-label="Include financials" />
            <span>
              <span className="block font-medium">Include financials</span>
              <span className="block text-xs text-muted-foreground">The budget, cost, forecast and margin figures and the cost rating. Left off, the client sees neither.</span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="share-without-financials">
            The report is shared without financials.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={share.isPending}>
            Cancel
          </Button>
          <Button type="button" className="h-11 sm:h-9" disabled={share.isPending} onClick={() => share.mutate(canIncludeFinancials && include, { onSuccess: onClose })}>
            {share.isPending ? 'Sharing...' : again ? 'Save sharing' : 'Share report'}
          </Button>
        </div>
      </div>
    </QADialog>
  );
}

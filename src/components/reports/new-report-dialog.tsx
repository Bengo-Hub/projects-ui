'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QADialog } from '@/components/qa/qa-dialog';
import { useCreateReport } from '@/hooks/useStatusReports';
import { errorBody } from '@/lib/api/errors';
import { lastFullWeek, periodError, reportErrorText } from '@/lib/reports/logic';
import type { StatusReport } from '@/types/reports';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm min-h-11 sm:min-h-9';

/**
 * Opens a draft for a period, the last full week (Monday to Sunday) by default. The API fills it
 * from the project. A period already reported answers 409 report_exists, shown here in words.
 * Mount it only while open so each opening starts from last week.
 */
export function NewReportDialog({
  orgSlug,
  projectId,
  onClose,
  onCreated,
}: {
  orgSlug: string;
  projectId: string;
  onClose: () => void;
  onCreated: (r: StatusReport) => void;
}) {
  const [week] = useState(() => lastFullWeek(new Date()));
  const [start, setStart] = useState(week.start);
  const [end, setEnd] = useState(week.end);
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState(false);
  const create = useCreateReport(orgSlug, projectId);
  const problem = periodError(start, end);
  const body = errorBody(create.error);
  const refused = body?.code === 'report_exists' || body?.code === 'validation_error' ? reportErrorText(body.code, body.error, 'The report was not opened.') : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    const t = title.trim();
    create.mutate({ period_start: start, period_end: end, ...(t ? { title: t } : {}) }, { onSuccess: onCreated });
  }

  return (
    <QADialog open onOpenChange={(o) => !o && onClose()} title="New status report" description="The draft is filled from the project's tasks, milestones and risks for the period. You review it before publishing.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">First day</span>
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} aria-label="First day" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Last day</span>
            <input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Last day" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Title (optional)</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Report title" placeholder="Named after the period when left empty" />
        </label>
        {tried && problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        {refused && (
          <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" data-testid="report-exists">
            {refused}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={create.isPending}>
            {create.isPending ? 'Filling the draft...' : 'Open draft'}
          </Button>
        </div>
      </form>
    </QADialog>
  );
}

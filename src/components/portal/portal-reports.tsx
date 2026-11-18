'use client';

import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, Download, FileChartColumn } from 'lucide-react';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { ShowMore } from '@/components/common/list-parts';
import { RagChip } from '@/components/reports/rag';
import { ReportView, periodText } from '@/components/reports/report-view';
import { usePortalReport, usePortalReports } from '@/hooks/usePortal';
import { portalApi } from '@/lib/api/portal';
import { isNotFound } from '@/lib/api/errors';
import { reportFileName } from '@/lib/reports/logic';

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
      <span>{what} could not be loaded.</span>
      <button type="button" onClick={onRetry} className="h-10 rounded-md border border-border bg-background px-3 text-foreground">
        Try again
      </button>
    </div>
  );
}

/**
 * The status reports the team shared with the client (sprint 7 with US-14.5). The open report lives
 * in the URL (?tab=reports&report={id}), which is the link the share notice carries.
 */
export function PortalReports({
  orgSlug,
  projectId,
  reportId,
  onOpen,
}: {
  orgSlug: string;
  projectId: string;
  reportId: string | null;
  onOpen: (id: string | null) => void;
}) {
  if (reportId) return <PortalReportDetail orgSlug={orgSlug} projectId={projectId} reportId={reportId} onBack={() => onOpen(null)} />;
  return <PortalReportList orgSlug={orgSlug} projectId={projectId} onOpen={onOpen} />;
}

function PortalReportList({ orgSlug, projectId, onOpen }: { orgSlug: string; projectId: string; onOpen: (id: string) => void }) {
  const q = usePortalReports(orgSlug, projectId);
  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }
  if (q.isError) return <LoadError what="The reports" onRetry={() => void q.refetch()} />;
  if (q.items.length === 0) {
    return <EmptyState icon={FileChartColumn} title="No reports yet" description="Status reports the team shares with you show here, newest first." />;
  }
  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {q.items.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/50" data-testid="portal-report">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium wrap-break-word">{r.title}</p>
                <p className="text-xs text-muted-foreground">{periodText(r.period_start, r.period_end)}</p>
              </div>
              <RagChip value={r.rag_overall} label="Overall" className="shrink-0" />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid">
        <ShowMore show={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      </div>
    </>
  );
}

function PortalReportDetail({ orgSlug, projectId, reportId, onBack }: { orgSlug: string; projectId: string; reportId: string; onBack: () => void }) {
  const q = usePortalReport(orgSlug, projectId, reportId);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });
  const back = (
    <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      All reports
    </button>
  );

  if (q.isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (isNotFound(q.error)) {
    return (
      <div className="space-y-3">
        {back}
        <EmptyState icon={FileChartColumn} title="Report not available" description="The team may have taken it out of the portal, or the link is out of date." />
      </div>
    );
  }
  if (q.isError || !q.data) return <LoadError what="The report" onRetry={() => void q.refetch()} />;
  const r = q.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        <button
          type="button"
          onClick={() => void openPreview(() => portalApi.reportPdf(orgSlug, projectId, r.id), { fileName: reportFileName(r), title: r.title })}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-primary hover:bg-accent"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </button>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <ReportView report={r} hideEmptyCost />
        {r.shared_at && <p className="mt-5 text-xs text-muted-foreground">Shared with you on {formatDate(r.shared_at)}.</p>}
      </div>
      <PdfPreview {...previewProps} />
    </div>
  );
}

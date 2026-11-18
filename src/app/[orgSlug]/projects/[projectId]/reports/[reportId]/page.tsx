'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Share2, Undo2 } from 'lucide-react';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { formatDateTime } from '@bengo-hub/shared-ui-lib/format';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { ReportEditor } from '@/components/reports/report-editor';
import { ReportStatusPill } from '@/components/reports/report-status-pill';
import { ReportView, periodText } from '@/components/reports/report-view';
import { ShareReportDialog } from '@/components/reports/share-dialog';
import { useStatusReport, useUnshareReport } from '@/hooks/useStatusReports';
import { useServicePermissions } from '@/hooks/usePermissions';
import { reportsApi } from '@/lib/api/reports';
import { forbiddenKind, isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import { reportActions, reportFileName } from '@/lib/reports/logic';

/**
 * One status report. A draft opens in the editor for a project manager (read only for anyone
 * else); a published report reads as the client will see it, with the PDF and, for someone who
 * also manages the portal, Share with client and Unshare.
 */
export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const reportId = (params?.reportId as string) ?? '';
  const listHref = `/${orgSlug}/projects/${projectId}/reports`;

  const hasFeature = useFeature('project_management');
  const budgetTracking = useFeature('budget_tracking');
  const clientPortal = useFeature('client_portal');
  const { can } = useServicePermissions();
  const q = useStatusReport(orgSlug, hasFeature ? projectId : '', reportId);
  const unshare = useUnshareReport(orgSlug, projectId, reportId);
  const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });
  const [sharing, setSharing] = useState(false);
  const [confirmUnshare, setConfirmUnshare] = useState(false);

  const back = { href: listHref, label: 'Status reports' };

  if (!hasFeature || forbiddenKind(q.error) === 'subscription') {
    return (
      <div className="space-y-4">
        <PageHeader title="Status report" back={back} className="mb-0" />
        <FeatureLocked title="Status reports need project management" description="Upgrade your plan to write status reports and share them with clients." />
      </div>
    );
  }
  if (q.isLoading) return <PageLoading />;
  if (isNotFound(q.error)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Status report" back={back} className="mb-0" />
        <EmptyState icon={FileText} title="Report not found" description="It may have been a draft that was deleted, or the link is out of date." />
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorBanner message="The report could not be loaded." />;

  const report = q.data;
  const access = {
    canManage: can(PERMS.reportsManage),
    canPortalManage: can(PERMS.portalManage),
    canFinancials: can(PERMS.financialsView),
    budgetTracking,
    clientPortal,
  };
  const actions = reportActions(report, access);
  const openPdf = () =>
    void openPreview(() => reportsApi.pdf(orgSlug, projectId, report.id), {
      fileName: reportFileName(report),
      title: report.status === 'draft' ? `${report.title} (draft)` : report.title,
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title={report.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{periodText(report.period_start, report.period_end)}</span>
            <ReportStatusPill status={report.status} />
          </span>
        }
        back={back}
        className="mb-0"
        actions={
          <>
            <Button variant="outline" className="h-11 sm:h-9" onClick={openPdf}>
              <FileText className="h-4 w-4" aria-hidden />
              {report.status === 'draft' ? 'Draft PDF' : 'Download PDF'}
            </Button>
            {actions.share && (
              <Button className="h-11 sm:h-9" onClick={() => setSharing(true)}>
                <Share2 className="h-4 w-4" aria-hidden />
                {report.client_visible ? 'Sharing' : 'Share with client'}
              </Button>
            )}
            {actions.unshare && (
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setConfirmUnshare(true)}>
                <Undo2 className="h-4 w-4" aria-hidden />
                Unshare
              </Button>
            )}
          </>
        }
      />

      {report.status === 'published' && (
        <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="report-sharing">
          {report.published_at && (
            <p>
              Published {formatDateTime(report.published_at)}
              {report.published_by_name ? ` by ${report.published_by_name}` : ''}.
            </p>
          )}
          {report.client_visible ? (
            <p>
              Shared with the client{report.shared_at ? ` on ${formatDateTime(report.shared_at)}` : ''}
              {report.shared_by_name ? ` by ${report.shared_by_name}` : ''}, {report.include_financials ? 'with financials' : 'without financials'}.
            </p>
          ) : (
            <p className="text-muted-foreground">Not shared with the client.</p>
          )}
        </div>
      )}

      {actions.edit ? (
        <ReportEditor
          key={`${report.id}:${report.updated_at}`}
          orgSlug={orgSlug}
          projectId={projectId}
          report={report}
          onOpenPdf={openPdf}
          onDeleted={() => router.replace(listHref)}
        />
      ) : (
        <>
          {report.status === 'draft' && <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">This is a draft. The project manager is still working on it.</p>}
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <ReportView report={report} financialsHidden={report.financials_hidden} />
          </div>
        </>
      )}

      {sharing && (
        <ShareReportDialog orgSlug={orgSlug} projectId={projectId} report={report} canIncludeFinancials={actions.includeFinancials} onClose={() => setSharing(false)} />
      )}
      <ConfirmDialog
        open={confirmUnshare}
        onOpenChange={setConfirmUnshare}
        title="Take the report out of the portal?"
        description="Clients no longer see it. It can be shared again later."
        confirmLabel="Unshare"
        variant="warning"
        loading={unshare.isPending}
        onConfirm={() => unshare.mutate(undefined, { onSuccess: () => setConfirmUnshare(false) })}
      />
      <PdfPreview {...previewProps} />
    </div>
  );
}

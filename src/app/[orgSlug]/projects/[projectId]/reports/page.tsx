'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileChartColumn, Plus, Share2 } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { PageLoading } from '@/components/ui/loading';
import { PageHeader } from '@/components/common/page-header';
import { ShowMore } from '@/components/common/list-parts';
import { ProjectNotFound } from '@/components/common/not-found-state';
import { Can } from '@/components/auth/can';
import { FeatureLocked } from '@/components/subscription/feature-locked';
import { NewReportDialog } from '@/components/reports/new-report-dialog';
import { RagChip } from '@/components/reports/rag';
import { periodText } from '@/components/reports/report-view';
import { ReportStatusPill } from '@/components/reports/report-status-pill';
import { useStatusReports } from '@/hooks/useStatusReports';
import { forbiddenKind, isNotFound } from '@/lib/api/errors';
import { PERMS } from '@/lib/auth/permissions';
import type { StatusReport } from '@/types/reports';

/**
 * A project's status reports (sprint 7): the history, newest period first, and New report for a
 * project manager. A report opens on its own page, where a draft is edited and a published one is
 * read, downloaded and shared with the client.
 */
export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const projectId = (params?.projectId as string) ?? '';
  const hasFeature = useFeature('project_management');
  const [creating, setCreating] = useState(false);
  const list = useStatusReports(orgSlug, projectId, hasFeature);
  const base = `/${orgSlug}/projects/${projectId}/reports`;

  const columns = useMemo<DataTableColumn<StatusReport>[]>(
    () => [
      {
        key: 'title',
        header: 'Report',
        primary: true,
        render: (r) => (
          <span className="min-w-0">
            <span className="font-medium">{r.title}</span>
            <span className="block text-xs text-muted-foreground">{periodText(r.period_start, r.period_end)}</span>
          </span>
        ),
      },
      { key: 'overall', header: 'Overall', mobileAction: true, accessor: (r) => r.rag_overall, render: (r) => <RagChip value={r.rag_overall} label="Overall" /> },
      { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <ReportStatusPill status={r.status} /> },
      {
        key: 'shared',
        header: 'Client',
        hideBelow: 'sm',
        accessor: (r) => (r.client_visible ? 'shared' : ''),
        render: (r) =>
          r.client_visible ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary" data-testid="shared-marker">
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Shared
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not shared</span>
          ),
      },
    ],
    [],
  );

  const header = (
    <PageHeader
      title="Status reports"
      subtitle="Weekly or monthly reports on where the project stands, published for the team and shared with the client"
      back={{ href: `/${orgSlug}/projects/${projectId}`, label: 'Project' }}
      className="mb-0"
      actions={
        hasFeature ? (
          <Can permission={PERMS.reportsManage}>
            <Button className="h-11 sm:h-9" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New report
            </Button>
          </Can>
        ) : undefined
      }
    />
  );

  if (!hasFeature || forbiddenKind(list.error) === 'subscription') {
    return (
      <div className="space-y-4">
        {header}
        <FeatureLocked title="Status reports need project management" description="Upgrade your plan to write status reports and share them with clients." />
      </div>
    );
  }
  if (list.isLoading) return <PageLoading />;
  if (isNotFound(list.error)) return <ProjectNotFound orgSlug={orgSlug} />;
  if (list.isError) return <ErrorBanner message="The status reports could not be loaded." />;

  return (
    <div className="space-y-5">
      {header}
      {list.items.length === 0 ? (
        <EmptyState icon={FileChartColumn} title="No status reports yet" description="A report starts as a draft filled from the project. Review it, rate it and publish it." />
      ) : (
        <div className="grid gap-3">
          <DataTable
            columns={columns}
            rows={list.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`${base}/${r.id}`)}
            gridLines="rows"
            storageKey="projects-status-reports-columns"
          />
          <ShowMore show={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} />
        </div>
      )}

      {creating && (
        <NewReportDialog
          orgSlug={orgSlug}
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false);
            router.push(`${base}/${r.id}`);
          }}
        />
      )}
    </div>
  );
}

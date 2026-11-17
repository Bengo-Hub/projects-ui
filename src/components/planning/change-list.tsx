'use client';

import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import { formatDate } from '@bengo-hub/shared-ui-lib/format';
import { ChangeStatusPill } from '@/components/planning/change-status-pill';
import type { ChangeRequest } from '@/lib/api/planning';
import { KIND_LABEL, TREASURY_LABEL, pushStatus } from '@/lib/planning/changes';

/** Change requests in the shared table (cards on a phone); a row opens the request. */
export function ChangeList({
  rows,
  loading,
  error,
  onRetry,
  onOpen,
  projectName,
  emptyText,
}: {
  rows: ChangeRequest[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (cr: ChangeRequest) => void;
  /** Shown on the tenant-wide queue, where rows come from many projects. */
  projectName?: (id: string) => string;
  emptyText: string;
}) {
  const columns = useMemo<DataTableColumn<ChangeRequest>[]>(() => {
    const cols: DataTableColumn<ChangeRequest>[] = [
      {
        key: 'title',
        header: 'Change',
        primary: true,
        render: (c) => (
          <span className="min-w-0">
            <span className="font-medium">{c.title}</span>
            {projectName && <span className="block text-xs text-muted-foreground">{projectName(c.project_id)}</span>}
          </span>
        ),
      },
      { key: 'status', header: 'Status', mobileAction: true, accessor: (c) => c.status, render: (c) => <ChangeStatusPill status={c.status} /> },
      { key: 'kind', header: 'Kind', accessor: (c) => c.kind, render: (c) => KIND_LABEL[c.kind] ?? c.kind },
      { key: 'by', header: 'Raised by', accessor: (c) => c.requested_by_name, render: (c) => c.requested_by_name || 'Former member' },
      { key: 'date', header: 'Raised', hideBelow: 'md', accessor: (c) => c.created_at, render: (c) => formatDate(c.created_at) },
      {
        key: 'treasury',
        header: 'Treasury',
        hideBelow: 'lg',
        accessor: (c) => pushStatus(c.metadata),
        render: (c) => {
          const s = pushStatus(c.metadata);
          return s === 'not_needed' ? <span className="text-muted-foreground">-</span> : <span className={s === 'failed' ? 'text-destructive' : ''}>{TREASURY_LABEL[s] ?? s}</span>;
        },
      },
    ];
    return cols;
  }, [projectName]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(c) => c.id}
      loading={loading}
      loadingRows={4}
      error={error}
      onRetry={onRetry}
      emptyText={emptyText}
      onRowClick={onOpen}
      gridLines="rows"
      storageKey={projectName ? 'projects-approvals-columns' : 'projects-changes-columns'}
    />
  );
}
